import { Marked } from 'marked';
import { FAVICON_LINKS } from './favicon.js';
import { FONT_MONO, FONT_SANS, FONT_SERIF, paletteCss } from './theme.js';

// Standard GitHub-file semantics: single newlines inside a paragraph do not
// become <br>, so hard-wrapped prose reflows naturally.
const marked = new Marked({ gfm: true, breaks: false });

export function parseMarkdownWithFrontmatter(input) {
  const source = String(input || '').replace(/^﻿/, '');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n([\s\S]*))?$/);
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
    const value = line.slice(index + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    result[key] = value;
  }
  return result;
}

export function renderMarkdownDocument({ markdown, title }) {
  const { frontmatter, rawFrontmatter, body } = parseMarkdownWithFrontmatter(markdown);
  // Title preference: frontmatter `title`, then a `# Heading` that opens the
  // body (lifted into the page header so frontmatter can sit beneath it),
  // then the file name.
  const headingPattern = /^\s*#[ \t]+(.+?)[ \t#]*(?:\r?\n|$)/;
  const bodyHeading = frontmatter.title ? null : headingPattern.exec(body)?.[1];
  const fallback = String(title || 'Untitled').split('/').at(-1).replace(/\.(md|markdown)$/i, '');
  const heading = frontmatter.title || bodyHeading || fallback;
  const content = bodyHeading ? body.replace(headingPattern, '') : body;
  const html = marked.parse(content || '');

  const metaEntries = Object.entries(frontmatter).filter(([key]) => key !== 'title');
  const meta = metaEntries.length
    ? `<dl class="meta">${metaEntries.map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`
    : rawFrontmatter && !frontmatter.title
      ? `<pre class="meta-raw">${escapeHtml(rawFrontmatter)}</pre>`
      : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
    ${FAVICON_LINKS}
    <style>
      ${paletteCss()}
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font: 19px/1.7 ${FONT_SERIF};
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      main {
        width: min(68ch, 100% - 40px);
        margin: 0 auto;
        padding: 72px 0 120px;
      }
      header { margin-bottom: 2.5em; }
      h1, h2, h3, h4 { line-height: 1.15; letter-spacing: -0.015em; font-weight: 700; text-wrap: balance; }
      h1 { font-size: 2.6em; margin: 0 0 0.4em; letter-spacing: -0.025em; }
      h2 { font-size: 1.6em; margin: 2em 0 0.6em; }
      h3 { font-size: 1.25em; margin: 1.8em 0 0.5em; }
      h4 { font-size: 1em; margin: 1.6em 0 0.4em; }
      p, ul, ol, blockquote, pre, table, figure { margin: 0 0 1.2em; }
      li + li { margin-top: 0.25em; }
      a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
      strong { font-weight: 700; }
      hr { border: 0; border-top: 1px solid var(--border); margin: 2.5em 0; }
      img, video { max-width: 100%; height: auto; border-radius: 6px; }
      code { font-family: ${FONT_MONO}; font-size: 0.82em; background: var(--surface-2); border-radius: 4px; padding: 0.12em 0.35em; }
      pre {
        overflow-x: auto;
        padding: 1em 1.2em;
        background: var(--surface-2);
        border: 1px solid var(--border);
        border-radius: 8px;
        line-height: 1.55;
      }
      pre code { background: none; padding: 0; font-size: 0.8em; }
      blockquote { margin-left: 0; padding-left: 1.1em; border-left: 3px solid var(--accent); color: var(--muted); }
      table { width: 100%; border-collapse: collapse; font: 15px/1.5 ${FONT_SANS}; display: block; overflow-x: auto; }
      th, td { padding: 0.5em 0.8em; border-bottom: 1px solid var(--border); text-align: left; }
      th { font-weight: 600; border-bottom-color: var(--border-strong); }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 28px;
        margin: 0;
        padding-top: 14px;
        border-top: 1px solid var(--border);
        font: 13px/1.4 ${FONT_SANS};
      }
      .meta div { display: flex; gap: 8px; }
      .meta dt { color: var(--faint); text-transform: capitalize; }
      .meta dd { margin: 0; color: var(--muted); }
      .meta-raw { font-size: 13px; color: var(--muted); }
      @media (max-width: 640px) {
        body { font-size: 17px; }
        main { padding-top: 40px; }
        h1 { font-size: 2.1em; }
      }
    </style>
  </head>
  <body>
    <main>
      <header><h1>${escapeHtml(heading)}</h1>${meta}</header>
      <article>${html}</article>
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
