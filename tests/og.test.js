import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/index.js';
import { injectPreviewTags } from '../src/og.js';
import { MockBucket } from './mock-bucket.js';

const shots = vi.hoisted(() => ({ visited: [], fail: false }));

vi.mock('@cloudflare/puppeteer', () => ({
  default: {
    async launch() {
      return {
        async newPage() {
          return {
            async setViewport() {},
            async emulateMediaFeatures() {},
            async goto(url) {
              if (shots.fail) throw new Error('no browser');
              shots.visited.push(url);
            },
            async evaluate() {},
            async screenshot() {
              return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
            },
          };
        },
        async close() {},
      };
    },
  },
}));

const PAGE = '<!doctype html><html><head><title>Hi</title></head><body>Hello</body></html>';

function createEnv(overrides = {}) {
  return {
    APP_NAME: 'Drop',
    OWNER_USERNAME: 'owner',
    OWNER_PASSWORD: 'secret',
    SESSION_SECRET: '0123456789abcdef0123456789abcdef',
    CLI_TOKENS: 'cli-token-0123456789abcdef',
    DROP_BUCKET: new MockBucket(),
    BROWSER: {},
    ...overrides,
  };
}

const get = (env, path, init) => handleRequest(new Request(`https://drop.test${path}`, init), env);

describe('link previews', () => {
  beforeEach(() => {
    shots.visited = [];
    shots.fail = false;
  });

  it('adds og:image tags to published HTML pages and folder indexes', async () => {
    const env = createEnv();
    await env.DROP_BUCKET.put('notes/a page.html', PAGE, { httpMetadata: { contentType: 'text/html; charset=utf-8' } });
    await env.DROP_BUCKET.put('site/index.html', PAGE, { httpMetadata: { contentType: 'text/html' } });

    const page = await (await get(env, '/notes/a%20page.html')).text();
    expect(page).toMatch(/<meta property="og:image" content="https:\/\/drop\.test\/__og\/notes\/a%20page\.html\?v=[0-9a-f]{16}">/);
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(page.indexOf('og:image')).toBeLessThan(page.indexOf('</head>'));

    const index = await (await get(env, '/site/')).text();
    expect(index).toContain('https://drop.test/__og/site/index.html?v=');
  });

  it('changes the image URL when the page changes', async () => {
    const env = createEnv();
    const put = (body) => env.DROP_BUCKET.put('p.html', body, { httpMetadata: { contentType: 'text/html' } });
    const imageUrl = async () => /og:image" content="([^"]+)"/.exec(await (await get(env, '/p.html')).text())[1];

    await put(PAGE);
    const first = await imageUrl();
    await put(PAGE.replace('Hello', 'Goodbye'));
    expect(await imageUrl()).not.toBe(first);
  });

  it('leaves pages alone without the browser binding, or when they name their own image', async () => {
    const env = createEnv({ BROWSER: undefined });
    await env.DROP_BUCKET.put('p.html', PAGE, { httpMetadata: { contentType: 'text/html' } });
    expect(await (await get(env, '/p.html')).text()).toBe(PAGE);
    expect((await get(env, '/__og/p.html')).status).toBe(404);

    const own = PAGE.replace('</head>', '<meta property="og:image" content="https://x.test/i.png"></head>');
    expect(injectPreviewTags(own, 'https://drop.test/__og/p.html')).toBe(own);
  });

  it('leaves non-HTML files, ranges and revalidations alone', async () => {
    const env = createEnv();
    await env.DROP_BUCKET.put('p.html', PAGE, { httpMetadata: { contentType: 'text/html' } });
    await env.DROP_BUCKET.put('n.txt', PAGE, { httpMetadata: { contentType: 'text/plain' } });

    expect(await (await get(env, '/n.txt')).text()).toBe(PAGE);
    const range = await get(env, '/p.html', { headers: { range: 'bytes=0-4' } });
    expect(range.status).toBe(206);
    expect(await range.text()).toBe('<!doc');
    const etag = (await get(env, '/p.html')).headers.get('etag');
    expect((await get(env, '/p.html', { headers: { 'if-none-match': etag } })).status).toBe(304);
  });

  it('serves a screenshot of the page as the preview image', async () => {
    const env = createEnv();
    await env.DROP_BUCKET.put('notes/a page.html', PAGE, { httpMetadata: { contentType: 'text/html' } });

    const image = await get(env, '/__og/notes/a%20page.html?v=abc');
    expect(image.status).toBe(200);
    expect(image.headers.get('content-type')).toBe('image/png');
    expect([...new Uint8Array(await image.arrayBuffer())]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(shots.visited).toEqual(['https://drop.test/notes/a%20page.html']);
  });

  it('refuses previews of missing or non-HTML files and reports browser failures', async () => {
    const env = createEnv();
    await env.DROP_BUCKET.put('n.txt', 'hi', { httpMetadata: { contentType: 'text/plain' } });
    await env.DROP_BUCKET.put('p.html', PAGE, { httpMetadata: { contentType: 'text/html' } });

    expect((await get(env, '/__og/missing.html')).status).toBe(404);
    expect((await get(env, '/__og/n.txt')).status).toBe(404);
    expect((await get(env, '/__og/%E0%A4%A')).status).toBe(404);

    shots.fail = true;
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = await get(env, '/__og/p.html');
    errors.mockRestore();
    expect(failed.status).toBe(503);
    expect(failed.headers.get('cache-control')).toBe('no-store');
  });

  it('reserves the /__og path for uploads', async () => {
    const env = createEnv();
    const form = new FormData();
    form.append('files', new File(['x'], 'a.html', { type: 'text/html' }));
    form.append('output', '__og/a.html');
    const response = await get(env, '/api/admin/upload', {
      method: 'POST',
      body: form,
      headers: { authorization: `Bearer ${env.CLI_TOKENS}` },
    });
    expect(response.status).toBe(400);
  });
});
