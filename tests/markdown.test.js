import { describe, expect, it } from 'vitest';
import { renderMarkdownDocument } from '../src/markdown.js';

describe('markdown rendering', () => {
  it('renders frontmatter and markdown body into html', () => {
    const html = renderMarkdownDocument({
      title: 'Fallback title',
      markdown: `---\ntitle: A Better Title\nauthor: Scott\n---\n\n# Hello\n\nThis is **Drop**.`,
    });

    expect(html).toContain('<h1>A Better Title</h1>');
    expect(html).toContain('<dt>author</dt><dd>Scott</dd>');
    expect(html).toContain('<strong>Drop</strong>');
  });

  it('lifts a leading # heading into the title and reflows hard-wrapped lines', () => {
    const html = renderMarkdownDocument({
      title: 'notes/field-guide.md',
      markdown: '---\r\ndate: "2026-11-12"\r\n---\r\n# Field Guide\n\nOne line\nwrapped here.',
    });

    expect(html).toContain('<title>Field Guide</title>');
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<dd>2026-11-12</dd>');
    expect(html).not.toContain('<br>');
  });

  it('falls back to the file name when there is no title', () => {
    const html = renderMarkdownDocument({ title: 'notes/field-guide.md', markdown: 'Just text.' });
    expect(html).toContain('<h1>field-guide</h1>');
  });
});
