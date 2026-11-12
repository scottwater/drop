export const FOLDER_MARKER = '.drop-folder';

export function normalizePath(input, { allowEmpty = true } = {}) {
  const raw = String(input ?? '').replace(/\\/g, '/').trim();
  const decoded = safeDecode(raw);
  const collapsed = decoded.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');

  if (!collapsed) {
    if (allowEmpty) return '';
    throw new Error('Path cannot be empty');
  }

  const segments = collapsed.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      throw new Error('Parent path segments are not allowed');
    }
  }

  return segments.filter(Boolean).join('/');
}

export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function hasExtension(path) {
  return Boolean(sourceExtension(path));
}

export function sourceExtension(path) {
  const last = lastSegment(path);
  const match = /\.[A-Za-z0-9_-]+$/.exec(last);
  return match ? match[0] : '';
}

export function lastSegment(path) {
  return normalizePath(path || '', { allowEmpty: true }).split('/').filter(Boolean).at(-1) || '';
}

export function joinPaths(...parts) {
  return normalizePath(
    parts
      .filter((part) => part !== undefined && part !== null && part !== '')
      .join('/'),
    { allowEmpty: true }
  );
}

export function dirname(path) {
  const normalized = normalizePath(path, { allowEmpty: true });
  if (!normalized) return '';
  const parts = normalized.split('/');
  parts.pop();
  return parts.join('/');
}

export function isMarkdownPath(path) {
  return /\.md$/i.test(path);
}

export function companionHtmlPath(path) {
  return path.replace(/\.md$/i, '.html');
}

export function resolveSingleFileDestination(sourceName, output) {
  const sourcePath = normalizePath(sourceName, { allowEmpty: false });
  const outputValue = String(output ?? '').trim();
  if (!outputValue) return sourcePath;

  const normalizedOutput = normalizePath(outputValue, { allowEmpty: false });
  if (outputValue.endsWith('/') || !hasExtension(normalizedOutput)) {
    const extension = sourceExtension(sourcePath) || '.html';
    return joinPaths(normalizedOutput, `index${extension}`);
  }
  return normalizedOutput;
}

export function resolveDirectoryBase(output) {
  const outputValue = String(output ?? '').trim();
  if (!outputValue) return '';
  return normalizePath(outputValue, { allowEmpty: false });
}

export function toFolderPrefix(path) {
  const normalized = normalizePath(path, { allowEmpty: true });
  return normalized ? `${normalized}/` : '';
}

export function publicHref(path) {
  const normalized = normalizePath(path, { allowEmpty: true });
  if (!normalized) return '/';
  return `/${normalized.split('/').map(encodeURIComponent).join('/')}`;
}

// Folders always link with a trailing slash so relative URLs inside a
// published index.html (e.g. "style.css") resolve within the folder.
export function folderHref(path) {
  const href = publicHref(path);
  return href.endsWith('/') ? href : `${href}/`;
}

export function humanFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
