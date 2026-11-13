import { FAVICON_LINKS } from './favicon.js';
import { escapeHtml } from './markdown.js';
import { folderHref, humanFileSize } from './path.js';
import { APP_HEAD_LINKS } from './webapp.js';
import { FONT_MONO, FONT_SANS, paletteCss } from './theme.js';

const ICONS = {
  mark: '<svg class="mark" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.25c2.75 3.3 4.75 5.8 4.75 8.25a4.75 4.75 0 0 1-9.5 0C3.25 7.05 5.25 4.55 8 1.25z"/></svg>',
  folder: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" d="M1.75 3.75a1 1 0 0 1 1-1h3.1l1.5 1.5h5.9a1 1 0 0 1 1 1v6.999a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1z"/></svg>',
  file: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" d="M4 1.75h4.75l3.25 3.25v8.25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1zM8.75 1.75V5H12"/></svg>',
};

const BASE_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.5 ${FONT_SANS};
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
code, kbd { font-family: ${FONT_MONO}; font-size: 0.92em; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[hidden] { display: none !important; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

.topbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 16px;
  padding: 10px 24px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 650; font-size: 15px; letter-spacing: -0.01em; text-decoration: none;
}
.mark { width: 16px; height: 16px; color: var(--accent); }
.search { position: relative; flex: 1; max-width: 420px; margin: 0 auto; }
.search input { padding-right: 30px; }
.search kbd {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  padding: 1px 6px; border: 1px solid var(--border); border-radius: 4px;
  color: var(--faint); font-size: 11px; pointer-events: none;
}
.topbar-nav { display: flex; gap: 4px; }
.topbar-nav form { margin: 0; }

.page { width: min(1040px, 100% - 32px); margin: 0 auto; padding: 24px 0 64px; }
.page.narrow { width: min(820px, 100% - 32px); }
.blank { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: 6px; padding: 16px; text-align: center; }
.blank h1 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.01em; }
.blank p { margin: 0; color: var(--muted); }

input[type="text"], input[type="password"], input[type="search"] {
  width: 100%; height: 34px; padding: 0 10px;
  border: 1px solid var(--border-strong); border-radius: 8px;
  background: var(--surface); color: var(--text); font: inherit;
}
input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
input::placeholder { color: var(--faint); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 32px; padding: 0 12px;
  border: 1px solid var(--border-strong); border-radius: 8px;
  background: var(--surface); color: var(--text);
  font: 500 13px/1 ${FONT_SANS}; white-space: nowrap; text-decoration: none; cursor: pointer;
}
.btn:hover { background: var(--surface-2); }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
.btn.primary:hover { filter: brightness(1.08); }
.btn.ghost { background: transparent; border-color: transparent; color: var(--muted); }
.btn.ghost:hover { background: var(--surface-2); color: var(--text); }
.btn.block { width: 100%; height: 36px; }
.link { padding: 0; border: 0; background: none; color: var(--accent); font: inherit; cursor: pointer; }
.link:hover { text-decoration: underline; }

.toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 32px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; font-size: 15px; }
.crumbs a { color: var(--muted); text-decoration: none; }
.crumbs a:hover { color: var(--text); }
.crumbs .sep { color: var(--faint); }
.crumbs .current { font-weight: 600; }

.inline-form { display: flex; gap: 8px; max-width: 560px; margin: 0 0 16px; }

.dropzone {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px;
  margin-bottom: 16px; padding: 12px 16px;
  border: 1px dashed var(--border-strong); border-radius: 10px;
  color: var(--muted);
  transition: background 120ms, border-color 120ms;
}
.dropzone p { margin: 0; }
.dropzone code { color: var(--text); }
.output-row { flex-basis: 100%; display: grid; gap: 6px; margin-top: 8px; max-width: 560px; }
.hint { margin: 0; font-size: 12px; color: var(--muted); }
body.dragging .dropzone { border-color: var(--accent); background: var(--accent-soft); color: var(--text); }
body.dragging::after { content: ''; position: fixed; inset: 0; z-index: 50; border: 2px solid var(--accent); pointer-events: none; }
body.uploading .dropzone { opacity: 0.6; }

.table { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); overflow: hidden; }
.row {
  display: grid; grid-template-columns: minmax(0, 1fr) 80px 120px;
  align-items: center; gap: 16px;
  min-height: 44px; padding: 6px 14px;
  border-top: 1px solid var(--border);
}
.table.admin .row { grid-template-columns: minmax(0, 1fr) 80px 120px 150px; padding-right: 8px; }
.row:first-child { border-top: 0; }
.row.head { min-height: 34px; color: var(--faint); font-size: 12px; font-weight: 500; }
.row:not(.head):hover { background: var(--surface-2); }
.name { display: flex; align-items: center; gap: 10px; min-width: 0; font-weight: 500; text-decoration: none; }
.name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name svg { flex: none; width: 16px; height: 16px; color: var(--faint); }
.name.folder svg { color: var(--accent); }
a.name:hover span { text-decoration: underline; text-underline-offset: 2px; }
.size, .date { color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.size { text-align: right; }
.row-actions { display: flex; justify-content: flex-end; gap: 2px; }
.row-actions button {
  height: 28px; padding: 0 8px; border: 0; border-radius: 6px;
  background: transparent; color: var(--muted); font: 500 12px/1 ${FONT_SANS}; cursor: pointer;
}
.row-actions button:hover { background: var(--border); color: var(--text); }
.row-actions button.danger:hover { background: var(--danger-soft); color: var(--danger); }
@media (hover: hover) {
  .row-actions { opacity: 0; }
  .row:hover .row-actions, .row:focus-within .row-actions { opacity: 1; }
}
.empty { padding: 48px 16px; text-align: center; color: var(--muted); }

.toast {
  position: fixed; left: 50%; bottom: 20px; z-index: 60; transform: translateX(-50%);
  max-width: calc(100% - 32px); padding: 10px 14px; border-radius: 8px;
  background: var(--text); color: var(--bg); font-size: 13px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.toast.error { background: var(--danger); color: #fff; }

.auth { min-height: 100vh; display: grid; place-items: center; padding: 16px; }
.auth-card {
  display: grid; gap: 14px; width: min(360px, 100%); padding: 28px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
}
.auth-card h1 { margin: 10px 0 2px; font-size: 20px; letter-spacing: -0.01em; }
.field { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 500; }
.error-text { margin: 0; color: var(--danger); font-size: 13px; }
.auth-card.wide { width: min(480px, 100%); }
.auth-card p { margin: 0; }
.lead, .muted { color: var(--muted); }
.faint { color: var(--faint); }
.warn { color: var(--danger); }
.actions.end { justify-content: flex-end; }
.scopes { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--border); }
.scopes li { padding: 12px 0; border-bottom: 1px solid var(--border); }
.check { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
.check input { flex: none; width: 16px; height: 16px; margin-top: 2px; accent-color: var(--accent); }

dialog {
  width: min(560px, 100% - 32px); padding: 0;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface); color: var(--text);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
}
dialog::backdrop { background: rgba(0, 0, 0, 0.35); }
.dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.dialog-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
.dialog-body { padding: 8px 16px 16px; }
.dialog-body > p { margin: 8px 0; color: var(--muted); font-size: 13px; }
.connection { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.connection:last-of-type { border-bottom: 0; }
.connection-meta { color: var(--muted); font-size: 12px; }

@media (max-width: 640px) {
  .topbar { flex-wrap: wrap; padding: 10px 16px; }
  .topbar-nav { margin-left: auto; }
  .search { order: 3; flex-basis: 100%; max-width: none; }
  .row, .table.admin .row { grid-template-columns: minmax(0, 1fr) 64px; }
  .table.admin .row { grid-template-columns: minmax(0, 1fr) 64px auto; }
  .row .date { display: none; }
  .toolbar .actions { width: 100%; }
  .toolbar .actions .btn { flex: 1; }
}
`;

// `installable` adds the web app manifest, on the owner's pages only, so
// visitors to public links aren't offered to install Drop.
function shell({ title, body, script = '', installable = false }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)}</title>
    ${FAVICON_LINKS}${installable ? `\n    ${APP_HEAD_LINKS}` : ''}
    <style>${paletteCss()}${BASE_CSS}</style>
  </head>
  <body>${body}${script ? `<script type="module">${script}</script>` : ''}</body>
</html>`;
}

export function renderLoginPage({ error = '', redirect = '/admin' } = {}) {
  const connecting = redirect.startsWith('/oauth/authorize');
  return shell({
    installable: true,
    title: 'Sign in · Drop',
    body: `<main class="auth">
      <form class="auth-card" method="post" action="/login">
        <span class="brand">${ICONS.mark}Drop</span>
        <h1>Sign in</h1>
        ${connecting ? '<p class="lead">An app is asking to connect to Drop. Sign in to review its request.</p>' : ''}
        <input type="hidden" name="redirect" value="${escapeHtml(redirect)}" />
        <label class="field">Username
          <input type="text" name="username" autocomplete="username" required autofocus />
        </label>
        <label class="field">Password
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        ${error ? `<p class="error-text" role="alert">${escapeHtml(error)}</p>` : ''}
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
    </main>`,
  });
}

// Asks the owner to approve an MCP client. Reading is always granted; the
// other scopes start unticked whatever the app asked for, since many apps ask
// only for the baseline and can't step up later.
export function renderConsentPage({ details, handle, scopes }) {
  const name = escapeHtml(details.clientName);
  const requested = new Set(details.scope);
  // Only a metadata-document client's domain is verified; anyone can
  // self-register under any name.
  const publisher = details.clientDomain
    ? `<p>Published by <strong>${escapeHtml(details.clientDomain)}</strong>.</p>`
    : `<p class="warn">Any app can register under any name, so “${name}” is not verified. Continue only if you just started connecting it and recognise <strong>${escapeHtml(details.redirectHost)}</strong>.</p>`;
  const option = (scope, label, detail) => `<li><label class="check">
      <input type="checkbox" name="scope" value="${scope}" />
      <span><strong>${label}</strong>${requested.has(scope) ? ' <span class="faint">(requested)</span>' : ''}<br /><span class="muted">${detail}</span></span>
    </label></li>`;
  return shell({
    title: `Connect ${details.clientName} · Drop`,
    body: `<main class="auth">
      <form class="auth-card wide" method="post">
        <span class="brand">${ICONS.mark}Drop</span>
        <h1>Connect ${name} to Drop?</h1>
        ${publisher}
        <p>Access will be sent to <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
        ${details.redirectIsLoopback ? '<p class="warn"><strong>Access goes to an app on this computer.</strong> Continue only if you just started connecting from it.</p>' : ''}
        <input type="hidden" name="handle" value="${escapeHtml(handle)}" />
        <ul class="scopes">
          <li><strong>Read your files</strong><br /><span class="muted">List, search and read every file and folder, including ones the public can’t browse.</span></li>
          ${option(scopes.write, 'Create and replace files', 'Write files and folders. Anything written is published at a public link.')}
          ${option(scopes.delete, 'Delete files', 'Delete any file or folder.')}
          ${option(scopes.offline, 'Stay connected', `Access lasts while ${name} uses it and ends after 30 days unused. Without this, it ends after 15 minutes.`)}
        </ul>
        <p class="muted">You can disconnect ${name} at any time from Connected apps.</p>
        <div class="actions end">
          <button class="btn" name="decision" value="deny">Deny</button>
          <button class="btn primary" name="decision" value="approve">Allow</button>
        </div>
      </form>
    </main>`,
  });
}

export function renderMessagePage({ title, message, hint = '' }) {
  return shell({
    title: `${title} · Drop`,
    body: `<main class="blank"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${hint ? `<p class="faint">${escapeHtml(hint)}</p>` : ''}</main>`,
  });
}

export function renderNotFoundPage() {
  return shell({
    title: 'Not found · Drop',
    body: `<main class="blank"><h1>Not found</h1><p>Nothing is published at this address.</p></main>`,
  });
}

export function renderDirectoryPage({ path = '', folders = [], files = [], isRoot = false }) {
  if (isRoot) {
    return shell({
      title: 'Drop',
      body: `<main class="blank"><h1 class="brand">${ICONS.mark}Drop</h1></main>`,
    });
  }

  const rows = [
    ...folders.map((folder) => `<div class="row">
      <a class="name folder" href="${escapeHtml(folder.href)}">${ICONS.folder}<span>${escapeHtml(folder.name)}</span></a>
      <span class="size">—</span><span class="date"></span>
    </div>`),
    ...files.map((file) => `<div class="row">
      <a class="name" href="${escapeHtml(file.href)}">${ICONS.file}<span>${escapeHtml(file.name)}</span></a>
      <span class="size">${escapeHtml(humanFileSize(file.size || 0))}</span>
      <span class="date">${file.uploaded ? escapeHtml(formatDate(file.uploaded)) : ''}</span>
    </div>`),
  ];

  return shell({
    title: `${path} · Drop`,
    body: `<main class="page narrow">
      <div class="toolbar"><nav class="crumbs" aria-label="Folder">${publicCrumbs(path)}</nav></div>
      <div class="table">
        ${rows.length
          ? `<div class="row head"><span>Name</span><span class="size">Size</span><span class="date">Modified</span></div>${rows.join('')}`
          : '<div class="empty">This folder is empty.</div>'}
      </div>
    </main>`,
  });
}

function publicCrumbs(path) {
  const segments = path.split('/');
  let acc = '';
  return segments.map((segment, index) => {
    acc = acc ? `${acc}/${segment}` : segment;
    const label = escapeHtml(segment);
    const crumb = index === segments.length - 1
      ? `<span class="current">${label}</span>`
      : `<a href="${escapeHtml(folderHref(acc))}">${label}</a>`;
    return `<span class="sep">/</span>${crumb}`;
  }).join('');
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderAdminPage() {
  return shell({
    installable: true,
    title: 'Drop',
    body: `<header class="topbar">
      <a class="brand" href="/admin">${ICONS.mark}Drop</a>
      <label class="search">
        <span class="sr-only">Search files</span>
        <input id="search-input" type="search" placeholder="Search files" autocomplete="off" spellcheck="false" />
        <kbd>/</kbd>
      </label>
      <nav class="topbar-nav">
        <button class="btn ghost" type="button" id="open-connections">Connected apps</button>
        <form method="post" action="/logout"><button class="btn ghost" type="submit">Log out</button></form>
      </nav>
    </header>
    <main class="page">
      <div class="toolbar">
        <nav class="crumbs" id="breadcrumbs" aria-label="Current folder"></nav>
        <div class="actions" id="folder-actions">
          <button id="new-folder" class="btn" type="button">New folder</button>
          <button id="pick-folder" class="btn" type="button">Upload folder</button>
          <button id="pick-files" class="btn primary" type="button">Upload files</button>
        </div>
      </div>
      <form id="folder-form" class="inline-form" hidden>
        <input id="folder-name" type="text" placeholder="Folder name" autocomplete="off" spellcheck="false" />
        <button class="btn primary" type="submit">Create</button>
        <button class="btn ghost" type="button" id="cancel-folder">Cancel</button>
      </form>
      <section class="dropzone" id="dropzone">
        <p>Drop files or folders anywhere to upload to <code id="upload-dest">/</code></p>
        <button type="button" class="link" id="toggle-output">Upload to a different path</button>
        <div id="output-row" class="output-row" hidden>
          <input id="upload-output" type="text" placeholder="notes/readme or site/" autocomplete="off" spellcheck="false" />
          <p class="hint">One file: <code>notes/post.md</code> saves exactly there, <code>notes/post</code> saves as <code>notes/post/index.md</code>. Several files: the path is used as a folder.</p>
        </div>
      </section>
      <div class="table admin" id="listing" aria-live="polite"></div>
    </main>
    <dialog id="connections" aria-labelledby="connections-title">
      <div class="dialog-head">
        <h2 id="connections-title">Connected apps</h2>
        <button class="btn ghost" type="button" id="close-connections">Close</button>
      </div>
      <div class="dialog-body">
        <p>Apps you’ve approved to use Drop over MCP. Connect a new one with <code id="mcp-url"></code></p>
        <div id="connection-list"></div>
      </div>
    </dialog>
    <div id="toast" class="toast" role="status" hidden></div>
    <input id="upload-files" class="sr-only" type="file" multiple tabindex="-1" aria-hidden="true" />
    <input id="upload-folder" class="sr-only" type="file" webkitdirectory multiple tabindex="-1" aria-hidden="true" />`,
    script: adminScript(),
  });
}

// Client code for the admin page. String.raw keeps escapes like \n intact;
// avoid template literals and `${` inside — only the ICONS interpolations below
// are evaluated on the server.
function adminScript() {
  return String.raw`
const ICON_FOLDER = '${ICONS.folder}';
const ICON_FILE = '${ICONS.file}';
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const $ = (id) => document.getElementById(id);
const listingEl = $('listing');
const crumbsEl = $('breadcrumbs');
const searchInput = $('search-input');
const toastEl = $('toast');
const destEl = $('upload-dest');
const outputRow = $('output-row');
const outputInput = $('upload-output');
const fileInput = $('upload-files');
const folderInput = $('upload-folder');
const folderForm = $('folder-form');
const folderName = $('folder-name');

const state = { path: '', query: '', uploading: false };
let toastTimer;
let searchTimer;
let dragDepth = 0;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plural(count, noun) {
  return count + ' ' + noun + (count === 1 ? '' : 's');
}

function formatSize(bytes) {
  bytes = bytes || 0;
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = -1;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + ' ' + units[index];
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function joinPath(base, name) {
  return [base, name].filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

function parentOf(path) {
  return path.split('/').slice(0, -1).join('/');
}

function toast(message, kind) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = 'toast' + (kind ? ' ' + kind : '');
  toastEl.hidden = false;
  if (kind !== 'busy') {
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, kind === 'error' ? 6000 : 3000);
  }
}

async function api(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    location.href = '/login?redirect=/admin';
    throw new Error('Signed out');
  }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

// Navigation lives in the URL hash (#/notes/drafts) so reload and back work.
function pathFromHash() {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ''));
}

function hashFor(path) {
  return '#/' + encodeURIComponent(path).replace(/%2F/g, '/');
}

function navigate(path) {
  if (pathFromHash() === path) {
    load(path);
  } else {
    location.hash = hashFor(path);
  }
}

function renderCrumbs(path) {
  const parts = ['<a href="#/">All files</a>'];
  let acc = '';
  path.split('/').filter(Boolean).forEach((segment, index, all) => {
    acc = joinPath(acc, segment);
    parts.push('<span class="sep">/</span>');
    parts.push(index === all.length - 1
      ? '<span class="current">' + esc(segment) + '</span>'
      : '<a href="' + esc(hashFor(acc)) + '">' + esc(segment) + '</a>');
  });
  if (!path) parts[0] = '<span class="current">All files</span>';
  crumbsEl.innerHTML = parts.join('');
}

function actions(href, path, type) {
  return '<span class="row-actions">'
    + '<button type="button" data-copy="' + esc(href) + '">Copy link</button>'
    + '<button type="button" class="danger" data-delete="' + esc(path) + '" data-type="' + type + '">Delete</button>'
    + '</span>';
}

function folderRow(folder) {
  return '<div class="row">'
    + '<a class="name folder" href="' + esc(hashFor(folder.path)) + '">' + ICON_FOLDER + '<span>' + esc(folder.name) + '</span></a>'
    + '<span class="size">—</span><span class="date"></span>'
    + actions(folder.href, folder.path, 'folder')
    + '</div>';
}

function fileRow(file, label) {
  return '<div class="row">'
    + '<a class="name" href="' + esc(file.href) + '" target="_blank" rel="noreferrer">' + ICON_FILE + '<span>' + esc(label || file.name) + '</span></a>'
    + '<span class="size">' + formatSize(file.size) + '</span>'
    + '<span class="date">' + esc(formatDate(file.uploaded)) + '</span>'
    + actions(file.href, file.path, 'file')
    + '</div>';
}

function renderRows(rows, emptyMessage) {
  listingEl.innerHTML = rows.length
    ? '<div class="row head"><span>Name</span><span class="size">Size</span><span class="date">Modified</span><span></span></div>' + rows.join('')
    : '<div class="empty">' + esc(emptyMessage) + '</div>';
}

async function load(path) {
  state.path = path;
  destEl.textContent = '/' + (path ? path + '/' : '');
  renderCrumbs(path);
  if (state.query) return runSearch();
  const { response, data } = await api('/api/admin/list?prefix=' + encodeURIComponent(path));
  if (state.path !== path) return;
  if (!response.ok) {
    toast(data.error || 'Could not load this folder.', 'error');
    return;
  }
  renderRows(
    data.folders.map(folderRow).concat(data.files.map((file) => fileRow(file))),
    path ? 'This folder is empty. Drop files here to add some.' : 'Nothing uploaded yet. Drop files here to get started.'
  );
}

async function runSearch() {
  const query = searchInput.value.trim();
  state.query = query;
  if (!query) return load(state.path);
  const { response, data } = await api('/api/admin/search?q=' + encodeURIComponent(query));
  if (state.query !== query) return;
  if (!response.ok) {
    toast(data.error || 'Search failed.', 'error');
    return;
  }
  crumbsEl.innerHTML = '<span class="current">' + esc(plural(data.results.length, 'result')) + ' for “' + esc(query) + '”</span>';
  renderRows(data.results.map((file) => fileRow(file, file.path)), 'No files match “' + query + '”.');
}

function clearSearch() {
  if (!searchInput.value && !state.query) return;
  searchInput.value = '';
  state.query = '';
}

async function sendUpload(entries, force) {
  const form = new FormData();
  form.set('output', outputInput.value.trim());
  form.set('force', force ? 'true' : 'false');
  form.set('currentPath', state.path);
  for (const entry of entries) {
    form.append('files', entry.file, entry.file.name);
    form.append('relativePaths', entry.relativePath);
  }
  return api('/api/admin/upload', { method: 'POST', body: form });
}

async function upload(entries) {
  entries = entries.filter((entry) => !IGNORED_NAMES.has(entry.file.name));
  if (!entries.length) return;
  if (state.uploading) {
    toast('Another upload is still running.', 'error');
    return;
  }
  state.uploading = true;
  document.body.classList.add('uploading');
  toast('Uploading ' + plural(entries.length, 'file') + '…', 'busy');
  try {
    let result = await sendUpload(entries, false);
    if (result.response.status === 409) {
      const list = result.data.conflicts || [];
      const shown = list.slice(0, 15).join('\n') + (list.length > 15 ? '\n…and ' + (list.length - 15) + ' more' : '');
      if (!confirm('These files already exist:\n\n' + shown + '\n\nReplace them?')) {
        toast('Upload cancelled.');
        return;
      }
      result = await sendUpload(entries, true);
    }
    if (!result.response.ok) {
      toast(result.data.error || 'Upload failed.', 'error');
      return;
    }
    toast('Uploaded ' + plural(entries.length, 'file') + '.', 'ok');
    outputInput.value = '';
    outputRow.hidden = true;
    clearSearch();
    navigate(result.data.refreshPath ?? state.path);
  } catch (error) {
    if (error.message !== 'Signed out') toast('Upload failed: ' + error.message, 'error');
  } finally {
    state.uploading = false;
    document.body.classList.remove('uploading');
    fileInput.value = '';
    folderInput.value = '';
  }
}

// Dropped folders arrive as directory entries; walk them so nested files keep
// their relative paths (dataTransfer.files alone only lists top-level items).
function readEntries(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function walkEntry(entry, prefix, out) {
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    out.push({ file, relativePath: prefix + file.name });
    return;
  }
  const reader = entry.createReader();
  let batch;
  do {
    batch = await readEntries(reader);
    for (const child of batch) await walkEntry(child, prefix + entry.name + '/', out);
  } while (batch.length);
}

async function entriesFromDrop(dataTransfer) {
  // webkitGetAsEntry must be called synchronously, before any await.
  const roots = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry && item.webkitGetAsEntry())
    .filter(Boolean);
  if (!roots.length) {
    return Array.from(dataTransfer.files || []).map((file) => ({ file, relativePath: file.name }));
  }
  const out = [];
  for (const root of roots) await walkEntry(root, '', out);
  return out;
}

async function createFolder(event) {
  event.preventDefault();
  const name = folderName.value.trim();
  if (!name) return;
  const path = name.startsWith('/') ? name.replace(/^\/+/, '') : joinPath(state.path, name);
  const { response, data } = await api('/api/admin/folder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path })
  });
  if (!response.ok) {
    toast(data.error || 'Could not create folder.', 'error');
    return;
  }
  folderName.value = '';
  folderForm.hidden = true;
  toast('Created ' + data.path + '/', 'ok');
  clearSearch();
  navigate(data.path);
}

async function deletePath(path, type) {
  const what = type === 'folder' ? 'the folder ' + path + '/ and everything in it' : path;
  if (!confirm('Delete ' + what + '?')) return;
  const { response, data } = await api('/api/admin/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, type })
  });
  if (!response.ok) {
    toast(data.error || 'Delete failed.', 'error');
    return;
  }
  toast('Deleted ' + path + (type === 'folder' ? '/' : ''), 'ok');
  load(state.path);
}

async function copyLink(href) {
  const url = new URL(href, location.origin).href;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied', 'ok');
  } catch {
    prompt('Copy this link:', url);
  }
}

const connectionsDialog = $('connections');
const connectionList = $('connection-list');
const SCOPE_LABELS = { 'drop:read': 'Read', 'drop:write': 'Write', 'drop:delete': 'Delete', 'offline_access': 'Stays connected' };

async function loadConnections() {
  connectionList.innerHTML = '<p class="muted">Loading…</p>';
  const { response, data } = await api('/api/admin/connections');
  if (!response.ok) {
    connectionList.innerHTML = '<p class="warn">' + esc(data.error || 'Could not load connected apps.') + '</p>';
    return;
  }
  connectionList.innerHTML = data.connections.length
    ? data.connections.map((connection) => '<div class="connection"><div>'
        + '<strong>' + esc(connection.name) + '</strong>'
        + '<div class="connection-meta">' + esc(connection.scopes.map((scope) => SCOPE_LABELS[scope] || scope).join(' · '))
        + ' · since ' + esc(formatDate(connection.createdAt * 1000)) + '</div></div>'
        + '<button class="btn" type="button" data-revoke="' + esc(connection.id) + '" data-name="' + esc(connection.name) + '">Disconnect</button></div>').join('')
    : '<p class="muted">No apps are connected.</p>';
}

$('mcp-url').textContent = location.origin + '/mcp';
$('open-connections').addEventListener('click', () => {
  connectionsDialog.showModal();
  loadConnections();
});
$('close-connections').addEventListener('click', () => connectionsDialog.close());
connectionList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-revoke]');
  if (!button || !confirm('Disconnect ' + button.getAttribute('data-name') + '?')) return;
  const { response, data } = await api('/api/admin/connections/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: button.getAttribute('data-revoke') })
  });
  if (!response.ok) {
    toast(data.error || 'Could not disconnect.', 'error');
    return;
  }
  toast('Disconnected ' + button.getAttribute('data-name'), 'ok');
  loadConnections();
});

$('pick-files').addEventListener('click', () => fileInput.click());
$('pick-folder').addEventListener('click', () => folderInput.click());
$('new-folder').addEventListener('click', () => {
  folderForm.hidden = false;
  folderName.focus();
});
$('cancel-folder').addEventListener('click', () => { folderForm.hidden = true; });
folderForm.addEventListener('submit', createFolder);
folderName.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') folderForm.hidden = true;
});
$('toggle-output').addEventListener('click', () => {
  outputRow.hidden = !outputRow.hidden;
  if (!outputRow.hidden) outputInput.focus();
});

fileInput.addEventListener('change', () => {
  upload(Array.from(fileInput.files || []).map((file) => ({ file, relativePath: file.name })));
});
folderInput.addEventListener('change', () => {
  upload(Array.from(folderInput.files || []).map((file) => ({ file, relativePath: file.webkitRelativePath || file.name })));
});

listingEl.addEventListener('click', (event) => {
  const copy = event.target.closest('[data-copy]');
  if (copy) return copyLink(copy.getAttribute('data-copy'));
  const del = event.target.closest('[data-delete]');
  if (del) return deletePath(del.getAttribute('data-delete'), del.getAttribute('data-type'));
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 200);
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    clearSearch();
    searchInput.blur();
    load(state.path);
  }
});
crumbsEl.addEventListener('click', (event) => {
  if (state.query && event.target.closest('a')) clearSearch();
});
document.addEventListener('keydown', (event) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    searchInput.focus();
  }
});

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}
document.addEventListener('dragenter', (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth += 1;
  document.body.classList.add('dragging');
});
document.addEventListener('dragover', (event) => {
  if (hasFiles(event)) event.preventDefault();
});
document.addEventListener('dragleave', (event) => {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) document.body.classList.remove('dragging');
});
document.addEventListener('drop', async (event) => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  upload(await entriesFromDrop(event.dataTransfer));
});

window.addEventListener('hashchange', () => {
  clearSearch();
  load(pathFromHash());
});
load(pathFromHash());
`;
}
