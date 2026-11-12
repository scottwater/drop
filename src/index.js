import { authenticateRequest, handleLogin, handleLogout, requireOwner, sanitizeRedirect, validateAuthConfig } from './auth.js';
import { inferContentType } from './content-type.js';
import { listConnections, revokeConnection } from './oauth/connections.js';
import { isOAuthPath, oauthRoute } from './oauth/routes.js';
import { dirname, joinPaths, normalizePath, resolveDirectoryBase, resolveSingleFileDestination } from './path.js';
import { publish, publishEntries, reservedPathProblem } from './publish.js';
import { renderAdminPage, renderDirectoryPage, renderLoginPage, renderNotFoundPage } from './templates.js';
import { createFolder, deletePath, getObject, listDirectory, maybeGetFolderIndex, searchPaths } from './storage.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

const validatedEnvironments = new WeakSet();

// Stand-in for callers (tests) that don't pass a Workers ExecutionContext.
const NO_CONTEXT = { waitUntil() {}, passThroughOnException() {} };

export async function handleRequest(request, env, ctx = NO_CONTEXT) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    ensureAuthConfiguration(env);

    if (isOAuthPath(pathname)) {
      return await oauthRoute(request, env, ctx);
    }

    if (pathname === '/__health') {
      return json({ ok: true, app: env.APP_NAME || 'Drop' });
    }

    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    if (pathname === '/login' && request.method === 'GET') {
      const auth = await authenticateRequest(request, env);
      if (auth.ok && auth.mode === 'web') {
        return redirect(sanitizeRedirect(url.searchParams.get('redirect') || '/admin'));
      }
      return html(renderLoginPage({ redirect: url.searchParams.get('redirect') || '/admin' }));
    }

    if (pathname === '/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (pathname === '/logout' && request.method === 'POST') {
      return handleLogout(request);
    }

    if (pathname === '/admin' && request.method === 'GET') {
      const auth = await authenticateRequest(request, env);
      if (!auth.ok || auth.mode !== 'web') {
        return redirect(`/login?redirect=${encodeURIComponent('/admin')}`);
      }
      return html(renderAdminPage());
    }

    if (pathname === '/api/admin/list' && request.method === 'GET') {
      await requireOwner(request, env);
      const prefix = normalizePath(url.searchParams.get('prefix') || '', { allowEmpty: true });
      const listing = await listDirectory(env.DROP_BUCKET, prefix);
      return json(listing);
    }

    if (pathname === '/api/admin/search' && request.method === 'GET') {
      await requireOwner(request, env);
      const q = url.searchParams.get('q') || '';
      const results = await searchPaths(env.DROP_BUCKET, q);
      return json({ results: results.slice(0, 200) });
    }

    if (pathname === '/api/admin/folder' && request.method === 'POST') {
      await requireOwner(request, env);
      const body = await request.json();
      const path = normalizePath(body.path, { allowEmpty: false });
      await createFolder(env.DROP_BUCKET, path);
      return json({ ok: true, path });
    }

    if (pathname === '/api/admin/upload' && request.method === 'POST') {
      await requireOwner(request, env);
      return handleUpload(request, env);
    }

    if (pathname === '/api/admin/delete' && request.method === 'POST') {
      await requireOwner(request, env);
      const body = await request.json();
      const path = normalizePath(body.path, { allowEmpty: false });
      const type = body.type === 'folder' ? 'folder' : 'file';
      const result = await deletePath(env.DROP_BUCKET, path, type);
      return json({ ok: true, path, type, deleted: result.deleted });
    }

    if (pathname === '/api/admin/connections' && request.method === 'GET') {
      await requireOwner(request, env);
      return json({ connections: await listConnections(request, env) });
    }

    if (pathname === '/api/admin/connections/revoke' && request.method === 'POST') {
      await requireOwner(request, env);
      const body = await request.json();
      await revokeConnection(request, env, String(body.id || ''));
      return json({ ok: true });
    }

    return servePublicPath(request, env);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return json({ error: error.message || 'Unexpected error' }, 500);
  }
}

async function handleUpload(request, env) {
  const form = await request.formData();
  const force = String(form.get('force') || 'false') === 'true';
  const output = String(form.get('output') || '').trim();
  const currentPath = normalizePath(String(form.get('currentPath') || ''), { allowEmpty: true });
  const files = form.getAll('files').filter((value) => typeof value === 'object' && 'arrayBuffer' in value);
  const relativePaths = form.getAll('relativePaths').map((value) => String(value || ''));

  if (!files.length) {
    return json({ error: 'No files provided.' }, 400);
  }

  const entries = [];
  const multiple = files.length > 1 || relativePaths.some((value) => value.includes('/'));
  const baseForMultiple = output ? resolveDirectoryBase(output) : currentPath;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const relativePath = normalizePath(relativePaths[index] || file.name, { allowEmpty: false });
    const destination = multiple
      ? joinPaths(baseForMultiple, relativePath)
      : output
        ? resolveSingleFileDestination(file.name, output)
        : joinPaths(currentPath, file.name);

    const problem = reservedPathProblem(destination);
    if (problem) {
      return json({ error: problem }, 400);
    }
    entries.push(...publishEntries(destination, await file.arrayBuffer(), file.type));
  }

  const { conflicts, saved } = await publish(env.DROP_BUCKET, entries, { force });
  if (conflicts.length) {
    return json({ error: 'Conflict', conflicts }, 409);
  }

  const refreshPath = multiple
    ? (output ? resolveDirectoryBase(output) : currentPath)
    : dirname(entries[0].key);

  return json({ ok: true, saved, refreshPath });
}

async function servePublicPath(request, env) {
  const url = new URL(request.url);
  const requestedPath = normalizePath(url.pathname, { allowEmpty: true });
  const conditional = request.method === 'GET' ? request.headers : undefined;

  if (requestedPath) {
    const object = await getObject(env.DROP_BUCKET, requestedPath, conditional);
    if (object) {
      return objectResponse(object, requestedPath, request);
    }
  }

  // Folders must be addressed with a trailing slash so relative links inside
  // an index.html resolve against the folder rather than its parent.
  const needsSlash = requestedPath !== '' && !url.pathname.endsWith('/');

  const index = await maybeGetFolderIndex(env.DROP_BUCKET, requestedPath, needsSlash ? undefined : conditional);
  if (index) {
    return needsSlash ? folderRedirect(url) : objectResponse(index.object, index.key, request);
  }

  if (requestedPath === '') {
    return html(renderDirectoryPage({ isRoot: true }));
  }

  const listing = await listDirectory(env.DROP_BUCKET, requestedPath);
  if (listing.hasEntries) {
    if (needsSlash) return folderRedirect(url);
    return html(renderDirectoryPage({
      path: requestedPath,
      folders: listing.folders,
      files: listing.files,
    }));
  }

  return html(renderNotFoundPage(), 404);
}

function folderRedirect(url) {
  return redirect(`${url.pathname}/${url.search}`);
}

function objectResponse(object, key, request) {
  const headers = new Headers();
  if (typeof object.writeHttpMetadata === 'function') {
    object.writeHttpMetadata(headers);
  }
  if (!headers.get('content-type')) {
    headers.set('content-type', inferContentType(key));
  }
  if (object.httpEtag) {
    headers.set('etag', object.httpEtag);
  }
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');

  // R2 returns an object without a body when an If-None-Match / If-Modified-Since
  // precondition says the client's copy is current.
  if (!('body' in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }

  if (object.range && request.headers.has('range')) {
    const { offset, length } = resolveRange(object.range, object.size);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    return new Response(object.body, { status: 206, headers });
  }

  return new Response(object.body, { headers });
}

function resolveRange(range, size) {
  if ('suffix' in range && range.suffix !== undefined) {
    const length = Math.min(range.suffix, size);
    return { offset: size - length, length };
  }
  const offset = range.offset ?? 0;
  const length = range.length ?? size - offset;
  return { offset, length };
}

function ensureAuthConfiguration(env) {
  if (validatedEnvironments.has(env)) {
    return;
  }

  const issues = validateAuthConfig(env);
  if (issues.length) {
    throw new Error(`Invalid auth configuration: ${issues.join('; ')}`);
  }

  validatedEnvironments.add(env);
}

function html(markup, status = 200) {
  return new Response(markup, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { location },
  });
}
