import { describe, expect, it } from 'vitest';
import { unionMembers } from './union.js';

describe('unionMembers', () => {
  it('splits a union at its top level only', () => {
    expect(unionMembers("'sm' | 'md' | 'lg'")).toEqual(["'sm'", "'md'", "'lg'"]);
    expect(unionMembers("((a: 'x' | 'y') => void) | null")).toEqual(["((a: 'x' | 'y') => void)", 'null']);
    expect(unionMembers("Array<'a' | 'b'> | { k: 'c' | 'd' } | [1 | 2]")).toEqual([
      "Array<'a' | 'b'>",
      "{ k: 'c' | 'd' }",
      '[1 | 2]'
    ]);
    expect(unionMembers("(e: Event) => 'a' | 'b'")).toEqual(["(e: Event) => 'a'", "'b'"]);
  });

  it('does not split inside a string literal', () => {
    expect(unionMembers('\'a | b\' | "c | (d" | `e | f`')).toEqual(["'a | b'", '"c | (d"', '`e | f`']);
  });

  it('keeps a type without a union whole', () => {
    expect(unionMembers('string')).toEqual(['string']);
    expect(unionMembers('Snippet<[{ open: boolean }]>')).toEqual(['Snippet<[{ open: boolean }]>']);
  });
});
