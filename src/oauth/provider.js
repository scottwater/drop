import { OAuthAuthorizationServer, OAuthError, OAuthResourceServer } from '@cloudflare/workers-oauth-provider';
import { serveMcp } from '../mcp/handler.js';
import {
  ACCESS_TOKEN_SECONDS,
  credentialEpoch,
  RENEWABLE_GRANT_SECONDS,
  resourceFor,
  resourceMetadataFor,
  SCOPES,
} from './config.js';
import { registrationProblem } from './registration.js';

const cache = new Map();

// One authorization server and one protected resource (/mcp) per public
// origin. Clients, grants and tokens live in the OAUTH_KV namespace.
export function oauthRoles(origin) {
  const cached = cache.get(origin);
  if (cached) return cached;

  const resource = resourceFor(origin);
  const resourceMetadataUrl = resourceMetadataFor(origin);

  const authorizationServer = new OAuthAuthorizationServer({
    issuer: origin,
    resources: [resource],
    authorizeEndpoint: '/oauth/authorize',
    tokenEndpoint: '/oauth/token',
    // Dynamic registration (RFC 7591) so clients connect with the URL alone.
    // Registering grants nothing: the owner still has to approve each app.
    clientRegistrationEndpoint: '/oauth/register',
    clientRegistrationCallback: ({ clientMetadata }) => registrationProblem(clientMetadata),
    // Twice a renewable grant's idle lifetime. The provider renews a
    // registration at token requests once half of it has passed, so a client
    // in use always outlives the grants it holds.
    clientRegistrationTTL: 2 * RENEWABLE_GRANT_SECONDS,
    clientIdMetadataDocumentEnabled: true,
    scopesSupported: Object.values(SCOPES),
    accessTokenTTL: ACCESS_TOKEN_SECONDS,
    refreshTokenTTL: RENEWABLE_GRANT_SECONDS,
    refreshTokenIdleTTL: RENEWABLE_GRANT_SECONDS,
    async tokenExchangeCallback({ grantType, props, scope, env }) {
      if (props?.epoch !== (await credentialEpoch(env))) {
        throw new OAuthError('invalid_grant', { description: 'This connection is no longer authorized.' });
      }
      // The provider issues refresh tokens by default; only renewable grants get one.
      if (grantType === 'authorization_code' && !scope.includes(SCOPES.offline)) {
        return { refreshTokenTTL: 0 };
      }
      return {};
    },
    onError({ code, internal }) {
      console.warn(JSON.stringify({ event: 'oauth_error', code, reason: internal?.reason }));
    },
  });

  const resourceServer = new OAuthResourceServer({
    resourceMetadata: {
      resource,
      authorization_servers: [origin],
      bearer_methods_supported: ['header'],
      resource_name: 'Drop',
    },
    requiredScopes: [SCOPES.read],
    validateToken: (env) => (target, token) => authorizationServer.validateToken(target, token, env),
    handler: {
      fetch(request, env, ctx) {
        return serveMcp(request, env, { props: ctx.props, auth: ctx.auth, origin, resourceMetadataUrl });
      },
    },
  });

  const roles = { authorizationServer, resourceServer };
  cache.set(origin, roles);
  return roles;
}

export function oauthApi(env, origin) {
  return oauthRoles(origin).authorizationServer.getOAuthApi(env);
}
