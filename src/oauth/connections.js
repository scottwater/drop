import { mcpEnabled, OWNER, publicOrigin } from './config.js';
import { oauthApi } from './provider.js';

// Apps the owner has approved, for the admin's Connected apps list.
export async function listConnections(request, env) {
  if (!mcpEnabled(env)) return [];
  const oauth = oauthApi(env, publicOrigin(env, request));
  const connections = [];
  let cursor;
  do {
    const page = await oauth.listUserGrants(OWNER, { cursor });
    for (const grant of page.items) {
      const client = await oauth.lookupClient(grant.clientId).catch(() => null);
      connections.push({
        id: grant.id,
        name: grant.metadata?.clientName || client?.clientName || grant.clientId,
        scopes: grant.scope,
        createdAt: grant.createdAt,
        expiresAt: grant.expiresAt ?? null,
      });
    }
    cursor = page.cursor;
  } while (cursor);
  return connections.sort((a, b) => b.createdAt - a.createdAt);
}

// Revoking a grant deletes its access and refresh tokens immediately.
export async function revokeConnection(request, env, id) {
  if (!id) throw Response.json({ error: 'Connection id is required.' }, { status: 400 });
  await oauthApi(env, publicOrigin(env, request)).revokeGrant(id, OWNER);
}
