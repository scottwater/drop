import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetLoginRateLimitState } from '../src/auth.js';
import { handleRequest } from '../src/index.js';
import { MockBucket } from './mock-bucket.js';
import { MockKV } from './mock-kv.js';

// Loopback, so the provider accepts an http issuer.
const BASE = 'http://127.0.0.1:8787';
const RESOURCE = `${BASE}/mcp`;
const CALLBACK = 'http://127.0.0.1:9999/callback';

function createEnv(overrides = {}) {
  return {
    OWNER_USERNAME: 'owner',
    OWNER_PASSWORD: 'secret',
    SESSION_SECRET: '0123456789abcdef0123456789abcdef',
    CLI_TOKENS: 'cli-token-0123456789abcdef',
    DROP_BUCKET: new MockBucket(),
    OAUTH_KV: new MockKV(),
    ...overrides,
  };
}

const cookiesFrom = (response) => response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');

function send(env, path, init = {}) {
  return handleRequest(new Request(new URL(path, BASE), init), env);
}

async function signIn(env) {
  const form = new FormData();
  form.set('username', 'owner');
  form.set('password', env.OWNER_PASSWORD);
  return cookiesFrom(await send(env, '/login', { method: 'POST', body: form }));
}

async function registerClient(env, name = 'Test client') {
  const response = await send(env, '/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [CALLBACK],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()).client_id;
}

function authorizationUrl(clientId, scope = 'drop:read') {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomUUID();
  const url = new URL(`${BASE}/oauth/authorize`);
  for (const [key, value] of Object.entries({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: CALLBACK,
    scope,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: RESOURCE,
  })) url.searchParams.set(key, value);
  return { url, verifier, state };
}

async function consentPage(env, url, session) {
  const response = await send(env, url, { headers: { cookie: session } });
  const html = await response.text();
  return { response, html, handle: /name="handle" value="([^"]+)"/.exec(html)?.[1], binding: cookiesFrom(response) };
}

function submitConsent(env, url, { session, binding, handle, scopes = [], decision = 'approve', origin = BASE }) {
  const form = new URLSearchParams({ handle, decision });
  for (const scope of scopes) form.append('scope', scope);
  return send(env, url, {
    method: 'POST',
    headers: {
      cookie: [session, binding].filter(Boolean).join('; '),
      'content-type': 'application/x-www-form-urlencoded',
      ...(origin ? { origin } : {}),
    },
    body: form,
  });
}

function tokenRequest(env, fields) {
  return send(env, '/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
}

// The whole owner flow: register, sign in, approve with `ticked` scopes, exchange the code.
async function connect(env, { ticked = [], scope = 'drop:read' } = {}) {
  const clientId = await registerClient(env);
  const session = await signIn(env);
  const { url, verifier, state } = authorizationUrl(clientId, scope);
  const page = await consentPage(env, url, session);
  expect(page.handle, page.html).toBeTruthy();
  const approved = await submitConsent(env, url, { session, ...page, scopes: ticked });
  expect(approved.status).toBe(302);
  const location = new URL(approved.headers.get('location'));
  expect(location.searchParams.get('state')).toBe(state);
  const response = await tokenRequest(env, {
    grant_type: 'authorization_code',
    code: location.searchParams.get('code'),
    redirect_uri: CALLBACK,
    client_id: clientId,
    code_verifier: verifier,
    resource: RESOURCE,
  });
  expect(response.status).toBe(200);
  return { clientId, session, ...(await response.json()) };
}

async function rpc(env, token, method, params = {}) {
  const response = await send(env, '/mcp', {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  const body = text.startsWith('event:') || text.startsWith('data:') ? text.match(/^data: (.*)$/m)?.[1] : text;
  return { status: response.status, headers: response.headers, body: body ? JSON.parse(body) : null };
}

async function tool(env, token, name, args) {
  const response = await rpc(env, token, 'tools/call', { name, arguments: args });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  const result = response.body.result;
  return result.isError ? { error: JSON.parse(result.content[0].text).error } : result.structuredContent;
}

describe('MCP over OAuth', () => {
  beforeEach(() => resetLoginRateLimitState());

  it('challenges unauthenticated calls and publishes OAuth metadata', async () => {
    const env = createEnv();
    const response = await send(env, '/mcp', { method: 'POST', body: '{}' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toContain(`resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp"`);

    const resource = await (await send(env, '/.well-known/oauth-protected-resource/mcp')).json();
    expect(resource.resource).toBe(RESOURCE);
    const server = await (await send(env, '/.well-known/oauth-authorization-server')).json();
    expect(server.registration_endpoint).toBe(`${BASE}/oauth/register`);
    expect(server.scopes_supported).toEqual(expect.arrayContaining(['drop:read', 'drop:write', 'drop:delete']));
  });

  it('sends a signed-out owner through login and back', async () => {
    const env = createEnv();
    const { url } = authorizationUrl(await registerClient(env));
    const response = await send(env, url);
    expect(response.status).toBe(302);
    const login = new URL(response.headers.get('location'), BASE);
    expect(login.pathname).toBe('/login');
    expect(login.searchParams.get('redirect')).toBe(url.pathname + url.search);
    expect(await (await send(env, login)).text()).toContain('An app is asking to connect');

    const session = await signIn(env);
    const back = await send(env, login, { headers: { cookie: session } });
    expect(back.headers.get('location')).toBe(url.pathname + url.search);
  });

  it('refuses consent posted from another site', async () => {
    const env = createEnv();
    const session = await signIn(env);
    const { url } = authorizationUrl(await registerClient(env));
    const page = await consentPage(env, url, session);
    const forged = await submitConsent(env, url, { session, ...page, origin: 'https://evil.example' });
    expect(forged.status).toBe(403);
  });

  it('grants read-only access by default and challenges writes', async () => {
    const env = createEnv();
    await env.DROP_BUCKET.put('notes/hello.md', '# Hi', { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
    // The app asks for write, but the owner ticks nothing.
    const { access_token: token, refresh_token: refresh } = await connect(env, { scope: 'drop:read drop:write' });
    expect(refresh).toBeUndefined();

    const listing = await tool(env, token, 'list_files', { path: 'notes' });
    expect(listing.files.map((file) => file.path)).toEqual(['notes/hello.md']);
    expect(listing.files[0].url).toBe(`${BASE}/notes/hello.md`);

    const write = await rpc(env, token, 'tools/call', { name: 'write_file', arguments: { path: 'x.txt', content: 'x' } });
    expect(write.status).toBe(403);
    expect(write.headers.get('www-authenticate')).toContain('insufficient_scope');
    expect(await env.DROP_BUCKET.head('x.txt')).toBeNull();
  });

  it('writes, reads, protects and deletes files with the granted scopes', async () => {
    const env = createEnv();
    const { access_token: token } = await connect(env, { ticked: ['drop:write', 'drop:delete'] });

    const written = await tool(env, token, 'write_file', { path: 'notes/post.md', content: '---\ntitle: Post\n---\nHello **there**.' });
    expect(written.url).toBe(`${BASE}/notes/post.md`);
    expect(written.written.map((file) => file.path)).toEqual(['notes/post.md', 'notes/post.html']);
    expect(await (await send(env, '/notes/post.html')).text()).toContain('<strong>there</strong>');

    const read = await tool(env, token, 'read_file', { path: 'notes/post.md' });
    expect(read).toMatchObject({ encoding: 'utf8', content: '---\ntitle: Post\n---\nHello **there**.' });

    const again = await tool(env, token, 'write_file', { path: 'notes/post.md', content: 'replaced' });
    expect(again.error.code).toBe('ALREADY_EXISTS');
    expect(again.error.paths).toEqual(['notes/post.md', 'notes/post.html']);
    await tool(env, token, 'write_file', { path: 'notes/post.md', content: 'replaced', overwrite: true });
    expect((await tool(env, token, 'read_file', { path: 'notes/post.md' })).content).toBe('replaced');

    const png = Buffer.from([137, 80, 78, 71, 0, 255]).toString('base64');
    await tool(env, token, 'write_file', { path: 'img/dot.png', content: png, encoding: 'base64' });
    expect(await tool(env, token, 'read_file', { path: 'img/dot.png' })).toMatchObject({ encoding: 'base64', content: png, contentType: 'image/png' });

    expect((await tool(env, token, 'write_file', { path: 'admin/x.html', content: 'x' })).error.code).toBe('INVALID_PATH');
    expect((await tool(env, token, 'write_file', { path: '../x.txt', content: 'x' })).error.code).toBe('INVALID_PATH');
    expect((await tool(env, token, 'search_files', { query: 'POST' })).results.map((file) => file.path)).toEqual(['notes/post.html', 'notes/post.md']);

    expect(await tool(env, token, 'delete_file', { path: 'notes/post.md' })).toEqual({ path: 'notes/post.md', deleted: true });
    expect((await tool(env, token, 'delete_file', { path: 'notes/post.md' })).error.code).toBe('NOT_FOUND');
    expect(await tool(env, token, 'delete_folder', { path: 'notes' })).toEqual({ path: 'notes', deletedFiles: 1 });
    expect((await send(env, '/notes/post.html')).status).toBe(404);
  });

  it('works through the MCP client', async () => {
    const env = createEnv();
    const { access_token: token } = await connect(env, { ticked: ['drop:write'] });
    const client = new Client({ name: 'drop-tests', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(RESOURCE), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
      fetch: (url, init) => handleRequest(new Request(url, init), env),
    });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((entry) => entry.name).sort()).toEqual(
      ['create_folder', 'delete_file', 'delete_folder', 'list_files', 'read_file', 'search_files', 'write_file'],
    );
    const result = await client.callTool({ name: 'create_folder', arguments: { path: 'drafts' } });
    expect(result.structuredContent).toEqual({ path: 'drafts', url: `${BASE}/drafts/` });
    await client.close();
  });

  it('issues refresh tokens only for "Stay connected"', async () => {
    const env = createEnv();
    const { clientId, refresh_token: refresh } = await connect(env, { ticked: ['offline_access'] });
    expect(refresh).toBeTruthy();
    const renewed = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId, resource: RESOURCE });
    expect(renewed.status).toBe(200);
    expect((await renewed.json()).access_token).toBeTruthy();
  });

  it('disconnects every app when the owner password changes', async () => {
    const env = createEnv();
    const { access_token: token, clientId, refresh_token: refresh } = await connect(env, { ticked: ['offline_access'] });
    env.OWNER_PASSWORD = 'a-new-password';
    expect((await rpc(env, token, 'tools/list')).status).toBe(401);
    const renewed = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: refresh, client_id: clientId, resource: RESOURCE });
    expect(renewed.status).toBe(400);
  });

  it('lists and revokes connections from the admin API', async () => {
    const env = createEnv();
    const { access_token: token, session } = await connect(env, { ticked: ['drop:write'] });
    const listed = await (await send(env, '/api/admin/connections', { headers: { cookie: session } })).json();
    expect(listed.connections).toHaveLength(1);
    expect(listed.connections[0]).toMatchObject({ name: 'Test client', scopes: ['drop:read', 'drop:write'] });

    const revoked = await send(env, '/api/admin/connections/revoke', {
      method: 'POST',
      headers: { cookie: session, 'content-type': 'application/json' },
      body: JSON.stringify({ id: listed.connections[0].id }),
    });
    expect(revoked.status).toBe(200);
    expect((await rpc(env, token, 'tools/list')).status).toBe(401);
  });

  it('404s OAuth routes when no OAUTH_KV is bound', async () => {
    const env = createEnv({ OAUTH_KV: undefined });
    expect((await send(env, '/mcp', { method: 'POST' })).status).toBe(404);
    expect((await send(env, '/.well-known/oauth-authorization-server')).status).toBe(404);
  });
});
