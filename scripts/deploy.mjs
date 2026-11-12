#!/usr/bin/env node
// Runs `wrangler dev` or `wrangler deploy`. wrangler.toml holds the production
// route and bucket; these optional env vars override them for another setup:
//   DROP_BUCKET_NAME, DROP_PREVIEW_BUCKET_NAME
//   DROP_ROUTE_PATTERN + DROP_ROUTE_ZONE_NAME (both or neither)
// With none set, wrangler runs against wrangler.toml unchanged.
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

if ((routePattern && !routeZoneName) || (!routePattern && routeZoneName)) {
  console.error('DROP_ROUTE_PATTERN and DROP_ROUTE_ZONE_NAME must either both be set or both be unset.');
  process.exit(1);
}

if (routePattern && /^https?:\/\//i.test(routePattern)) {
  console.error('DROP_ROUTE_PATTERN must be a Cloudflare route pattern like "drops.example.com/*", not a full URL.');
  process.exit(1);
}

const overriding = Boolean(bucketName || previewBucketName || routePattern);
const args = ['wrangler', command, ...(overriding ? ['--config', tempConfigPath] : []), ...passthroughArgs];

if (overriding) {
  const config = applyOverrides(readFileSync(baseConfigPath, 'utf8'), { bucketName, previewBucketName, routePattern, routeZoneName });
  writeFileSync(tempConfigPath, config);
}

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

// Swaps values in wrangler.toml; fails loudly if the expected lines are gone
// so an override can never silently drop the bucket or route.
function applyOverrides(base, options) {
  let config = base;
  const replace = (pattern, value, label) => {
    if (!pattern.test(config)) {
      console.error(`Could not find ${label} in wrangler.toml to override.`);
      process.exit(1);
    }
    config = config.replace(pattern, value);
  };

  if (options.bucketName) {
    replace(/^bucket_name = .*$/m, `bucket_name = ${toTomlString(options.bucketName)}`, 'bucket_name');
  }
  if (options.previewBucketName) {
    replace(/^preview_bucket_name = .*$/m, `preview_bucket_name = ${toTomlString(options.previewBucketName)}`, 'preview_bucket_name');
  }
  if (options.routePattern) {
    replace(
      /^routes = \[[\s\S]*?\n\]$/m,
      `routes = [\n  { pattern = ${toTomlString(options.routePattern)}, zone_name = ${toTomlString(options.routeZoneName)} },\n]`,
      'routes',
    );
  }
  return config;
}

function toTomlString(value) {
  return JSON.stringify(value);
}

function cleanup() {
  if (!overriding) return;
  try {
    unlinkSync(tempConfigPath);
  } catch {}
}
