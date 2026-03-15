import { escapeHtml } from './markdown.js';
import { humanFileSize, publicHref } from './path.js';

function shell({ title, body, script = '' }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0d1117;
        --bg-soft: #131a22;
        --panel: rgba(13, 17, 23, 0.76);
        --panel-strong: rgba(16, 22, 29, 0.88);
        --line: rgba(230, 233, 237, 0.12);
        --line-strong: rgba(230, 233, 237, 0.2);
        --text: #f2eee8;
        --muted: rgba(242, 238, 232, 0.68);
        --accent: #f0b35d;
        --accent-strong: #ffcb7b;
        --danger: #ff8f78;
        --ok: #9edfb8;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        font-family: 'Avenir Next', 'Segoe UI', sans-serif;
        background:
          radial-gradient(circle at top left, rgba(240,179,93,0.18), transparent 30%),
          radial-gradient(circle at top right, rgba(132, 117, 255, 0.14), transparent 32%),
          linear-gradient(180deg, #0a0e14 0%, var(--bg) 100%);
        color: var(--text);
      }
      a { color: inherit; }
      .page {
        width: min(1180px, calc(100vw - 28px));
        margin: 0 auto;
        padding: 22px 0 48px;
      }
      .hero {
        display: grid;
        grid-template-columns: 1.4fr 0.8fr;
        gap: 18px;
        margin-bottom: 18px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 26px;
        padding: 20px;
        backdrop-filter: blur(14px);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
      }
      .eyebrow {
        font: 700 11px/1 'Avenir Next', 'Segoe UI', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        color: var(--accent);
        margin-bottom: 12px;
      }
      h1, h2, h3 {
        font-family: Charter, 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
        letter-spacing: -0.03em;
        margin: 0;
      }
      h1 { font-size: clamp(2.6rem, 6vw, 5.8rem); line-height: 0.92; }
      .lede {
        margin-top: 16px;
        max-width: 46rem;
        font-size: 1.08rem;
        line-height: 1.75;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 18px;
      }
      .stack { display: grid; gap: 18px; }
      label {
        display: block;
        margin-bottom: 8px;
        color: var(--muted);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      input[type="text"], input[type="password"], input[type="search"], textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
        color: var(--text);
        padding: 14px 16px;
        font: inherit;
      }
      button, .button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: var(--accent);
        color: #25180a;
        font: 700 0.92rem/1 'Avenir Next', 'Segoe UI', sans-serif;
        cursor: pointer;
        text-decoration: none;
      }
      button.secondary, .button.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line-strong);
      }
      button.danger, .button.danger {
        background: transparent;
        color: var(--danger);
        border: 1px solid rgba(255, 143, 120, 0.35);
      }
      button.ghost, .button.ghost {
        background: rgba(255,255,255,0.03);
        color: var(--text);
        border: 1px dashed var(--line-strong);
      }
      button.mini, .button.mini {
        padding: 9px 12px;
        font-size: 0.8rem;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      .table {
        display: grid;
        gap: 10px;
      }
      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 12px;
        align-items: center;
        padding: 14px 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        text-decoration: none;
        background: rgba(255,255,255,0.02);
      }
      .row:hover { border-color: var(--line-strong); transform: translateY(-1px); }
      .row-title { font-weight: 700; }
      .row-subtitle { color: var(--muted); font-size: 0.88rem; margin-top: 4px; }
      .row-actions {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
      }
      .muted { color: var(--muted); }
      .status {
        min-height: 22px;
        color: var(--muted);
        font-size: 0.92rem;
      }
      .status.error { color: var(--danger); }
      .status.ok { color: var(--ok); }
      .dropzone {
        border: 1px dashed rgba(240,179,93,0.4);
        border-radius: 22px;
        padding: 18px;
        background: linear-gradient(180deg, rgba(240,179,93,0.08), rgba(255,255,255,0.02));
      }
      .dropzone.active {
        border-color: rgba(255, 203, 123, 0.95);
        background: linear-gradient(180deg, rgba(240,179,93,0.16), rgba(255,255,255,0.04));
      }
      .split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .hidden-input {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .upload-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .upload-note {
        color: var(--muted);
        font-size: 0.92rem;
      }
      .tiny { font-size: 0.82rem; color: var(--muted); }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .breadcrumbs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .breadcrumbs a {
        text-decoration: none;
        color: var(--muted);
      }
      .breadcrumbs a.current { color: var(--text); }
      .empty {
        padding: 26px;
        border: 1px dashed var(--line);
        border-radius: 20px;
        color: var(--muted);
      }
      .search-results { margin-top: 14px; }
      .auth-shell {
        width: min(520px, calc(100vw - 24px));
        margin: 8vh auto;
      }
      @media (max-width: 900px) {
        .hero, .grid, .split { grid-template-columns: 1fr; }
        h1 { font-size: 3rem; }
      }
    </style>
  </head>
  <body>${body}${script ? `<script type="module">${script}</script>` : ''}</body>
</html>`;
}

export function renderLoginPage({ error = '', redirect = '/admin' } = {}) {
  return shell({
    title: 'Drop login',
    body: `<main class="auth-shell">
      <section class="card">
        <div class="eyebrow">Drop · owner access</div>
        <h1>Quiet publishing, one well-kept door.</h1>
        <p class="lede">Sign in to browse the namespace, make folders, and upload files or directories. Public visitors never see this surface.</p>
        <form method="post" action="/login" class="stack" style="margin-top: 28px;">
          <input type="hidden" name="redirect" value="${escapeHtml(redirect)}" />
          <div>
            <label for="username">Username</label>
            <input id="username" type="text" name="username" autocomplete="username" required />
          </div>
          <div>
            <label for="password">Password</label>
            <input id="password" type="password" name="password" autocomplete="current-password" required />
          </div>
          ${error ? `<div class="status error">${escapeHtml(error)}</div>` : '<div class="status"></div>'}
          <div class="actions">
            <button type="submit">Sign in</button>
          </div>
        </form>
      </section>
    </main>`,
  });
}

export function renderAdminPage() {
  return shell({
    title: 'Drop admin',
    body: `<main class="page">
      <section class="hero">
        <div class="card">
          <div class="eyebrow">Drop · owner console</div>
          <h1>Drop fast. Keep it quiet.</h1>
          <p class="lede">Upload is the main event: drag files or folders straight onto the panel, or choose them with a button and let the upload start immediately. Then browse, search, move through folders, and manage what is already live.</p>
        </div>
        <section class="card stack dropzone" id="dropzone">
          <div>
            <div class="eyebrow">Upload</div>
            <p class="lede" style="margin: 0 0 14px; font-size: 1rem;">Drop files or folders here to upload immediately.</p>
          </div>
          <div>
            <label for="upload-output">Output path (optional)</label>
            <input id="upload-output" type="text" placeholder="notes/readme or projects/site/" />
            <p class="tiny">If the destination ends with <code>/</code> or has no extension, single-file uploads resolve to <code>index.*</code> using the source file extension. Markdown still generates a companion <code>index.html</code>.</p>
          </div>
          <div class="upload-actions">
            <button id="pick-files" class="secondary" type="button">Choose files</button>
            <button id="pick-folder" class="ghost" type="button">Choose folder</button>
            <span class="upload-note">Selection starts uploading as soon as you choose or drop it.</span>
          </div>
          <input id="upload-files" class="hidden-input" type="file" multiple />
          <input id="upload-folder" class="hidden-input" type="file" webkitdirectory directory multiple />
        </section>
      </section>

      <section class="grid">
        <aside class="stack">
          <section class="card stack">
            <div>
              <div class="eyebrow">Search</div>
              <label for="search-input">Find by path</label>
              <input id="search-input" type="search" placeholder="notes/readme or travel/" />
            </div>
            <div class="search-results table" id="search-results"></div>
          </section>

          <section class="card stack">
            <div>
              <div class="eyebrow">Create folder</div>
              <label for="folder-path">Path</label>
              <input id="folder-path" type="text" placeholder="drafts/essays/" />
              <p class="tiny">Empty folders are backed by a lightweight marker object so they show up before files land there.</p>
            </div>
            <div class="actions">
              <button id="create-folder" type="button">Create folder</button>
            </div>
          </section>

          <section class="card stack">
            <div>
              <div class="eyebrow">Session</div>
              <div class="pill">Owner session active</div>
            </div>
            <div class="actions">
              <a class="button secondary" href="/" target="_blank" rel="noreferrer">Open public home</a>
              <form method="post" action="/logout"><button class="secondary" type="submit">Log out</button></form>
            </div>
          </section>
        </aside>

        <section class="card">
          <div class="toolbar">
            <div>
              <div class="eyebrow">Browse</div>
              <div class="breadcrumbs" id="breadcrumbs"></div>
            </div>
            <div class="actions">
              <button id="go-root" class="secondary" type="button">Root</button>
              <button id="refresh-list" class="secondary" type="button">Refresh</button>
            </div>
          </div>
          <div id="status" class="status"></div>
          <div id="listing" class="table"></div>
        </section>
      </section>
    </main>`,
    script: adminScript(),
  });
}

export function renderDirectoryPage({ path = '', folders = [], files = [], isRoot = false }) {
  const crumbs = breadcrumbHtml(path, false);
  const visibleFiles = isRoot ? [] : files;
  const rows = [
    ...folders.map((folder) => `<a class="row" href="${escapeHtml(folder.href)}"><div><div class="row-title">${escapeHtml(folder.name)}/</div><div class="row-subtitle">Folder</div></div><div class="pill">Browse</div><div class="muted">—</div></a>`),
    ...visibleFiles.map((file) => `<a class="row" href="${escapeHtml(file.href)}"><div><div class="row-title">${escapeHtml(file.name)}</div><div class="row-subtitle">${escapeHtml(file.contentType || 'file')}</div></div><div class="pill">${escapeHtml(humanFileSize(file.size || 0))}</div><div class="muted">${file.uploaded ? escapeHtml(new Date(file.uploaded).toLocaleString()) : 'Unknown'}</div></a>`),
  ].join('');

  return shell({
    title: path ? `Drop / ${path}` : 'Drop',
    body: `<main class="page">
      <section class="hero">
        <div class="card">
          <div class="eyebrow">Drop</div>
          <h1>${isRoot ? 'Drop' : escapeHtml(path)}</h1>
          <p class="lede">${isRoot ? 'This is the quiet front door. Nothing is listed here unless you already know the path you want.' : 'This space is reachable because you know the path. It is not globally listed for anonymous visitors.'}</p>
          ${isRoot ? '' : `<div class="breadcrumbs" style="margin-top: 18px;">${crumbs}</div>`}
        </div>
      </section>
      ${isRoot ? '' : `<section class="card">
        <div class="toolbar">
          <div>
            <div class="eyebrow">Contents</div>
            <div class="muted">${folders.length} folders · ${visibleFiles.length} files</div>
          </div>
        </div>
        <div class="table">${rows || '<div class="empty">Nothing is stored here yet.</div>'}</div>
      </section>`}
    </main>`,
  });
}

function breadcrumbHtml(path, admin = true) {
  const segments = path ? path.split('/') : [];
  const crumbs = [`<a href="${admin ? '#' : '/'}" data-path="" class="${segments.length === 0 ? 'current' : ''}">root</a>`];
  let acc = '';
  for (const segment of segments) {
    acc = acc ? `${acc}/${segment}` : segment;
    crumbs.push(`<span class="muted">/</span><a href="${admin ? '#' : publicHref(acc)}" data-path="${escapeHtml(acc)}" class="${acc === path ? 'current' : ''}">${escapeHtml(segment)}</a>`);
  }
  return crumbs.join('');
}

function adminScript() {
  return `
const state = { currentPath: '', selectedFiles: [], isUploading: false };
const listingEl = document.getElementById('listing');
const statusEl = document.getElementById('status');
const breadcrumbsEl = document.getElementById('breadcrumbs');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const fileInput = document.getElementById('upload-files');
const folderInput = document.getElementById('upload-folder');
const outputInput = document.getElementById('upload-output');
const dropzone = document.getElementById('dropzone');
const pickFilesButton = document.getElementById('pick-files');
const pickFolderButton = document.getElementById('pick-folder');

function setStatus(message = '', kind = '') {
  statusEl.textContent = message;
  statusEl.className = kind ? 'status ' + kind : 'status';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSize(bytes = 0) {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let index = -1;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return (value >= 10 ? value.toFixed(0) : value.toFixed(1)) + ' ' + units[index];
}

function breadcrumbs(path) {
  const segments = path ? path.split('/') : [];
  const items = ['<a href="#" data-path="" class="' + (segments.length === 0 ? 'current' : '') + '">root</a>'];
  let acc = '';
  for (const segment of segments) {
    acc = acc ? acc + '/' + segment : segment;
    items.push('<span class="muted">/</span><a href="#" data-path="' + escapeHtml(acc) + '" class="' + (acc === path ? 'current' : '') + '">' + escapeHtml(segment) + '</a>');
  }
  return items.join('');
}

async function loadListing(path = '') {
  state.currentPath = path;
  setStatus('Loading…');
  const response = await fetch('/api/admin/list?prefix=' + encodeURIComponent(path));
  if (!response.ok) {
    setStatus('Unable to load listing.', 'error');
    return;
  }
  const data = await response.json();
  breadcrumbsEl.innerHTML = breadcrumbs(data.path || '');
  const rows = [];
  for (const folder of data.folders) {
    rows.push('<div class="row"><div><div class="row-title">' + escapeHtml(folder.name) + '/</div><div class="row-subtitle">Folder</div></div><div class="pill">Browse</div><div class="row-actions"><button class="secondary mini" type="button" data-open-folder="' + escapeHtml(folder.path) + '">Open</button><button class="danger mini" type="button" data-delete-folder="' + escapeHtml(folder.path) + '">Delete</button></div></div>');
  }
  for (const file of data.files) {
    rows.push('<div class="row"><div><div class="row-title">' + escapeHtml(file.name) + '</div><div class="row-subtitle">' + escapeHtml(file.contentType || 'file') + '</div></div><div class="pill">' + formatSize(file.size || 0) + '</div><div class="row-actions"><a class="button secondary mini" href="' + escapeHtml(file.href) + '" target="_blank" rel="noreferrer">Open</a><button class="danger mini" type="button" data-delete-file="' + escapeHtml(file.path) + '">Delete</button></div></div>');
  }
  listingEl.innerHTML = rows.join('') || '<div class="empty">Nothing is stored here yet.</div>';
  setStatus('Showing ' + (data.path || 'root'), 'ok');
}

async function runSearch(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    searchResults.innerHTML = '';
    return;
  }
  const response = await fetch('/api/admin/search?q=' + encodeURIComponent(trimmed));
  if (!response.ok) return;
  const data = await response.json();
  searchResults.innerHTML = data.results.slice(0, 20).map((result) =>
    '<a class="row" href="#" data-open-path="' + escapeHtml(result.path) + '"><div><div class="row-title">' + escapeHtml(result.path) + '</div><div class="row-subtitle">' + escapeHtml(result.contentType || 'file') + '</div></div><div class="pill">' + formatSize(result.size || 0) + '</div><div class="muted">Jump</div></a>'
  ).join('') || '<div class="empty">No matching paths.</div>';
}

function collectSelectedFiles() {
  const folderFiles = Array.from(folderInput.files || []).map((file) => ({ file, relativePath: file.webkitRelativePath || file.name }));
  const standaloneFiles = Array.from(fileInput.files || []).map((file) => ({ file, relativePath: file.name }));
  state.selectedFiles = folderFiles.length ? folderFiles : standaloneFiles;
  return state.selectedFiles;
}

async function upload(force = false) {
  const files = collectSelectedFiles();
  if (!files.length) {
    setStatus('Choose at least one file or directory before uploading.', 'error');
    return;
  }
  if (state.isUploading) return;
  state.isUploading = true;
  const form = new FormData();
  form.set('output', outputInput.value.trim());
  form.set('force', force ? 'true' : 'false');
  form.set('currentPath', state.currentPath);
  files.forEach(({ file, relativePath }) => {
    form.append('files', file, file.name);
    form.append('relativePaths', relativePath);
  });
  setStatus('Uploading…');
  const response = await fetch('/api/admin/upload', { method: 'POST', body: form });
  if (response.status === 409) {
    const data = await response.json();
    state.isUploading = false;
    if (confirm('These paths already exist:\\n\\n' + data.conflicts.join('\\n') + '\\n\\nOverwrite them?')) {
      return upload(true);
    }
    setStatus('Upload cancelled.', 'error');
    return;
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Upload failed' }));
    state.isUploading = false;
    setStatus(data.error || 'Upload failed.', 'error');
    return;
  }
  const data = await response.json();
  state.isUploading = false;
  setStatus('Uploaded ' + data.saved.length + ' object(s).', 'ok');
  fileInput.value = '';
  folderInput.value = '';
  state.selectedFiles = [];
  await loadListing(data.refreshPath || state.currentPath);
}

async function createFolder() {
  const input = document.getElementById('folder-path');
  const path = input.value.trim();
  if (!path) {
    setStatus('Enter a folder path first.', 'error');
    return;
  }
  const response = await fetch('/api/admin/folder', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || 'Unable to create folder.', 'error');
    return;
  }
  input.value = '';
  setStatus('Folder created: ' + data.path, 'ok');
  await loadListing(state.currentPath);
}

async function deletePath(path, type) {
  const noun = type === 'folder' ? 'folder and everything inside it' : 'file';
  if (!confirm('Delete this ' + noun + '?\\n\\n' + path)) return;
  const response = await fetch('/api/admin/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, type })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || 'Delete failed.', 'error');
    return;
  }
  setStatus('Deleted ' + type + ': ' + path, 'ok');
  await loadListing(state.currentPath);
}

pickFilesButton.addEventListener('click', () => fileInput.click());
pickFolderButton.addEventListener('click', () => folderInput.click());
document.getElementById('refresh-list').addEventListener('click', () => loadListing(state.currentPath));
document.getElementById('go-root').addEventListener('click', () => loadListing(''));
document.getElementById('create-folder').addEventListener('click', createFolder);
searchInput.addEventListener('input', (event) => runSearch(event.target.value));
listingEl.addEventListener('click', (event) => {
  const openFolder = event.target.closest('[data-open-folder]');
  if (openFolder) {
    event.preventDefault();
    loadListing(openFolder.getAttribute('data-open-folder'));
    return;
  }
  const deleteFile = event.target.closest('[data-delete-file]');
  if (deleteFile) {
    event.preventDefault();
    deletePath(deleteFile.getAttribute('data-delete-file'), 'file');
    return;
  }
  const deleteFolder = event.target.closest('[data-delete-folder]');
  if (deleteFolder) {
    event.preventDefault();
    deletePath(deleteFolder.getAttribute('data-delete-folder'), 'folder');
  }
});
searchResults.addEventListener('click', (event) => {
  const link = event.target.closest('[data-open-path]');
  if (!link) return;
  event.preventDefault();
  const fullPath = link.getAttribute('data-open-path');
  const folderPath = fullPath.includes('/') ? fullPath.split('/').slice(0, -1).join('/') : '';
  loadListing(folderPath);
});
breadcrumbsEl.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-path]');
  if (!link) return;
  event.preventDefault();
  loadListing(link.getAttribute('data-path'));
});
['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  dropzone.classList.add('active');
}));
['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  dropzone.classList.remove('active');
}));
dropzone.addEventListener('drop', async (event) => {
  const files = Array.from(event.dataTransfer.files || []);
  if (!files.length) return;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  fileInput.files = transfer.files;
  folderInput.value = '';
  setStatus(files.length + ' file(s) dropped. Uploading now…', 'ok');
  await upload(false);
});
fileInput.addEventListener('change', async () => {
  if (fileInput.files?.length) {
    folderInput.value = '';
    setStatus(fileInput.files.length + ' file(s) selected. Uploading now…', 'ok');
    await upload(false);
  }
});
folderInput.addEventListener('change', async () => {
  if (folderInput.files?.length) {
    fileInput.value = '';
    setStatus(folderInput.files.length + ' file(s) from folder selected. Uploading now…', 'ok');
    await upload(false);
  }
});
loadListing('');
`;
}
