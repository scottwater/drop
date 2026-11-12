import { renderLoginPage } from './templates.js';

const SESSION_COOKIE = 'drop_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const MIN_SESSION_SECRET_LENGTH = 32;
const DEFAULT_LOGIN_RATE_LIMIT = {
  maxAttempts: 5,
  windowSeconds: 60 * 15,
  blockSeconds: 60 * 15,
};
const WEAK_SESSION_SECRETS = new Set([
  'changeme',
  'change-me',
  'default',
  'development',
  'drop',
  'password',
  'secret',
  'session-secret',
  'test',
]);
const loginAttemptState = new Map();

export function validateAuthConfig(env) {
  const issues = [];

  if (!String(env.OWNER_USERNAME || '').trim()) {
    issues.push('OWNER_USERNAME is required');
  }

  if (!String(env.OWNER_PASSWORD || '').trim()) {
    issues.push('OWNER_PASSWORD is required');
  }

  if (!String(env.SESSION_SECRET || '').trim()) {
    issues.push('SESSION_SECRET is required');
  } else if (!isStrongSessionSecret(String(env.SESSION_SECRET))) {
    issues.push(`SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters and not a placeholder value`);
  }

  if (!getCliTokens(env).length) {
    issues.push('CLI_TOKENS must contain at least one bearer token');
  }

  const rateLimitEnvKeys = [
    'LOGIN_RATE_LIMIT_MAX_ATTEMPTS',
    'LOGIN_RATE_LIMIT_WINDOW_SECONDS',
    'LOGIN_RATE_LIMIT_BLOCK_SECONDS',
  ];

  for (const key of rateLimitEnvKeys) {
    const value = env[key];
    if (value === undefined || value === null || value === '') continue;
    if (parsePositiveInteger(value) === null) {
      issues.push(`${key} must be a positive integer`);
    }
  }

  return issues;
}

export function resetLoginRateLimitState() {
  loginAttemptState.clear();
}

export async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token && await matchesAny(token, getCliTokens(env), String(env.SESSION_SECRET || ''))) {
      return { ok: true, mode: 'cli' };
    }
  }

  const cookies = parseCookies(request.headers.get('cookie') || '');
  const session = cookies[SESSION_COOKIE];
  if (!session) return { ok: false };

  const payload = await verifySignedValue(session, String(env.SESSION_SECRET || ''));
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

  const activeBlock = getActiveLoginBlock(request, env);
  if (activeBlock.blocked) {
    return loginRateLimitedResponse(redirectTo, activeBlock.retryAfterSeconds);
  }

  const secret = String(env.SESSION_SECRET || '');
  const usernameOk = await secureEqual(username, String(env.OWNER_USERNAME || ''), secret);
  const passwordOk = await secureEqual(password, String(env.OWNER_PASSWORD || ''), secret);
  if (!usernameOk || !passwordOk) {
    const failure = recordFailedLoginAttempt(request, env);
    if (failure.blocked) {
      return loginRateLimitedResponse(redirectTo, failure.retryAfterSeconds);
    }

    return new Response(renderLoginPage({ error: 'Invalid credentials', redirect: redirectTo }), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  clearLoginAttempts(request);

  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = JSON.stringify({ u: username, exp: expires });
  const signed = await signValue(payload, String(env.SESSION_SECRET || ''));
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
  try {
    const index = input.lastIndexOf('.');
    if (index === -1) return null;
    const encoded = input.slice(0, index);
    const provided = input.slice(index + 1);
    const value = base64UrlDecode(encoded);
    const expected = await signText(value, secret);
    return timingSafeEqual(provided, expected) ? value : null;
  } catch {
    return null;
  }
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

// Compares secrets via their HMACs so the comparison takes the same time
// regardless of where (or whether) the inputs differ, including length.
async function secureEqual(provided, expected, secret) {
  const [a, b] = await Promise.all([signText(provided, secret), signText(expected, secret)]);
  return timingSafeEqual(a, b);
}

async function matchesAny(provided, candidates, secret) {
  const results = await Promise.all(candidates.map((candidate) => secureEqual(provided, candidate, secret)));
  return results.includes(true);
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

function isStrongSessionSecret(secret) {
  const normalized = String(secret || '').trim();
  if (normalized.length < MIN_SESSION_SECRET_LENGTH) return false;
  if (/^(.)\1+$/.test(normalized)) return false;
  if (WEAK_SESSION_SECRETS.has(normalized.toLowerCase())) return false;
  return true;
}

function getLoginRateLimitConfig(env) {
  return {
    maxAttempts: parsePositiveInteger(env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) ?? DEFAULT_LOGIN_RATE_LIMIT.maxAttempts,
    windowSeconds: parsePositiveInteger(env.LOGIN_RATE_LIMIT_WINDOW_SECONDS) ?? DEFAULT_LOGIN_RATE_LIMIT.windowSeconds,
    blockSeconds: parsePositiveInteger(env.LOGIN_RATE_LIMIT_BLOCK_SECONDS) ?? DEFAULT_LOGIN_RATE_LIMIT.blockSeconds,
  };
}

function getActiveLoginBlock(request, env, now = Date.now()) {
  const key = getLoginAttemptKey(request);
  cleanupLoginAttemptState(now);
  const entry = loginAttemptState.get(key);
  if (!entry) return { blocked: false };
  if (entry.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000)),
    };
  }
  const config = getLoginRateLimitConfig(env);
  if (entry.windowStartedAt + (config.windowSeconds * 1000) <= now) {
    loginAttemptState.delete(key);
  }
  return { blocked: false };
}

function recordFailedLoginAttempt(request, env, now = Date.now()) {
  const key = getLoginAttemptKey(request);
  const config = getLoginRateLimitConfig(env);
  const windowMs = config.windowSeconds * 1000;
  const blockMs = config.blockSeconds * 1000;
  let entry = loginAttemptState.get(key);

  if (!entry || entry.windowStartedAt + windowMs <= now || (entry.blockedUntil > 0 && entry.blockedUntil <= now)) {
    entry = {
      count: 0,
      windowStartedAt: now,
      blockedUntil: 0,
      lastSeenAt: now,
    };
  }

  entry.count += 1;
  entry.lastSeenAt = now;

  if (entry.count >= config.maxAttempts) {
    entry.blockedUntil = now + blockMs;
    loginAttemptState.set(key, entry);
    cleanupLoginAttemptState(now);
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil(blockMs / 1000)),
    };
  }

  loginAttemptState.set(key, entry);
  cleanupLoginAttemptState(now);
  return { blocked: false };
}

function clearLoginAttempts(request) {
  loginAttemptState.delete(getLoginAttemptKey(request));
}

function getLoginAttemptKey(request) {
  const forwarded = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')
    || 'unknown';
  const ip = forwarded.split(',')[0].trim() || 'unknown';
  return `ip:${ip}`;
}

function cleanupLoginAttemptState(now = Date.now()) {
  if (!loginAttemptState.size) return;

  for (const [key, entry] of loginAttemptState.entries()) {
    if (entry.blockedUntil > now) continue;
    if (entry.lastSeenAt + (DEFAULT_LOGIN_RATE_LIMIT.blockSeconds * 1000 * 2) > now) continue;
    loginAttemptState.delete(key);
  }
}

function loginRateLimitedResponse(redirectTo, retryAfterSeconds) {
  return new Response(renderLoginPage({
    error: `Too many sign-in attempts. Try again in ${formatRetryAfter(retryAfterSeconds)}.`,
    redirect: redirectTo,
  }), {
    status: 429,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': String(retryAfterSeconds),
    },
  });
}

function formatRetryAfter(retryAfterSeconds) {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds}s`;
  }

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${minutes}m`;
}

function parsePositiveInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}
