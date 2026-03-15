import { describe, expect, it } from 'vitest';
import { normalizePath, resolveSingleFileDestination } from '../src/path.js';

describe('path helpers', () => {
  it('normalizes slashes and strips leading separators', () => {
    expect(normalizePath('/notes//hello.md')).toBe('notes/hello.md');
  });

  it('rejects parent segments', () => {
    expect(() => normalizePath('../secret.txt', { allowEmpty: false })).toThrow(/Parent path/);
  });

  it('treats extensionless outputs as folder targets', () => {
    expect(resolveSingleFileDestination('test.html', 'folder1/folder2')).toBe('folder1/folder2/index.html');
    expect(resolveSingleFileDestination('test.html', 'folder1/folder2/')).toBe('folder1/folder2/index.html');
  });

  it('preserves explicit file outputs', () => {
    expect(resolveSingleFileDestination('test.html', 'folder1/folder2/test.html')).toBe('folder1/folder2/test.html');
  });

  it('keeps markdown raw files addressable inside folder targets', () => {
    expect(resolveSingleFileDestination('post.md', 'notes/field-guide')).toBe('notes/field-guide/index.md');
  });
});
