import { inferContentType } from './content-type.js';
import { FOLDER_MARKER, folderHref, joinPaths, normalizePath, publicHref, toFolderPrefix } from './path.js';

const R2_DELETE_BATCH = 1000;
const CONCURRENCY = 8;

export async function objectExists(bucket, key) {
  const head = await bucket.head(key);
  return Boolean(head);
}

// Pass the request headers to get Range (206) and If-None-Match (304)
// handling from R2. Falls back to a full read if R2 rejects the range.
export async function getObject(bucket, key, requestHeaders) {
  if (!requestHeaders) return bucket.get(key);
  const options = { onlyIf: requestHeaders };
  if (requestHeaders.has('range')) options.range = requestHeaders;
  try {
    return await bucket.get(key, options);
  } catch (error) {
    if (!options.range) throw error;
    return bucket.get(key, { onlyIf: requestHeaders });
  }
}

// Runs fn over items with bounded parallelism.
export async function eachLimited(items, fn, limit = CONCURRENCY) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
      href: folderHref(joinPaths(normalized, name)),
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
  const checks = await eachLimited([...new Set(keys)], async (key) => ({ key, exists: await objectExists(bucket, key) }));
  return checks.filter((item) => item.exists).map((item) => item.key);
}

export async function maybeGetFolderIndex(bucket, path = '', requestHeaders) {
  const normalized = normalizePath(path, { allowEmpty: true });
  const indexKey = joinPaths(normalized, 'index.html');
  const indexObject = await getObject(bucket, indexKey, requestHeaders);
  return indexObject ? { key: indexKey, object: indexObject } : null;
}

export async function listAllKeys(bucket, prefix = '') {
  const normalizedPrefix = prefix ? toFolderPrefix(normalizePath(prefix, { allowEmpty: false })) : '';
  let cursor;
  const keys = [];
  do {
    const page = await bucket.list({ prefix: normalizedPrefix, cursor, limit: 1000 });
    for (const object of page.objects) {
      keys.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return keys;
}

export async function deletePath(bucket, path, type) {
  const normalized = normalizePath(path, { allowEmpty: false });

  if (type === 'file') {
    await bucket.delete(normalized);
    return { deleted: [normalized] };
  }

  const keys = [...new Set([...(await listAllKeys(bucket, normalized)), folderMarkerKey(normalized)])];
  for (let index = 0; index < keys.length; index += R2_DELETE_BATCH) {
    await bucket.delete(keys.slice(index, index + R2_DELETE_BATCH));
  }
  return { deleted: keys };
}
