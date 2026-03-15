import { describe, expect, it } from 'vitest';
import { renderMarkdownDocument } from '../src/markdown.js';

describe('markdown rendering', () => {
  it('renders frontmatter and markdown body into html', () => {
    const html = renderMarkdownDocument({
      title: 'Fallback title',
      markdown: `---\ntitle: A Better Title\nauthor: Scott\n---\n\n# Hello\n\nThis is **Drop**.`,
    });

    expect(html).toContain('A Better Title');
    expect(html).toContain('Frontmatter');
    expect(html).toContain('Scott');
    expect(html).toContain('<strong>Drop</strong>');
  });
});
