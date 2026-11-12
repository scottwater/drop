import { authorize } from './authorize.js';
import { mcpEnabled, publicOrigin } from './config.js';
import { oauthRoles } from './provider.js';
import { registrationWait } from './registration.js';

const MAX_OAUTH_BODY = 65_536;

export function isOAuthPath(path) {
  return path === '/mcp' || path.startsWith('/mcp/') || path.startsWith('/oauth/') || path.startsWith('/.well-known/oauth-');
}

function json(data, status, headers = {}) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

async function limitBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_OAUTH_BODY) throw json({ error: 'invalid_request', error_description: 'Request body is too large.' }, 413);
  return request;
}

async function register(request, env, ctx, authorizationServer) {
  if (request.method === 'POST') {
    const wait = await registrationWait(env.OAUTH_KV, request.headers.get('cf-connecting-ip') || 'local');
    if (wait) {
      return json(
        { error: 'temporarily_unavailable', error_description: 'Too many apps have registered recently. Try again later.' },
        429,
        { 'retry-after': String(wait) },
      );
    }
  }
  return authorizationServer.fetch(await limitBody(request), env, ctx);
}

// Every OAuth and MCP route. Without an OAUTH_KV binding they all 404.
export async function oauthRoute(request, env, ctx) {
  if (!mcpEnabled(env)) {
    return new Response('Not found', { status: 404 });
  }
  const path = new URL(request.url).pathname;
  const origin = publicOrigin(env, request);
  const { authorizationServer, resourceServer } = oauthRoles(origin);

  try {
    if (path === '/mcp' || path.startsWith('/mcp/')) {
      // MCP clients call from servers; a browser page on another origin may
      // not (this also blocks DNS-rebinding attacks).
      const callerOrigin = request.headers.get('origin');
      if (callerOrigin && callerOrigin !== origin && callerOrigin !== new URL(request.url).origin) {
        return json({ error: 'This origin may not call Drop.' }, 403);
      }
      return await resourceServer.fetch(request, env, ctx);
    }
    if (path === '/oauth/authorize') return await authorize(request, env);
    if (path === '/oauth/register') return await register(request, env, ctx, authorizationServer);
    if (path === '/oauth/token') return await authorizationServer.fetch(await limitBody(request), env, ctx);
    if (path.startsWith('/.well-known/oauth-protected-resource')) return await resourceServer.fetch(request, env, ctx);
    if (path.startsWith('/.well-known/oauth-authorization-server')) return await authorizationServer.fetch(request, env, ctx);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  return new Response('Not found', { status: 404 });
}
