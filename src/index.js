import { authenticateRequest, handleLogin, handleLogout, requireOwner } from './auth.js';
import { inferContentType } from './content-type.js';
import { companionHtmlPath, dirname, isMarkdownPath, joinPaths, normalizePath, resolveDirectoryBase, resolveSingleFileDestination } from './path.js';
import { renderAdminPage, renderDirectoryPage, renderLoginPage } from './templates.js';
import { createFolder, collectConflicts, deletePath, getObject, listDirectory, maybeGetFolderIndex, putObject, searchPaths } from './storage.js';
import { renderMarkdownDocument } from './markdown.js';

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    if (pathname === '/__health') {
      return json({ ok: true, app: env.APP_NAME || 'Drop' });
    }

    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 });
    }

    if (pathname === '/login' && request.method === 'GET') {
      const auth = await authenticateRequest(request, env);
      if (auth.ok) {
        return redirect('/admin');
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

  const uploads = [];
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

    const buffer = await file.arrayBuffer();
    uploads.push({
      key: destination,
      body: buffer,
      contentType: file.type || inferContentType(destination),
    });

    if (isMarkdownPath(destination)) {
      const markdown = new TextDecoder().decode(buffer);
      uploads.push({
        key: companionHtmlPath(destination),
        body: renderMarkdownDocument({ markdown, title: destination }),
        contentType: 'text/html; charset=utf-8',
      });
    }
  }

  const conflicts = await collectConflicts(env.DROP_BUCKET, uploads.map((item) => item.key));
  if (conflicts.length && !force) {
    return json({ error: 'Conflict', conflicts }, 409);
  }

  for (const upload of uploads) {
    await putObject(env.DROP_BUCKET, upload.key, upload.body, upload.contentType);
  }

  const refreshPath = multiple
    ? (output ? resolveDirectoryBase(output) : currentPath)
    : dirname(uploads[0].key);

  return json({ ok: true, saved: uploads.map((item) => item.key), refreshPath });
}

async function servePublicPath(request, env) {
  const url = new URL(request.url);
  const requestedPath = normalizePath(url.pathname, { allowEmpty: true });

  if (requestedPath) {
    const object = await getObject(env.DROP_BUCKET, requestedPath);
    if (object) {
      return objectResponse(object, requestedPath);
    }
  }

  const index = await maybeGetFolderIndex(env.DROP_BUCKET, requestedPath);
  if (index) {
    return objectResponse(index.object, index.key);
  }

  const listing = await listDirectory(env.DROP_BUCKET, requestedPath);
  if (listing.hasEntries || requestedPath === '') {
    return html(renderDirectoryPage({
      path: requestedPath,
      folders: requestedPath === '' ? [] : listing.folders,
      files: requestedPath === '' ? [] : listing.files,
      isRoot: requestedPath === '',
    }));
  }

  return new Response('Not found', { status: 404 });
}

function objectResponse(object, key) {
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
  return new Response(object.body, { headers });
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
