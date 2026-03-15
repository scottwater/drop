#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [command = 'deploy', ...passthroughArgs] = process.argv.slice(2);
const supportedCommands = new Set(['deploy', 'dev']);

if (!supportedCommands.has(command)) {
  console.error(`Unsupported Wrangler command: ${command}. Expected one of: ${Array.from(supportedCommands).join(', ')}`);
  process.exit(1);
}

const routePattern = process.env.DROP_ROUTE_PATTERN?.trim();
const routeZoneName = process.env.DROP_ROUTE_ZONE_NAME?.trim();
const bucketName = process.env.DROP_BUCKET_NAME?.trim();
const previewBucketName = process.env.DROP_PREVIEW_BUCKET_NAME?.trim();
const projectRoot = process.cwd();
const baseConfigPath = join(projectRoot, 'wrangler.toml');
const tempConfigPath = join(projectRoot, '.wrangler.generated.toml');

if (!bucketName) {
  console.error('DROP_BUCKET_NAME is required. Set it in your shell or .mise.toml before running Wrangler commands.');
  process.exit(1);
}

if (!previewBucketName) {
  console.error('DROP_PREVIEW_BUCKET_NAME is required. Set it in your shell or .mise.toml before running Wrangler commands.');
  process.exit(1);
}

if ((routePattern && !routeZoneName) || (!routePattern && routeZoneName)) {
  console.error('DROP_ROUTE_PATTERN and DROP_ROUTE_ZONE_NAME must either both be set or both be unset.');
  process.exit(1);
}

if (routePattern && /^https?:\/\//i.test(routePattern)) {
  console.error('DROP_ROUTE_PATTERN must be a Cloudflare route pattern like "drops.example.com/*", not a full URL.');
  process.exit(1);
}

const baseConfig = readFileSync(baseConfigPath, 'utf8');
const config = injectDeployConfig(baseConfig, {
  bucketName,
  previewBucketName,
  routePattern,
  routeZoneName,
});
writeFileSync(tempConfigPath, config);

const args = ['wrangler', command, '--config', tempConfigPath, ...passthroughArgs];
const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });

child.on('exit', (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  cleanup();
  console.error(error);
  process.exit(1);
});

function injectDeployConfig(base, options) {
  const sections = [];

  if (options.routePattern && options.routeZoneName) {
    sections.push([
      'routes = [',
      `  { pattern = ${toTomlString(options.routePattern)}, zone_name = ${toTomlString(options.routeZoneName)} }`,
      ']',
    ].join('\n'));
  }

  sections.push([
    '[[r2_buckets]]',
    'binding = "DROP_BUCKET"',
    `bucket_name = ${toTomlString(options.bucketName)}`,
    `preview_bucket_name = ${toTomlString(options.previewBucketName)}`,
  ].join('\n'));

  const injection = `${sections.join('\n\n')}\n\n`;

  if (base.includes('\n[vars]\n')) {
    return base.replace('\n[vars]\n', `\n${injection}[vars]\n`);
  }

  return `${base.trimEnd()}\n\n${injection}`;
}

function toTomlString(value) {
  return JSON.stringify(value);
}

function cleanup() {
  try {
    unlinkSync(tempConfigPath);
  } catch {}
}
