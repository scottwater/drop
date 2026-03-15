# Drop CLI

The Drop CLI lets you manage your Drop instance from the terminal.

## Install the CLI locally

From the repository root, choose one of these options.

### Option 1: run it without installing

```bash
npm run cli -- --help
```

Or:

```bash
node ./src/cli.js --help
```

This is the simplest option while developing locally.

### Option 2: link `drop` into your shell

```bash
npm link
```

After that, you should be able to run:

```bash
drop --help
```

If your shell still cannot find `drop`, check that your global npm bin directory is on your `PATH`:

```bash
npm bin -g
```

### Option 3: install globally from this checkout

```bash
npm install -g .
```

## Authenticate the CLI

The CLI uses a bearer token, not your browser session.

Save your host and token once:

```bash
drop auth --host https://drops.example.com --token YOUR_CLI_TOKEN
```

This writes config to:

```text
~/.config/drop/config.json
```

You can also provide these as environment variables instead of saving them:

```bash
export DROP_HOST='https://drops.example.com'
export DROP_TOKEN='YOUR_CLI_TOKEN'
```

Command-line flags override environment variables, and environment variables override the saved config file.

## Command reference

### Show help

```bash
drop --help
```

### Save auth config

```bash
drop auth --host https://drops.example.com --token YOUR_CLI_TOKEN
```

### Upload a file

```bash
drop upload ./docs/readme.md --output notes/readme.md
```

### Upload a directory

```bash
drop upload ./site --output projects/site
```

### Overwrite existing files

```bash
drop upload ./site --output projects/site --force
```

`--override` is accepted as an alias for `--force`.

### List a folder

```bash
drop ls
```

```bash
drop ls notes/
```

### Search paths

```bash
drop search readme
```

### Create a folder

```bash
drop mkdir drafts/ideas
```

### Delete a file

```bash
drop rm drafts/ideas/index.html
```

### Delete a folder

```bash
drop rm drafts/ideas --folder
```

## Output path behavior

`drop upload` follows the same path rules as the web UI:

- if `--output` ends with `/`, it is treated as a folder destination
- if `--output` has no extension, it is also treated as a folder destination
- for single-file uploads to a folder destination, Drop writes `index.*` using the source file extension
- markdown uploads preserve the `.md` file and also generate a companion `.html` file

Examples:

```bash
drop upload ./post.md --output notes/post.md
```

Saves:
- `notes/post.md`
- `notes/post.html`

```bash
drop upload ./index.html --output project/site/
```

Saves:
- `project/site/index.html`

## Per-command host/token overrides

Even after running `drop auth`, you can override the target instance for a single command:

```bash
drop ls --host https://other-drop.example.com --token OTHER_TOKEN
```

## Troubleshooting

### `drop: command not found`

Use one of these:

```bash
npm run cli -- --help
```

```bash
node ./src/cli.js --help
```

Or install/link it first:

```bash
npm link
```

### `Missing host/token`

Either:

- run `drop auth --host <url> --token <token>` first
- or set `DROP_HOST` and `DROP_TOKEN`
- or pass `--host` and `--token` directly on the command

### `Upload would overwrite existing paths`

Re-run with:

```bash
--force
```

or:

```bash
--override
```
