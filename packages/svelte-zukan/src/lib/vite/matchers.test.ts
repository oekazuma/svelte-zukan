import { describe, expect, it } from 'vitest';
import { zukan } from './index.js';
import { createMatchers } from './matchers.js';

describe('createMatchers', () => {
  it('follows the suffix', () => {
    const { isCatalogFile, isDocFile } = createMatchers('catalog');
    expect(isCatalogFile('/a/Foo.catalog.svelte')).toBe(true);
    expect(isCatalogFile('/a/Foo.zukan.svelte')).toBe(false);
    expect(isDocFile('/a/Foo.catalog.md')).toBe(true);
    expect(isDocFile('/a/Foo.zukan.md')).toBe(false);
    expect(isDocFile('/a/Document.md')).toBe(false);
  });

  it('maps a catalog file to its doc file', () => {
    const { docFileOf } = createMatchers('zukan');
    expect(docFileOf('/a/Foo.zukan.svelte')).toBe('/a/Foo.zukan.md');
  });

  it('is case-sensitive, using the suffix verbatim', () => {
    const { isCatalogFile } = createMatchers('zukan');
    expect(isCatalogFile('/a/Foo.ZUKAN.svelte')).toBe(false);
  });

  it.each(['a.b', '', 'a b', 'a|b'])('rejects invalid suffix %j', (suffix) => {
    expect(() => createMatchers(suffix)).toThrow(/suffix/);
    expect(() => zukan({ suffix })).toThrow(/suffix/);
  });
});
