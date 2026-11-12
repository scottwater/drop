import { signText } from '../auth.js';

// Drop has one owner; every grant belongs to this subject.
export const OWNER = 'owner';

export const SCOPES = {
  read: 'drop:read',
  write: 'drop:write',
  delete: 'drop:delete',
  offline: 'offline_access',
};

export const ACCESS_TOKEN_SECONDS = 15 * 60;
// A renewable grant (offline_access) ends after this long unused; each refresh extends it.
export const RENEWABLE_GRANT_SECONDS = 30 * 24 * 60 * 60;

export const resourceFor = (origin) => `${origin}/mcp`;
export const resourceMetadataFor = (origin) => `${origin}/.well-known/oauth-protected-resource/mcp`;

// The OAuth issuer and MCP resource origin: PUBLIC_ORIGIN when set, otherwise
// the origin the request arrived at. Cloudflare only routes requests through
// hostnames bound to this Worker, so callers can't choose it freely. With
// several hostnames (custom domain + workers.dev) each acts as its own issuer,
// and tokens from one are refused by the other. Only loopback keeps http.
export function publicOrigin(env, request) {
  if (env.PUBLIC_ORIGIN) return String(env.PUBLIC_ORIGIN).replace(/\/$/, '');
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.protocol = 'https:';
  return url.origin;
}

// Stored in every grant's encrypted props and checked on each token exchange
// and MCP request. Changing the owner's username, password or SESSION_SECRET
// changes it, which disconnects every app at once.
export function credentialEpoch(env) {
  return signText(`mcp-epoch:${env.OWNER_USERNAME}:${env.OWNER_PASSWORD}`, String(env.SESSION_SECRET || ''));
}

export function mcpEnabled(env) {
  return Boolean(env.OAUTH_KV);
}
