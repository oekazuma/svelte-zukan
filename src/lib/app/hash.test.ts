import { describe, expect, it } from 'vitest';
import { formatHash, parseHash } from './hash.js';

describe('parseHash / formatHash', () => {
  it.each(['', '#', '#/'])('%j is the list', (hash) => {
    expect(parseHash(hash)).toEqual({ view: 'list' });
  });

  it('encodes each segment of a group name with a slash', () => {
    const hash = formatHash('detail', '@acme/ui/lib/Card');
    expect(hash).toBe('#/%40acme/ui/lib/Card');
    expect(parseHash(hash)).toEqual({ view: 'detail', path: '@acme/ui/lib/Card' });
  });

  it('round-trips a preview with a section and an ID containing preview', () => {
    const hash = formatHash('preview', 'ui/preview/Foo', 'a b?c');
    expect(parseHash(hash)).toEqual({ view: 'preview', path: 'ui/preview/Foo', section: 'a b?c' });
  });

  it('a detail ID with preview in the middle is not a preview', () => {
    expect(parseHash(formatHash('detail', 'ui/preview/Foo'))).toEqual({ view: 'detail', path: 'ui/preview/Foo' });
  });

  it('a preview without ?section has a null section', () => {
    expect(parseHash('#/preview/ui/Button')).toEqual({ view: 'preview', path: 'ui/Button', section: null });
  });

  it('round-trips Japanese IDs', () => {
    expect(parseHash(formatHash('detail', 'コンポーネント/ボタン'))).toEqual({
      view: 'detail',
      path: 'コンポーネント/ボタン'
    });
    expect(parseHash(formatHash('preview', 'ui/ボタン', '基本'))).toEqual({
      view: 'preview',
      path: 'ui/ボタン',
      section: '基本'
    });
  });

  it('keeps a malformed escape as is', () => {
    expect(parseHash('#/ui/100%')).toEqual({ view: 'detail', path: 'ui/100%' });
  });
});
