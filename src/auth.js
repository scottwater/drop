import { renderLoginPage } from './templates.js';

const SESSION_COOKIE = 'drop_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token && getCliTokens(env).includes(token)) {
      return { ok: true, mode: 'cli' };
    }
  }

  const cookies = parseCookies(request.headers.get('cookie') || '');
  const session = cookies[SESSION_COOKIE];
  if (!session) return { ok: false };

  const payload = await verifySignedValue(session, env.SESSION_SECRET || '');
  if (!payload) return { ok: false };

  try {
    const data = JSON.parse(payload);
    if (data.exp < Date.now()) return { ok: false };
    if (data.u !== env.OWNER_USERNAME) return { ok: false };
    return { ok: true, mode: 'web', user: data.u };
  } catch {
    return { ok: false };
  }
}

export async function requireOwner(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth.ok) {
    throw new Response('Unauthorized', { status: 401 });
  }
  return auth;
}

export async function handleLogin(request, env) {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');
  const redirectTo = sanitizeRedirect(String(form.get('redirect') || '/admin'));
  const secure = shouldUseSecureCookies(request);

  if (username !== env.OWNER_USERNAME || password !== env.OWNER_PASSWORD) {
    return new Response(renderLoginPage({ error: 'Invalid credentials', redirect: redirectTo }), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = JSON.stringify({ u: username, exp: expires });
  const signed = await signValue(payload, env.SESSION_SECRET || '');
  const headers = new Headers({ location: redirectTo });
  headers.append('set-cookie', serializeCookie(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'Lax',
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }));
  return new Response(null, { status: 302, headers });
}

export function handleLogout(request) {
  const headers = new Headers({ location: '/login' });
  headers.append('set-cookie', serializeCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'Lax',
    secure: shouldUseSecureCookies(request),
    path: '/',
    maxAge: 0,
  }));
  return new Response(null, { status: 302, headers });
}

export function sanitizeRedirect(value) {
  if (!value || !value.startsWith('/')) return '/admin';
  if (value.startsWith('//')) return '/admin';
  return value;
}

export function getCliTokens(env) {
  return String(env.CLI_TOKENS || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
}

export function parseCookies(cookieHeader) {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const index = part.indexOf('=');
      if (index === -1) return acc;
      const key = part.slice(0, index);
      const value = part.slice(index + 1);
      acc[key] = value;
      return acc;
    }, {});
}

export function serializeCookie(name, value, options = {}) {
  const pieces = [`${name}=${value}`];
  if (options.maxAge !== undefined) pieces.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) pieces.push('HttpOnly');
  if (options.secure) pieces.push('Secure');
  if (options.sameSite) pieces.push(`SameSite=${options.sameSite}`);
  pieces.push(`Path=${options.path || '/'}`);
  return pieces.join('; ');
}

async function signValue(value, secret) {
  const signature = await signText(value, secret);
  return `${base64UrlEncode(value)}.${signature}`;
}

async function verifySignedValue(input, secret) {
  const index = input.lastIndexOf('.');
  if (index === -1) return null;
  const encoded = input.slice(0, index);
  const provided = input.slice(index + 1);
  const value = base64UrlDecode(encoded);
  const expected = await signText(value, secret);
  return timingSafeEqual(provided, expected) ? value : null;
}

async function signText(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function base64UrlEncode(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value) {
  const padding = '='.repeat((4 - (value.length % 4 || 4)) % 4);
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function bytesToBase64Url(bytes) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function shouldUseSecureCookies(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === 'https:';
  } catch {
    return true;
  }
}
