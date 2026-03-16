const TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.markdown', 'text/markdown; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.text', 'text/plain; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.ico', 'image/x-icon'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.ogv', 'video/ogg'],
  ['.mov', 'video/quicktime'],
  ['.m4v', 'video/x-m4v'],
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.flac', 'audio/flac'],
  ['.aac', 'audio/aac'],
  ['.pdf', 'application/pdf'],
  ['.zip', 'application/zip'],
  ['.wasm', 'application/wasm'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf']
]);

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const GENERIC_TYPES = new Set([
  DEFAULT_CONTENT_TYPE,
  'binary/octet-stream',
]);

export function inferContentType(path) {
  const match = /\.[A-Za-z0-9]+$/.exec(path || '');
  if (!match) return DEFAULT_CONTENT_TYPE;
  return TYPES.get(match[0].toLowerCase()) || DEFAULT_CONTENT_TYPE;
}

export function resolveContentType(path, providedType) {
  const normalizedProvidedType = normalizeContentType(providedType);
  const inferredType = inferContentType(path);

  if (!normalizedProvidedType) {
    return inferredType;
  }

  if (GENERIC_TYPES.has(normalizedProvidedType) && inferredType !== DEFAULT_CONTENT_TYPE) {
    return inferredType;
  }

  return normalizedProvidedType;
}

function normalizeContentType(value) {
  return String(value || '').trim().toLowerCase();
}
