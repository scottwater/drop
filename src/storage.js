import { inferContentType } from './content-type.js';
import { FOLDER_MARKER, joinPaths, normalizePath, publicHref, toFolderPrefix } from './path.js';

export async function objectExists(bucket, key) {
  const head = await bucket.head(key);
  return Boolean(head);
}

export async function getObject(bucket, key) {
  return bucket.get(key);
}

export async function putObject(bucket, key, body, contentType) {
  await bucket.put(key, body, {
    httpMetadata: {
      contentType: contentType || inferContentType(key),
    },
  });
}

export async function createFolder(bucket, path) {
  const normalized = normalizePath(path, { allowEmpty: false });
  const markerKey = folderMarkerKey(normalized);
  await putObject(bucket, markerKey, '', 'text/plain; charset=utf-8');
  return markerKey;
}

export function folderMarkerKey(path) {
  return joinPaths(path, FOLDER_MARKER);
}

export async function folderExists(bucket, path) {
  const normalized = normalizePath(path, { allowEmpty: false });
  if (await objectExists(bucket, folderMarkerKey(normalized))) return true;
  const listed = await bucket.list({ prefix: toFolderPrefix(normalized), limit: 1 });
  return listed.objects.length > 0 || listed.delimitedPrefixes.length > 0;
}

export async function listDirectory(bucket, path = '') {
  const normalized = normalizePath(path, { allowEmpty: true });
  const prefix = toFolderPrefix(normalized);
  const listed = await bucket.list({ prefix, delimiter: '/' });

  const folders = listed.delimitedPrefixes
    .map((value) => value.slice(prefix.length).replace(/\/$/, ''))
    .filter(Boolean)
    .map((name) => ({
      type: 'folder',
      name,
      path: joinPaths(normalized, name),
      href: publicHref(joinPaths(normalized, name)),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const files = listed.objects
    .filter((object) => object.key !== folderMarkerKey(normalized) && !object.key.endsWith(`/${FOLDER_MARKER}`))
    .map((object) => ({
      type: 'file',
      name: object.key.slice(prefix.length),
      path: object.key,
      href: publicHref(object.key),
      size: object.size,
      uploaded: object.uploaded,
      contentType: object.httpMetadata?.contentType || inferContentType(object.key),
    }))
    .filter((entry) => entry.name && !entry.name.includes('/'))
    .sort((a, b) => a.path.localeCompare(b.path));

  const hasEntries = folders.length > 0 || files.length > 0 || (normalized && (await objectExists(bucket, folderMarkerKey(normalized))));

  return {
    path: normalized,
    folders,
    files,
    hasEntries,
  };
}

export async function searchPaths(bucket, query) {
  const search = String(query || '').trim().toLowerCase();
  let cursor;
  const results = [];
  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    for (const object of page.objects) {
      if (object.key.endsWith(`/${FOLDER_MARKER}`) || object.key === FOLDER_MARKER) continue;
      if (!search || object.key.toLowerCase().includes(search)) {
        results.push({
          path: object.key,
          href: publicHref(object.key),
          size: object.size,
          uploaded: object.uploaded,
          contentType: object.httpMetadata?.contentType || inferContentType(object.key),
        });
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function collectConflicts(bucket, keys) {
  const checks = await Promise.all([...new Set(keys)].map(async (key) => ({ key, exists: await objectExists(bucket, key) })));
  return checks.filter((item) => item.exists).map((item) => item.key);
}

export async function maybeGetFolderIndex(bucket, path = '') {
  const normalized = normalizePath(path, { allowEmpty: true });
  const indexKey = joinPaths(normalized, 'index.html');
  const indexObject = await getObject(bucket, indexKey);
  return indexObject ? { key: indexKey, object: indexObject } : null;
}
