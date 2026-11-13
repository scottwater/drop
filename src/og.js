import { normalizePath, publicHref } from './path.js';

// Link previews for published HTML pages. Drop knows nothing about what a page
// holds, so its preview image is a screenshot of the page's first screen,
// taken by Cloudflare Browser Rendering (the BROWSER binding) and kept in the
// Workers cache per version of the page. Without the binding, pages go out
// unchanged.

export const PREVIEW_PREFIX = '/__og/';

// The Open Graph 1.91:1 card, which Facebook, LinkedIn, Slack and iMessage
// show whole and X crops to 2:1. The browser's viewport is this size, so the
// image is exactly what a visitor first sees on a laptop-width window.
const SIZE = { width: 1200, height: 630 };
// Bump to take cached screenshots afresh after changing how they're taken.
const DESIGN = 1;
// Pages larger than this are served without preview tags rather than read
// into memory to add them.
const MAX_REWRITE_BYTES = 2 * 1024 * 1024;
const NAVIGATION_TIMEOUT_MS = 15_000;

export function isPreviewPath(pathname) {
  return pathname.startsWith(PREVIEW_PREFIX);
}

export function previewsEnabled(env) {
  return Boolean(env.BROWSER);
}

// Adds og:image and twitter:card tags to a full 200 HTML response unless the
// page names its own image. `object` is the R2 object the response came from.
export async function withPreviewTags(response, { env, key, object, url }) {
  if (!previewsEnabled(env) || response.status !== 200 || !isHtml(response.headers.get('content-type'))) {
    return response;
  }
  if (!object.size || object.size > MAX_REWRITE_BYTES || !isUtf8(response.headers.get('content-type'))) {
    return response;
  }

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(injectPreviewTags(html, previewImageUrl(url.origin, key, object)), { status: 200, headers });
}

export function injectPreviewTags(html, imageUrl) {
  if (hasMeta(html, 'og:image') || hasMeta(html, 'twitter:image')) return html;
  const close = html.search(/<\/head\s*>/i);
  if (close === -1) return html;

  const tags = [
    ['property', 'og:image', imageUrl],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', String(SIZE.width)],
    ['property', 'og:image:height', String(SIZE.height)],
  ];
  if (!hasMeta(html, 'twitter:card')) tags.push(['name', 'twitter:card', 'summary_large_image']);
  const markup = tags.map(([kind, name, value]) => `<meta ${kind}="${name}" content="${escapeAttribute(value)}">`).join('\n    ');
  return `${html.slice(0, close)}    ${markup}\n  ${html.slice(close)}`;
}

// The version query only changes the URL when the page changes, so link
// unfurlers that cache by URL fetch a new image. The route itself always
// serves the current version.
export function previewImageUrl(origin, key, object) {
  return `${origin}${PREVIEW_PREFIX}${publicHref(key).slice(1)}?v=${versionOf(object).slice(0, 16)}`;
}

// GET /__og/<path>: the screenshot of the HTML page stored at <path>.
export async function servePreviewImage(request, env, ctx) {
  const url = new URL(request.url);
  if (!previewsEnabled(env) || !['GET', 'HEAD'].includes(request.method)) return notFound();

  let key;
  try {
    key = normalizePath(decodeURIComponent(url.pathname.slice(PREVIEW_PREFIX.length)), { allowEmpty: false });
  } catch {
    return notFound();
  }
  const object = await env.DROP_BUCKET.head(key);
  if (!object || !isHtml(object.httpMetadata?.contentType)) return notFound();

  const cacheKey = new Request(`${url.origin}/__og-cache/${await sha256(JSON.stringify([DESIGN, key, versionOf(object)]))}.png`);
  const cache = globalThis.caches?.default;
  let png = cache ? await (await cache.match(cacheKey))?.arrayBuffer() : undefined;

  if (!png) {
    try {
      png = await screenshotOnce(cacheKey.url, `${url.origin}${publicHref(key)}`, env);
    } catch (error) {
      console.error(`Preview screenshot of ${key} failed:`, error);
      return new Response('Preview unavailable', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'retry-after': '60' },
      });
    }
    if (cache) {
      ctx.waitUntil(cache.put(cacheKey, new Response(png, {
        headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=2592000' },
      })));
    }
  }

  return new Response(request.method === 'HEAD' ? null : png, {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' },
  });
}

// Unfurlers often ask for an image several times at once; share one browser
// session between requests in the same isolate.
const inFlight = new Map();

function screenshotOnce(id, pageUrl, env) {
  if (!inFlight.has(id)) {
    inFlight.set(id, screenshot(pageUrl, env).finally(() => inFlight.delete(id)));
  }
  return inFlight.get(id);
}

async function screenshot(pageUrl, env) {
  // Loaded on first use so the browser client stays out of every other request.
  const { default: puppeteer } = await import('@cloudflare/puppeteer');
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...SIZE, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: NAVIGATION_TIMEOUT_MS });
    } catch (error) {
      // A page that keeps the network busy (analytics, long polling) has still
      // drawn its first screen by now; shoot what's there.
      if (error?.name !== 'TimeoutError') throw error;
    }
    await page.evaluate(() => document.fonts?.ready);
    return await page.screenshot({ type: 'png' });
  } finally {
    await browser.close();
  }
}

function hasMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<meta\\b[^>]*\\b(?:property|name)\\s*=\\s*["']?${escaped}["'\\s/>]`, 'i').test(html);
}

function isHtml(contentType) {
  return /^\s*text\/html\b/i.test(contentType || '');
}

function isUtf8(contentType) {
  const charset = /charset\s*=\s*"?([^";\s]+)/i.exec(contentType || '')?.[1];
  return !charset || /^utf-?8$/i.test(charset);
}

function versionOf(object) {
  return String(object.etag || object.httpEtag || object.uploaded?.getTime?.() || '').replace(/"/g, '');
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function notFound() {
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
