# Drop

Drop is a Cloudflare-first personal publishing utility for uploading files and folders via web UI or CLI, then sharing them through readable unlisted URLs.

## Features

- Single-owner web admin with login
- Public-by-link file and folder serving
- Styled directory listings
- Markdown uploads generate companion `.html` files while preserving the original `.md`
- CLI for upload, list, search, and folder creation
- R2-backed storage with overwrite protection

## Required Cloudflare setup

1. Create an R2 bucket for production and optionally a preview bucket.
2. Update `wrangler.toml` bucket names if needed.
3. Set secrets:
   - `wrangler secret put OWNER_USERNAME`
   - `wrangler secret put OWNER_PASSWORD`
   - `wrangler secret put SESSION_SECRET`
   - `wrangler secret put CLI_TOKENS`
4. Optionally configure a custom route/domain in `wrangler.toml`.

## Development

```bash
npm install
npm test
npm run dev
```

## CLI usage

```bash
drop auth --host https://drop.example.com --token your-token
drop upload ./docs/readme.md --output notes/readme
drop ls notes/
drop search readme
drop mkdir drafts/ideas/
```

If `--output` ends with `/` or has no extension, Drop treats it as a folder target and writes `index.*` using the source file extension. Markdown uploads still produce a companion `index.html`.
