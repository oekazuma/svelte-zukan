import { describe, expect, it } from 'vitest';
import { formatHash, formatTailwindHash, parseHash } from './hash.js';

describe('parseHash / formatHash', () => {
  it.each(['', '#', '#/'])('%j is the list', (hash) => {
    expect(parseHash(hash)).toEqual({ view: 'list' });
  });

  it('encodes each segment of a group name with a slash', () => {
    const hash = formatHash('detail', '@acme/ui/lib/Card');
    expect(hash).toBe('#/%40acme/ui/lib/Card');
    expect(parseHash(hash)).toEqual({ view: 'detail', path: '@acme/ui/lib/Card', section: null });
  });

  it('round-trips a preview with a section and an ID containing preview', () => {
    const hash = formatHash('preview', 'ui/preview/Foo', 'a b?c');
    expect(parseHash(hash)).toEqual({ view: 'preview', path: 'ui/preview/Foo', section: 'a b?c' });
  });

  it('a detail ID with preview in the middle is not a preview', () => {
    expect(parseHash(formatHash('detail', 'ui/preview/Foo'))).toEqual({
      view: 'detail',
      path: 'ui/preview/Foo',
      section: null
    });
  });

  it('round-trips a detail page with a section', () => {
    expect(parseHash(formatHash('detail', 'ui/Card', 'a b?c'))).toEqual({
      view: 'detail',
      path: 'ui/Card',
      section: 'a b?c'
    });
  });

  it('round-trips an empty section, which is the props of a detail page', () => {
    const hash = formatHash('detail', 'ui/Card', '');
    expect(hash).toBe('#/ui/Card?section=');
    expect(parseHash(hash)).toEqual({ view: 'detail', path: 'ui/Card', section: '' });
  });

  it('a preview without ?section has a null section', () => {
    expect(parseHash('#/preview/ui/Button')).toEqual({ view: 'preview', path: 'ui/Button', section: null });
  });

  it('round-trips Japanese IDs', () => {
    expect(parseHash(formatHash('detail', 'コンポーネント/ボタン'))).toEqual({
      view: 'detail',
      path: 'コンポーネント/ボタン',
      section: null
    });
    expect(parseHash(formatHash('preview', 'ui/ボタン', '基本'))).toEqual({
      view: 'preview',
      path: 'ui/ボタン',
      section: '基本'
    });
  });

  it('round-trips an ID containing ? and #', () => {
    const path = 'ui/a?b#c/D';
    expect(parseHash(formatHash('detail', path))).toEqual({ view: 'detail', path, section: null });
    expect(parseHash(formatHash('preview', path, 'x#y'))).toEqual({ view: 'preview', path, section: 'x#y' });
  });

  it('keeps a malformed escape as is', () => {
    expect(parseHash('#/ui/100%')).toEqual({ view: 'detail', path: 'ui/100%', section: null });
  });
});

describe('shared view', () => {
  it('round-trips a width and a theme', () => {
    const hash = formatHash('detail', 'ui/Card', 'One', { width: 375, theme: 'dark' });
    expect(hash).toBe('#/ui/Card?section=One&width=375&theme=dark');
    expect(parseHash(hash)).toEqual({ view: 'detail', path: 'ui/Card', section: 'One', width: 375, theme: 'dark' });
    expect(parseHash(formatHash('preview', 'ui/Card', 'One', { theme: 'light' }))).toMatchObject({ theme: 'light' });
  });

  it('ignores values it does not know', () => {
    const route = parseHash('#/ui/Card?width=-3&theme=blue');
    expect(route).toMatchObject({ width: undefined, theme: undefined });
    expect(parseHash('#/ui/Card?width=12.5')).toMatchObject({ width: undefined });
  });
});

describe('the Tailwind page', () => {
  it('parses the Tailwind page', () => {
    expect(parseHash('#/tailwind?source=abc&category=spacing')).toEqual({
      view: 'tailwind',
      source: 'abc',
      category: 'spacing',
      q: null
    });
    expect(parseHash('#/tailwind')).toEqual({ view: 'tailwind', source: null, category: null, q: null });
    expect(parseHash('#/tailwind/Button').view).toBe('detail');
  });

  it('round-trips a source and a category', () => {
    expect(formatTailwindHash()).toBe('#/tailwind');
    const hash = formatTailwindHash('a b', 'font-size');
    expect(hash).toBe('#/tailwind?source=a%20b&category=font-size');
    expect(parseHash(hash)).toEqual({ view: 'tailwind', source: 'a b', category: 'font-size', q: null });
  });

  it('round-trips a filter, with %20 for a space; an empty one is left out', () => {
    const hash = formatTailwindHash('app', 'background-color', 'bg brand+500&x');
    expect(hash).toBe('#/tailwind?source=app&category=background-color&q=bg%20brand%2B500%26x');
    expect(parseHash(hash)).toMatchObject({ source: 'app', category: 'background-color', q: 'bg brand+500&x' });
    expect(formatTailwindHash('app', undefined, '')).toBe('#/tailwind?source=app');
  });
});
