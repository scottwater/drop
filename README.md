# Drop

Drop is a Cloudflare-first personal publishing utility for uploading files and folders via web UI or CLI, then sharing them through readable unlisted URLs.

## Features

- Single-owner web admin with login
- Public-by-link file and folder serving
- Styled directory listings
- Markdown uploads generate companion `.html` files while preserving the original `.md`
- Instant web uploads via drag/drop or chooser buttons
- CLI for upload, list, search, folder creation, and deletion

See [CLI.md](./CLI.md) for local CLI installation, authentication, and command usage.
- R2-backed storage with overwrite protection

## Required Cloudflare setup

1. Create an R2 bucket for production and optionally a preview bucket.
2. Set deploy-time shell env vars for Wrangler config (for example in `.mise.toml`):
   - `DROP_BUCKET_NAME`
   - `DROP_PREVIEW_BUCKET_NAME`
   - optional: `DROP_ROUTE_PATTERN`
   - optional: `DROP_ROUTE_ZONE_NAME`
3. Set Worker runtime secrets:
   - `wrangler secret put OWNER_USERNAME`
   - `wrangler secret put OWNER_PASSWORD`
   - `wrangler secret put SESSION_SECRET` (use a long random value; Drop now rejects weak values shorter than 32 characters)
   - `wrangler secret put CLI_TOKENS`
4. Notes on deploy-time config:
   - Drop no longer hardcodes any route/domain or bucket name in `wrangler.toml`.
   - `DROP_ROUTE_PATTERN` should look like `drops.example.com/*` and must not include `https://`.
   - If route vars are unset, deploy uses the default Workers URL only.
   - These values cannot come from Wrangler runtime secrets because routes/bindings are deployment config, not Worker runtime config.
5. Optional login throttling vars:
   - `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` (default `5`)
   - `LOGIN_RATE_LIMIT_WINDOW_SECONDS` (default `900`)
   - `LOGIN_RATE_LIMIT_BLOCK_SECONDS` (default `900`)

## Development

```bash
npm install
npm test
npm run dev
```

`npm run dev` and `npm run deploy` now both expect these deploy-time shell env vars to be set:

```bash
DROP_BUCKET_NAME='drop'
DROP_PREVIEW_BUCKET_NAME='drop-preview'
```

## Deploy

Default deploy with no custom route:

```bash
DROP_BUCKET_NAME='drop' \
DROP_PREVIEW_BUCKET_NAME='drop-preview' \
npm run deploy
```

Deploy with a custom route:

```bash
DROP_BUCKET_NAME='drop' \
DROP_PREVIEW_BUCKET_NAME='drop-preview' \
DROP_ROUTE_PATTERN='drops.example.com/*' \
DROP_ROUTE_ZONE_NAME='example.com' \
npm run deploy
```

## CLI usage

```bash
drop auth --host https://drop.example.com --token your-token
drop upload ./docs/readme.md --output notes/readme
drop ls notes/
drop search readme
drop mkdir drafts/ideas/
drop rm drafts/ideas/index.html
drop rm drafts/ideas --folder
```

If `--output` ends with `/` or has no extension, Drop treats it as a folder target and writes `index.*` using the source file extension. Markdown uploads still produce a companion `index.html`.
