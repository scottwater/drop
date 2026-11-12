// Policy and throttling for dynamic client registration (/oauth/register).

const ALLOWED_GRANT_TYPES = new Set(['authorization_code', 'refresh_token']);

// Registrations allowed per hour, per address and across all addresses.
export const REGISTRATIONS_PER_ADDRESS = 10;
export const REGISTRATIONS_OVERALL = 100;
const HOUR_SECONDS = 60 * 60;

// The provider already requires PKCE, public clients and an https or loopback
// redirect. Restating the grant types keeps a future provider change from
// opening other grants to clients anyone can register.
export function registrationProblem(metadata) {
  const grantTypes = Array.isArray(metadata.grant_types) ? metadata.grant_types : [];
  const unsupported = grantTypes.find((type) => !ALLOWED_GRANT_TYPES.has(String(type)));
  if (unsupported !== undefined) {
    return {
      description: `The grant type ${JSON.stringify(unsupported)} is not supported. Use authorization_code and refresh_token.`,
    };
  }
  return undefined;
}

// Counts a registration attempt in KV and returns seconds to wait, or 0. KV is
// eventually consistent, so this is a soft limit: it bounds how fast anyone
// can fill the client store, which the owner's consent still guards.
export async function registrationWait(kv, ip, now = Date.now()) {
  const hour = Math.floor(now / 1000 / HOUR_SECONDS);
  const retryAfter = (hour + 1) * HOUR_SECONDS - Math.floor(now / 1000);
  for (const [key, limit] of [[`drop:register:${ip}:${hour}`, REGISTRATIONS_PER_ADDRESS], [`drop:register:*:${hour}`, REGISTRATIONS_OVERALL]]) {
    const count = Number(await kv.get(key)) || 0;
    if (count >= limit) return retryAfter;
    await kv.put(key, String(count + 1), { expirationTtl: HOUR_SECONDS + 60 });
  }
  return 0;
}
