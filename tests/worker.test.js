import { beforeEach, describe, expect, it } from 'vitest';
import { resetLoginRateLimitState } from '../src/auth.js';
import { handleRequest } from '../src/index.js';
import { MockBucket } from './mock-bucket.js';

const CLI_TOKEN = 'cli-token-0123456789abcdef';
const SESSION_SECRET = '0123456789abcdef0123456789abcdef';

function createEnv(overrides = {}) {
  return {
    APP_NAME: 'Drop',
    OWNER_USERNAME: 'owner',
    OWNER_PASSWORD: 'secret',
    SESSION_SECRET,
    CLI_TOKENS: CLI_TOKEN,
    DROP_BUCKET: new MockBucket(),
    ...overrides,
  };
}

describe('worker routes', () => {
  beforeEach(() => {
    resetLoginRateLimitState();
  });

  it('protects admin APIs and serves login page', async () => {
    const env = createEnv();
    const loginResponse = await handleRequest(new Request('https://drop.test/login'), env);
    expect(loginResponse.status).toBe(200);
    expect(await loginResponse.text()).toContain('Quiet publishing');

    const unauthorized = await handleRequest(new Request('https://drop.test/api/admin/list'), env);
    expect(unauthorized.status).toBe(401);
  });

  it('renders the admin page for an authenticated web session', async () => {
    const env = createEnv();

    const loginForm = new FormData();
    loginForm.set('username', 'owner');
    loginForm.set('password', 'secret');
    loginForm.set('redirect', '/admin');

    const login = await handleRequest(new Request('https://drop.test/login', {
      method: 'POST',
      body: loginForm,
    }), env);

    expect(login.status).toBe(302);
    const cookie = login.headers.get('set-cookie');
    expect(cookie).toContain('drop_session=');

    const admin = await handleRequest(new Request('https://drop.test/admin', {
      headers: { cookie },
    }), env);

    expect(admin.status).toBe(200);
    const html = await admin.text();
    expect(html).toContain('owner console');
    expect(html).toContain('Choose files');
    expect(html).toContain('Choose folder');
    expect(html).toContain('Delete');

    const scriptMatch = html.match(/<script type="module">([\s\S]*)<\/script>/);
    expect(scriptMatch?.[1]).toBeTruthy();
    expect(() => new Function(scriptMatch[1])).not.toThrow();
  });

  it('creates folders, uploads markdown, and serves companion html', async () => {
    const env = createEnv();
    const authHeaders = { authorization: `Bearer ${CLI_TOKEN}` };

    const mkdir = await handleRequest(new Request('https://drop.test/api/admin/folder', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'notes' }),
    }), env);
    expect(mkdir.status).toBe(200);

    const form = new FormData();
    form.set('output', 'notes/post.md');
    form.append('files', new File(['---\ntitle: Field Notes\n---\n\n# Hello\n\nDrop works.'], 'post.md', { type: 'text/markdown' }));
    form.append('relativePaths', 'post.md');

    const upload = await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: form,
    }), env);

    expect(upload.status).toBe(200);
    const payload = await upload.json();
    expect(payload.saved).toContain('notes/post.md');
    expect(payload.saved).toContain('notes/post.html');

    const rawMarkdown = await handleRequest(new Request('https://drop.test/notes/post.md'), env);
    expect(rawMarkdown.status).toBe(200);
    expect(await rawMarkdown.text()).toContain('Drop works');

    const renderedHtml = await handleRequest(new Request('https://drop.test/notes/post.html'), env);
    expect(renderedHtml.status).toBe(200);
    expect(await renderedHtml.text()).toContain('Field Notes');

    const folderView = await handleRequest(new Request('https://drop.test/notes'), env);
    expect(folderView.status).toBe(200);
    expect(await folderView.text()).toContain('post.html');
  });

  it('returns conflicts when overwrite is not forced', async () => {
    const env = createEnv();
    const form = new FormData();
    form.set('output', 'site');
    form.append('files', new File(['<h1>One</h1>'], 'index.html', { type: 'text/html' }));
    form.append('relativePaths', 'index.html');

    const authHeaders = { authorization: `Bearer ${CLI_TOKEN}` };
    const first = await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: form,
    }), env);
    expect(first.status).toBe(200);

    const secondForm = new FormData();
    secondForm.set('output', 'site');
    secondForm.append('files', new File(['<h1>Two</h1>'], 'index.html', { type: 'text/html' }));
    secondForm.append('relativePaths', 'index.html');

    const second = await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: secondForm,
    }), env);

    expect(second.status).toBe(409);
    const payload = await second.json();
    expect(payload.conflicts).toContain('site/index.html');

    const publicView = await handleRequest(new Request('https://drop.test/site'), env);
    expect(publicView.status).toBe(200);
    expect(await publicView.text()).toContain('<h1>One</h1>');
  });

  it('hides all root contents from the public home page but keeps direct paths accessible', async () => {
    const env = createEnv();
    const authHeaders = { authorization: `Bearer ${CLI_TOKEN}` };

    const rootUpload = new FormData();
    rootUpload.append('files', new File(['<h1>Root File</h1>'], 'hello.html', { type: 'text/html' }));
    rootUpload.append('relativePaths', 'hello.html');

    const folderUpload = new FormData();
    folderUpload.append('files', new File(['inside folder'], 'readme.txt', { type: 'text/plain' }));
    folderUpload.append('relativePaths', 'readme.txt');
    folderUpload.set('output', 'notes');

    await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: rootUpload,
    }), env);

    await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: folderUpload,
    }), env);

    const home = await handleRequest(new Request('https://drop.test/'), env);
    const html = await home.text();
    expect(home.status).toBe(200);
    expect(html).toContain('<h1>Drop</h1>');
    expect(html).not.toContain('notes/');
    expect(html).not.toContain('hello.html');
    expect(html).not.toContain('Contents');
    expect(html).not.toContain('Nothing is stored here yet.');

    const directFile = await handleRequest(new Request('https://drop.test/hello.html'), env);
    expect(directFile.status).toBe(200);
    expect(await directFile.text()).toContain('Root File');

    const directFolder = await handleRequest(new Request('https://drop.test/notes'), env);
    expect(directFolder.status).toBe(200);
    expect(await directFolder.text()).toContain('index.txt');
  });

  it('deletes files and folders from the admin api', async () => {
    const env = createEnv();
    const authHeaders = { authorization: `Bearer ${CLI_TOKEN}` };

    const fileForm = new FormData();
    fileForm.append('files', new File(['<h1>Temp</h1>'], 'temp.html', { type: 'text/html' }));
    fileForm.append('relativePaths', 'temp.html');
    await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: fileForm,
    }), env);

    const folderForm = new FormData();
    folderForm.set('output', 'trash');
    folderForm.append('files', new File(['<h1>Trash</h1>'], 'index.html', { type: 'text/html' }));
    folderForm.append('relativePaths', 'index.html');
    await handleRequest(new Request('https://drop.test/api/admin/upload', {
      method: 'POST',
      headers: authHeaders,
      body: folderForm,
    }), env);

    const deleteFile = await handleRequest(new Request('https://drop.test/api/admin/delete', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'temp.html', type: 'file' }),
    }), env);
    expect(deleteFile.status).toBe(200);

    const deleteFolder = await handleRequest(new Request('https://drop.test/api/admin/delete', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'trash', type: 'folder' }),
    }), env);
    expect(deleteFolder.status).toBe(200);

    expect((await handleRequest(new Request('https://drop.test/temp.html'), env)).status).toBe(404);
    expect((await handleRequest(new Request('https://drop.test/trash'), env)).status).toBe(404);
  });

  it('fails closed when auth configuration is missing or weak', async () => {
    const missingSecret = await handleRequest(new Request('https://drop.test/login'), createEnv({ SESSION_SECRET: '' }));
    expect(missingSecret.status).toBe(500);
    expect(await missingSecret.text()).toContain('SESSION_SECRET is required');

    const weakSecret = await handleRequest(new Request('https://drop.test/login'), createEnv({ SESSION_SECRET: 'too-short' }));
    expect(weakSecret.status).toBe(500);
    expect(await weakSecret.text()).toContain('SESSION_SECRET must be at least 32 characters');
  });

  it('treats malformed session cookies as unauthenticated instead of crashing', async () => {
    const env = createEnv();

    const response = await handleRequest(new Request('https://drop.test/admin', {
      headers: { cookie: 'drop_session=%%%%.nope' },
    }), env);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?redirect=%2Fadmin');
  });

  it('rate limits repeated failed login attempts', async () => {
    const env = createEnv({
      LOGIN_RATE_LIMIT_MAX_ATTEMPTS: '3',
      LOGIN_RATE_LIMIT_WINDOW_SECONDS: '60',
      LOGIN_RATE_LIMIT_BLOCK_SECONDS: '120',
    });

    async function attempt(password) {
      const form = new FormData();
      form.set('username', 'owner');
      form.set('password', password);
      form.set('redirect', '/admin');

      return handleRequest(new Request('https://drop.test/login', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.10' },
        body: form,
      }), env);
    }

    expect((await attempt('wrong-1')).status).toBe(401);
    expect((await attempt('wrong-2')).status).toBe(401);

    const blocked = await attempt('wrong-3');
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('120');
    expect(await blocked.text()).toContain('Too many sign-in attempts');

    const stillBlocked = await attempt('secret');
    expect(stillBlocked.status).toBe(429);
  });
});
