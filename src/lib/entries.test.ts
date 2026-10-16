import { describe, expect, it, vi } from 'vitest';
import { buildEntries, resolveBase, zukanEntries } from './entries';

const loader = () => Promise.resolve({});

describe('buildEntries', () => {
  it('orders by group key then name', () => {
    const entries = buildEntries({
      b: { '/x/Z/zukan/Z.zukan.svelte': loader, '/x/A/zukan/A.zukan.svelte': loader },
      a: { '/y/M/zukan/M.zukan.svelte': loader }
    });
    expect(entries.map((e) => e.path)).toEqual(['b/A', 'b/Z', 'a/M']);
    expect(entries[0]).toMatchObject({ group: 'b', name: 'A' });
  });

  it("throws on reserved group 'preview'", () => {
    expect(() => buildEntries({ preview: { '/x/A/zukan/A.zukan.svelte': loader } })).toThrow(/preview/);
  });

  it('throws on duplicate name in group', () => {
    const a = '/x/A/zukan/A.zukan.svelte';
    const b = '/y/A/zukan/A.zukan.svelte';
    expect(() => buildEntries({ g: { [a]: loader, [b]: loader } })).toThrow(new RegExp(`${a}[\\s\\S]*${b}`));
  });

  it('throws on a key without the .zukan.svelte suffix', () => {
    expect(() => buildEntries({ g: { '/x/A.svelte': loader } })).toThrow(/\/x\/A\.svelte/);
  });

  it('same name in different groups is allowed', () => {
    const entries = buildEntries({
      g: { '/x/A/zukan/A.zukan.svelte': loader },
      h: { '/y/A/zukan/A.zukan.svelte': loader }
    });
    expect(entries.map((e) => e.path)).toEqual(['g/A', 'h/A']);
  });
});

describe('zukanEntries', () => {
  it('lists index, details and previews', () => {
    const fn = vi.fn();
    expect(zukanEntries({ g: { '/a/Foo/zukan/Foo.zukan.svelte': fn } })).toEqual([
      { path: '' },
      { path: 'g/Foo' },
      { path: 'preview/g/Foo' }
    ]);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('resolveBase', () => {
  it.each([
    ['/zukan/components/Button', 'components/Button', '/zukan'],
    ['/app/zukan', '', '/app/zukan'],
    ['/zukan/', '', '/zukan'],
    ['/', '', ''],
    ['/zukan/preview/a/B', 'preview/a/B', '/zukan'],
    ['/zukan/components/%E3%83%9C%E3%82%BF%E3%83%B3', 'components/ボタン', '/zukan'],
    ['/zukan/ui/My%20Button', 'ui/My Button', '/zukan']
  ])('%s + %s -> %s', (pathname, path, expected) => {
    expect(resolveBase(pathname, path)).toBe(expected);
  });
});
