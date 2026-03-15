import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false,
});

export function parseMarkdownWithFrontmatter(input) {
  const source = String(input || '');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, rawFrontmatter: '', body: source };
  }

  const rawFrontmatter = match[1].trim();
  const body = match[2] || '';
  const frontmatter = parseFrontmatterBlock(rawFrontmatter);
  return { frontmatter, rawFrontmatter, body };
}

export function parseFrontmatterBlock(block) {
  const result = {};
  for (const line of String(block || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const index = line.indexOf(':');
    if (index === -1) {
      result[line.trim()] = '';
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    result[key] = value;
  }
  return result;
}

export function renderMarkdownDocument({ markdown, title }) {
  const { frontmatter, rawFrontmatter, body } = parseMarkdownWithFrontmatter(markdown);
  const heading = frontmatter.title || title || 'Untitled document';
  const html = marked.parse(body || '');

  const frontmatterEntries = Object.entries(frontmatter)
    .map(([key, value]) => `<div class="meta-row"><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('');

  const frontmatterSection = rawFrontmatter
    ? `<section class="frontmatter"><div class="frontmatter-label">Frontmatter</div><dl>${frontmatterEntries || `<div class="meta-row"><dt>raw</dt><dd>${escapeHtml(rawFrontmatter)}</dd></div>`}</dl></section>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #f7f3ec;
        --ink: #181412;
        --muted: rgba(24, 20, 18, 0.65);
        --line: rgba(24, 20, 18, 0.12);
        --accent: #7b3f00;
        --accent-soft: rgba(123, 63, 0, 0.12);
        --panel: rgba(255, 255, 255, 0.6);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Charter, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.55), transparent 42%),
          linear-gradient(180deg, #fbf7ef 0%, var(--paper) 100%);
        color: var(--ink);
      }
      .page {
        width: min(860px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 48px 0 80px;
      }
      .chrome {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 20px;
        margin-bottom: 36px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font: 600 12px/1.4 'Avenir Next', 'Segoe UI', sans-serif;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        padding: 28px;
        backdrop-filter: blur(6px);
        box-shadow: 0 24px 60px rgba(43, 28, 16, 0.08);
      }
      h1 {
        margin: 0 0 14px;
        font-size: clamp(2.4rem, 5vw, 4.8rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }
      .frontmatter {
        margin: 24px 0 40px;
        padding-top: 18px;
        border-top: 1px solid var(--line);
      }
      .frontmatter-label {
        margin-bottom: 16px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font: 700 11px/1 'Avenir Next', 'Segoe UI', sans-serif;
        color: var(--accent);
      }
      dl { margin: 0; }
      .meta-row {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid var(--line);
      }
      .meta-row:first-child { border-top: 0; }
      dt {
        font: 700 12px/1.4 'Avenir Next', 'Segoe UI', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }
      dd { margin: 0; }
      article {
        font-size: 1.17rem;
        line-height: 1.85;
      }
      article h2, article h3, article h4 {
        margin: 2.2em 0 0.7em;
        line-height: 1.1;
      }
      article h2 { font-size: 2rem; }
      article h3 { font-size: 1.55rem; }
      article p, article ul, article ol, article blockquote, article pre { margin: 0 0 1.25em; }
      article a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 0.15em; }
      article code {
        font-family: 'SF Mono', 'Cascadia Code', Consolas, monospace;
        background: var(--accent-soft);
        border-radius: 0.4em;
        padding: 0.1em 0.35em;
        font-size: 0.9em;
      }
      article pre {
        overflow: auto;
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(17, 14, 12, 0.95);
        color: #f3eee8;
      }
      article blockquote {
        margin-left: 0;
        padding-left: 18px;
        border-left: 3px solid var(--accent);
        color: var(--muted);
        font-style: italic;
      }
      @media (max-width: 720px) {
        .page { width: min(100vw - 20px, 860px); padding-top: 20px; }
        .card { padding: 20px; border-radius: 22px; }
        .meta-row { grid-template-columns: 1fr; gap: 4px; }
        article { font-size: 1.05rem; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <div class="chrome">
        <span>Drop rendered markdown</span>
        <span>${escapeHtml(heading)}</span>
      </div>
      <section class="card">
        <h1>${escapeHtml(heading)}</h1>
        ${frontmatterSection}
        <article>${html}</article>
      </section>
    </main>
  </body>
</html>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
