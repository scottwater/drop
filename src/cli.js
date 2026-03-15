#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const CONFIG_PATH = path.join(os.homedir(), '.config', 'drop', 'config.json');

async function main(argv) {
  const [command = 'help', ...rest] = argv;
  const args = parseArgs(rest);

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    case 'auth':
      await handleAuth(args);
      return;
    case 'upload':
      await handleUpload(args);
      return;
    case 'ls':
      await handleList(args);
      return;
    case 'search':
      await handleSearch(args);
      return;
    case 'mkdir':
      await handleMkdir(args);
      return;
    case 'rm':
    case 'delete':
      await handleDelete(args);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function handleAuth(args) {
  const host = args.flags.host || process.env.DROP_HOST;
  const token = args.flags.token || process.env.DROP_TOKEN;
  if (!host || !token) {
    throw new Error('Usage: drop auth --host https://drop.example.com --token <token>');
  }
  await writeConfig({ host: host.replace(/\/$/, ''), token });
  console.log(`Saved Drop CLI config to ${CONFIG_PATH}`);
}

async function handleUpload(args) {
  const source = args.positionals[0];
  if (!source) throw new Error('Usage: drop upload <file-or-directory> [--output path] [--force]');
  const auth = await getAuth(args.flags);
  const stats = await fs.stat(source);
  const files = stats.isDirectory()
    ? await collectDirectoryFiles(source)
    : [{ fullPath: source, relativePath: path.basename(source) }];

  const form = new FormData();
  if (args.flags.output) form.set('output', String(args.flags.output));
  if (args.flags.force || args.flags.override) form.set('force', 'true');
  for (const entry of files) {
    const buffer = await fs.readFile(entry.fullPath);
    form.append('files', new File([buffer], path.basename(entry.fullPath)));
    form.append('relativePaths', entry.relativePath.replace(/\\/g, '/'));
  }

  const response = await fetch(`${auth.host}/api/admin/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.token}` },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 409) {
    const list = (data.conflicts || []).join('\n');
    throw new Error(`Upload would overwrite existing paths. Re-run with --force or --override.\n\n${list}`);
  }
  if (!response.ok) {
    throw new Error(data.error || `Upload failed with status ${response.status}`);
  }

  console.log(`Uploaded ${files.length} source file(s).`);
  for (const key of data.saved || []) {
    console.log(`  → ${key}`);
  }
}

async function handleList(args) {
  const auth = await getAuth(args.flags);
  const prefix = args.positionals[0] || '';
  const response = await fetch(`${auth.host}/api/admin/list?prefix=${encodeURIComponent(prefix)}`, {
    headers: { authorization: `Bearer ${auth.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `List failed with status ${response.status}`);
  }
  console.log(data.path ? `${data.path}/` : '/');
  for (const folder of data.folders || []) {
    console.log(`  [dir]  ${folder.path}/`);
  }
  for (const file of data.files || []) {
    console.log(`  [file] ${file.path}`);
  }
}

async function handleSearch(args) {
  const query = args.positionals.join(' ').trim();
  if (!query) throw new Error('Usage: drop search <query>');
  const auth = await getAuth(args.flags);
  const response = await fetch(`${auth.host}/api/admin/search?q=${encodeURIComponent(query)}`, {
    headers: { authorization: `Bearer ${auth.token}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Search failed with status ${response.status}`);
  }
  for (const result of data.results || []) {
    console.log(result.path);
  }
}

async function handleMkdir(args) {
  const folderPath = args.positionals[0];
  if (!folderPath) throw new Error('Usage: drop mkdir <path>');
  const auth = await getAuth(args.flags);
  const response = await fetch(`${auth.host}/api/admin/folder`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ path: folderPath }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `mkdir failed with status ${response.status}`);
  }
  console.log(`Created folder: ${data.path}`);
}

async function handleDelete(args) {
  const targetPath = args.positionals[0];
  if (!targetPath) throw new Error('Usage: drop rm <path> [--folder]');
  const auth = await getAuth(args.flags);
  const type = args.flags.folder ? 'folder' : 'file';
  const response = await fetch(`${auth.host}/api/admin/delete`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ path: targetPath, type }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `delete failed with status ${response.status}`);
  }
  console.log(`Deleted ${type}: ${data.path}`);
}

async function getAuth(flags) {
  const config = await readConfig();
  const host = (flags.host || process.env.DROP_HOST || config.host || '').replace(/\/$/, '');
  const token = flags.token || process.env.DROP_TOKEN || config.token || '';
  if (!host || !token) {
    throw new Error('Missing host/token. Run `drop auth --host <url> --token <token>` or pass --host/--token.');
  }
  return { host, token };
}

async function collectDirectoryFiles(source) {
  const base = path.dirname(source);
  const entries = [];
  await walk(source, async (filePath) => {
    entries.push({
      fullPath: filePath,
      relativePath: path.relative(base, filePath),
    });
  });
  return entries;
}

async function walk(entryPath, onFile) {
  const stats = await fs.stat(entryPath);
  if (stats.isDirectory()) {
    const children = await fs.readdir(entryPath);
    for (const child of children) {
      await walk(path.join(entryPath, child), onFile);
    }
    return;
  }
  await onFile(entryPath);
}

function parseArgs(values) {
  const flags = {};
  const positionals = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }

    const [rawKey, inlineValue] = value.slice(2).split('=');
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
      continue;
    }

    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      flags[rawKey] = true;
      continue;
    }

    flags[rawKey] = next;
    index += 1;
  }

  return { flags, positionals };
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function writeConfig(config) {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function printHelp() {
  console.log(`Drop CLI

Commands:
  drop auth --host <url> --token <token>
  drop upload <file-or-directory> [--output path] [--force|--override]
  drop ls [prefix]
  drop search <query>
  drop mkdir <path>
  drop rm <path> [--folder]

Flags for all commands:
  --host <url>   Override configured host
  --token <tok>  Override configured API token
`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
