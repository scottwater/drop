import { resolveContentType } from './content-type.js';
import { renderMarkdownDocument } from './markdown.js';
import { companionHtmlPath, isMarkdownPath } from './path.js';
import { collectConflicts, eachLimited, putObject } from './storage.js';

// Paths the Worker answers itself, so a file stored there could never be
// opened. Compared against the first segment (or exact path).
const RESERVED = ['admin', 'login', 'logout', 'api', 'mcp', 'oauth', '__health', '__og', 'favicon.ico', 'favicon.svg'];

export function reservedPathProblem(key) {
  const first = key.split('/')[0];
  if (RESERVED.includes(first)) return `"${first}" is reserved by Drop; choose another path.`;
  if (key.startsWith('.well-known/oauth-')) return 'Paths under .well-known/oauth- are reserved by Drop.';
  return null;
}

// What publishing one file writes: the file itself and, for Markdown, a
// rendered .html page beside it.
export function publishEntries(key, body, providedType) {
  const entries = [{ key, body, contentType: resolveContentType(key, providedType) }];
  if (isMarkdownPath(key)) {
    const markdown = typeof body === 'string' ? body : new TextDecoder().decode(body);
    entries.push({
      key: companionHtmlPath(key),
      body: renderMarkdownDocument({ markdown, title: key }),
      contentType: 'text/html; charset=utf-8',
    });
  }
  return entries;
}

// Writes entries unless one would replace an existing object and `force` is
// off. Returns the conflicting keys (nothing written) or the saved keys.
export async function publish(bucket, entries, { force = false } = {}) {
  const keys = entries.map((entry) => entry.key);
  const conflicts = force ? [] : await collectConflicts(bucket, keys);
  if (conflicts.length) return { conflicts, saved: [] };
  await eachLimited(entries, (entry) => putObject(bucket, entry.key, entry.body, entry.contentType));
  return { conflicts: [], saved: keys };
}
