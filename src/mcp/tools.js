import { z } from 'zod';
import { SCOPES } from '../oauth/config.js';
import { folderHref, normalizePath, publicHref } from '../path.js';
import { publish, publishEntries, reservedPathProblem } from '../publish.js';
import { createFolder, deletePath, listDirectory, searchPaths } from '../storage.js';

// The largest file read_file returns inline. Bigger files are left to their URL.
export const MAX_READ_BYTES = 1_000_000;

// A failure the model can read and act on, returned as a tool error.
export class ToolError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const pathInput = (description) => z.string().min(1).max(1024).describe(description);

const fileEntry = z.object({
  name: z.string(),
  path: z.string(),
  url: z.string(),
  size: z.number(),
  contentType: z.string(),
  uploaded: z.string().nullable(),
});

const folderEntry = z.object({ name: z.string(), path: z.string(), url: z.string() });

function toPath(input, { allowEmpty = false } = {}) {
  try {
    return normalizePath(input, { allowEmpty });
  } catch (error) {
    throw new ToolError('INVALID_PATH', error.message);
  }
}

function fileResult(origin, file) {
  return {
    name: file.name ?? file.path.split('/').at(-1),
    path: file.path,
    url: origin + publicHref(file.path),
    size: file.size ?? 0,
    contentType: file.contentType || 'application/octet-stream',
    uploaded: file.uploaded ? new Date(file.uploaded).toISOString() : null,
  };
}

function isTextType(contentType) {
  return /^text\/|json|xml|javascript|ecmascript|svg|markdown|yaml|toml|csv|charset=/i.test(contentType);
}

function decodeContent(content, encoding) {
  if (encoding === 'utf8') return content;
  try {
    return Uint8Array.from(atob(content.replace(/\s+/g, '')), (char) => char.charCodeAt(0));
  } catch {
    throw new ToolError('INVALID_CONTENT', 'content is not valid base64.');
  }
}

function encodeBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export const TOOLS = {
  list_files: {
    title: 'List files',
    description: 'List the folders and files directly inside a folder. Use an empty path for the top level.',
    scopes: [SCOPES.read],
    annotations: { readOnlyHint: true, openWorldHint: false },
    input: z.object({ path: z.string().max(1024).default('').describe('Folder path, e.g. "notes" or "" for the top level.') }),
    output: z.object({ path: z.string(), url: z.string(), folders: z.array(folderEntry), files: z.array(fileEntry) }),
    async run({ bucket, origin }, { path }) {
      const folder = toPath(path, { allowEmpty: true });
      const listing = await listDirectory(bucket, folder);
      if (folder && !listing.hasEntries) throw new ToolError('NOT_FOUND', `No folder at ${folder}.`);
      return {
        path: folder,
        url: origin + folderHref(folder),
        folders: listing.folders.map((entry) => ({ name: entry.name, path: entry.path, url: origin + folderHref(entry.path) })),
        files: listing.files.map((file) => fileResult(origin, file)),
      };
    },
  },

  search_files: {
    title: 'Search files',
    description: 'Find files whose path contains the query (case-insensitive).',
    scopes: [SCOPES.read],
    annotations: { readOnlyHint: true, openWorldHint: false },
    input: z.object({
      query: z.string().min(1).max(256).describe('Text to look for in file paths.'),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    output: z.object({ results: z.array(fileEntry), truncated: z.boolean() }),
    async run({ bucket, origin }, { query, limit }) {
      const matches = await searchPaths(bucket, query);
      return { results: matches.slice(0, limit).map((file) => fileResult(origin, file)), truncated: matches.length > limit };
    },
  },

  read_file: {
    title: 'Read a file',
    description: `Read one file. Text comes back as utf8; other files as base64. Files over ${MAX_READ_BYTES} bytes are not returned inline; use their url instead.`,
    scopes: [SCOPES.read],
    annotations: { readOnlyHint: true, openWorldHint: false },
    input: z.object({ path: pathInput('File path, e.g. "notes/post.md".') }),
    output: fileEntry.extend({ encoding: z.enum(['utf8', 'base64']), content: z.string() }),
    async run({ bucket, origin }, { path }) {
      const key = toPath(path);
      const head = await bucket.head(key);
      if (!head) throw new ToolError('NOT_FOUND', `No file at ${key}.`);
      const file = fileResult(origin, { path: key, size: head.size, uploaded: head.uploaded, contentType: head.httpMetadata?.contentType });
      if (head.size > MAX_READ_BYTES) {
        throw new ToolError('FILE_TOO_LARGE', `${key} is ${head.size} bytes; read_file returns up to ${MAX_READ_BYTES}. Open ${file.url} instead.`, { url: file.url });
      }
      const object = await bucket.get(key);
      if (!object) throw new ToolError('NOT_FOUND', `No file at ${key}.`);
      const bytes = new Uint8Array(await object.arrayBuffer());
      return isTextType(file.contentType)
        ? { ...file, encoding: 'utf8', content: new TextDecoder().decode(bytes) }
        : { ...file, encoding: 'base64', content: encodeBase64(bytes) };
    },
  },

  write_file: {
    title: 'Write a file',
    description: 'Create a file, or replace one when overwrite is true, and publish it at a public URL. Folders are created as needed. Writing a .md file also publishes a rendered .html page beside it.',
    scopes: [SCOPES.read, SCOPES.write],
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    input: z.object({
      path: pathInput('File path including its name and extension, e.g. "notes/post.md".'),
      content: z.string().describe('File contents: plain text for utf8, or base64 for binary files.'),
      encoding: z.enum(['utf8', 'base64']).default('utf8'),
      contentType: z.string().max(200).optional().describe('MIME type. Inferred from the extension when omitted.'),
      overwrite: z.boolean().default(false).describe('Replace existing files at these paths. Only when the owner asked to replace them.'),
    }),
    output: z.object({ path: z.string(), url: z.string(), written: z.array(z.object({ path: z.string(), url: z.string() })) }),
    async run({ bucket, origin }, { path, content, encoding, contentType, overwrite }) {
      if (path.trim().endsWith('/')) throw new ToolError('INVALID_PATH', 'path must name a file, not a folder.');
      const key = toPath(path);
      const reserved = reservedPathProblem(key);
      if (reserved) throw new ToolError('INVALID_PATH', reserved);
      const entries = publishEntries(key, decodeContent(content, encoding), contentType);
      const { conflicts, saved } = await publish(bucket, entries, { force: overwrite });
      if (conflicts.length) {
        throw new ToolError('ALREADY_EXISTS', `Already exists: ${conflicts.join(', ')}. Pass overwrite: true only if the owner wants them replaced.`, { paths: conflicts });
      }
      return { path: key, url: origin + publicHref(key), written: saved.map((written) => ({ path: written, url: origin + publicHref(written) })) };
    },
  },

  create_folder: {
    title: 'Create a folder',
    description: 'Create an empty folder. Not needed before write_file, which creates folders itself.',
    scopes: [SCOPES.read, SCOPES.write],
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    input: z.object({ path: pathInput('Folder path, e.g. "notes/drafts".') }),
    output: z.object({ path: z.string(), url: z.string() }),
    async run({ bucket, origin }, { path }) {
      const folder = toPath(path);
      const reserved = reservedPathProblem(folder);
      if (reserved) throw new ToolError('INVALID_PATH', reserved);
      await createFolder(bucket, folder);
      return { path: folder, url: origin + folderHref(folder) };
    },
  },

  delete_file: {
    title: 'Delete a file',
    description: 'Delete one file. Deleting a .md file leaves its generated .html page; delete that too if it should go.',
    scopes: [SCOPES.read, SCOPES.delete],
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    input: z.object({ path: pathInput('File path, e.g. "notes/post.md".') }),
    output: z.object({ path: z.string(), deleted: z.boolean() }),
    async run({ bucket }, { path }) {
      const key = toPath(path);
      if (!(await bucket.head(key))) throw new ToolError('NOT_FOUND', `No file at ${key}.`);
      await deletePath(bucket, key, 'file');
      return { path: key, deleted: true };
    },
  },

  delete_folder: {
    title: 'Delete a folder',
    description: 'Delete a folder and everything inside it.',
    scopes: [SCOPES.read, SCOPES.delete],
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    input: z.object({ path: pathInput('Folder path, e.g. "notes/drafts".') }),
    output: z.object({ path: z.string(), deletedFiles: z.number() }),
    async run({ bucket }, { path }) {
      const folder = toPath(path);
      const listing = await listDirectory(bucket, folder);
      if (!listing.hasEntries) throw new ToolError('NOT_FOUND', `No folder at ${folder}.`);
      const { deleted } = await deletePath(bucket, folder, 'folder');
      return { path: folder, deletedFiles: deleted.filter((key) => !key.endsWith('/.drop-folder')).length };
    },
  },
};
