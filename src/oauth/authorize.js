import { AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider';
import { authenticateRequest } from '../auth.js';
import { renderConsentPage, renderMessagePage } from '../templates.js';
import { credentialEpoch, OWNER, publicOrigin, SCOPES } from './config.js';
import { oauthApi } from './provider.js';

// Scopes the owner can tick on the consent page. Read is always granted.
const OPTIONAL_SCOPES = [SCOPES.write, SCOPES.delete, SCOPES.offline];

function page(status, markup, { headers = new Headers(), formTargets = [] } = {}) {
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  // Approving redirects the form post to the client's callback, so
  // form-action must allow that origin as well as this one.
  headers.set(
    'content-security-policy',
    `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'${formTargets.map((target) => ` ${target}`).join('')}; frame-ancestors 'none'; base-uri 'none'`,
  );
  headers.set('x-frame-options', 'DENY');
  // Browsers send "Origin: null" on form posts under no-referrer, which the
  // same-origin check would refuse. same-origin sends nothing to other sites.
  headers.set('referrer-policy', 'same-origin');
  return new Response(markup, { status, headers });
}

function problem(status, title, message) {
  return page(status, renderMessagePage({ title, message, hint: 'Go back to the app and start connecting again.' }));
}

function isSameOrigin(request, env) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && (origin === new URL(request.url).origin || origin === publicOrigin(env, request));
}

async function ownerSignedIn(request, env) {
  const auth = await authenticateRequest(request, env);
  return auth.ok && auth.mode === 'web';
}

async function decide(request, env, oauth) {
  if (!isSameOrigin(request, env)) {
    return problem(403, 'This request can’t continue', 'The form was sent from another site.');
  }
  if (!(await ownerSignedIn(request, env))) {
    return problem(401, 'You were signed out', 'Your Drop session ended before you answered.');
  }
  const fields = await request.formData();
  const handle = String(fields.get('handle') || '');

  if (fields.get('decision') !== 'approve') {
    const denied = await oauth.denyConsent(request, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }

  // The authorization request comes back from server-side storage, not the form.
  const approved = await oauth.approveConsent(request, handle);
  const ticked = new Set(fields.getAll('scope').map(String));
  const scope = [SCOPES.read, ...OPTIONAL_SCOPES.filter((value) => ticked.has(value))];
  const details = await oauth.describeConsent(approved.request);
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: OWNER,
    metadata: { clientName: details.clientName.slice(0, 200) },
    scope,
    props: { epoch: await credentialEpoch(env) },
  });
  approved.headers.set('location', redirectTo);
  return new Response(null, { status: 302, headers: approved.headers });
}

// GET shows the consent page (sending a signed-out owner through /login
// first); POST records the owner's decision.
export async function authorize(request, env) {
  if (!['GET', 'POST'].includes(request.method)) {
    return problem(405, 'Not allowed', 'Use the link from your app.');
  }
  const oauth = oauthApi(env, publicOrigin(env, request));
  try {
    if (request.method === 'POST') return await decide(request, env, oauth);

    // Validate the client, redirect URI, PKCE and resource before showing anything.
    const authRequest = await oauth.parseAuthRequest(request);
    if (!(await ownerSignedIn(request, env))) {
      const url = new URL(request.url);
      return new Response(null, {
        status: 302,
        headers: { location: `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`, 'cache-control': 'no-store' },
      });
    }
    const details = await oauth.describeConsent(authRequest);
    const transaction = await oauth.beginConsent(authRequest);
    return page(200, renderConsentPage({ details, handle: transaction.handle, scopes: SCOPES }), {
      headers: transaction.headers,
      formTargets: [new URL(details.redirectUri).origin],
    });
  } catch (error) {
    // Only parseAuthRequest attaches a redirect, once the client and its exact redirect URI check out.
    if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
    if (error instanceof AuthorizationError) return problem(400, 'This request can’t continue', error.description);
    if (error instanceof CimdFetchError) return problem(400, 'This app could not be verified', 'Its details could not be loaded.');
    throw error;
  }
}
