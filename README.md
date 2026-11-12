# Drop

Drop is a Cloudflare-first personal publishing utility for uploading files and folders via web UI or CLI, then sharing them through readable unlisted URLs.

## Features

- Single-owner web admin with login
- Public-by-link file and folder serving
- Styled directory listings
- Markdown uploads generate companion `.html` files while preserving the original `.md`
- Instant web uploads via drag/drop or chooser buttons
- CLI for upload, list, search, folder creation, and deletion
- MCP server at `/mcp` so AI apps can list, read, write, and delete files
- R2-backed storage with overwrite protection

See [CLI.md](./CLI.md) for local CLI installation, authentication, and command usage.

## MCP

Add `https://<your-drop-host>/mcp` as a remote MCP server in any client that supports OAuth (Claude, Claude Code, Codex, Hammer). The client registers itself, then opens Drop in your browser: sign in and choose what it may do.

- **Read** (always granted): `list_files`, `search_files`, `read_file`
- **Create and replace files**: `write_file`, `create_folder`. Anything written is public to anyone with the link, and `.md` files get a rendered `.html` beside them.
- **Delete files**: `delete_file`, `delete_folder`
- **Stay connected**: refresh tokens that last while the app keeps using them, ending after 30 days unused. Without it, access ends after 15 minutes.

The admin's **Connected apps** dialog lists approved apps and disconnects them. Changing `OWNER_USERNAME`, `OWNER_PASSWORD`, or `SESSION_SECRET` disconnects every app at once.

OAuth state lives in the `OAUTH_KV` namespace, which Wrangler creates on first deploy. Set the optional `PUBLIC_ORIGIN` var (for example `https://drop.example.com`) to pin the OAuth issuer to one hostname; otherwise the custom domain and workers.dev each act as separate issuers. The paths `/mcp`, `/oauth/*`, and `/.well-known/oauth-*` are reserved, as are `/admin`, `/login`, `/logout`, and `/api`, so files can't be uploaded there.

## Required Cloudflare setup

1. Create an R2 bucket for production and optionally a preview bucket.
2. Set the bucket name and route in `wrangler.toml` (`[[r2_buckets]]` and `routes`). They live in the config so every deploy path ships them, including Cloudflare's GitHub build running a plain `npx wrangler deploy`. A deploy without the bucket binding fails every public request with Error 1101.
3. Set Worker runtime secrets:
   - `wrangler secret put OWNER_USERNAME`
   - `wrangler secret put OWNER_PASSWORD`
   - `wrangler secret put SESSION_SECRET` (use a long random value; Drop now rejects weak values shorter than 32 characters)
   - `wrangler secret put CLI_TOKENS`
4. Optional deploy-time overrides for `npm run dev` / `npm run deploy` (for example in `.mise.toml`), useful for a second environment without editing `wrangler.toml`:
   - `DROP_BUCKET_NAME`, `DROP_PREVIEW_BUCKET_NAME`
   - `DROP_ROUTE_PATTERN` and `DROP_ROUTE_ZONE_NAME`, set together. The pattern looks like `drops.example.com/*`, without `https://`.
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

## Deploy

Pushing to `main` deploys through Cloudflare's GitHub integration. To deploy by hand:

```bash
npm run deploy
```

To deploy somewhere else without editing `wrangler.toml`, override the bucket and route:

```bash
DROP_BUCKET_NAME='other-bucket' \
DROP_PREVIEW_BUCKET_NAME='other-bucket-preview' \
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
