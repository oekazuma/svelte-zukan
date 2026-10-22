import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../vite/tailwind-tokens.js';
import { categoryTitles, messages } from './i18n.js';

describe('messages', () => {
  it('en and ja have the same keys and no empty strings', () => {
    expect(Object.keys(messages.ja).sort()).toEqual(Object.keys(messages.en).sort());
    for (const value of [...Object.values(messages.en), ...Object.values(messages.ja)]) {
      expect(value.trim()).not.toBe('');
    }
  });

  it('category titles exist in both languages', () => {
    const ids = [...CATEGORIES.map((c) => c.id), 'full-config'].sort();
    for (const titles of [categoryTitles.en, categoryTitles.ja]) {
      expect(Object.keys(titles).sort()).toEqual(ids);
      for (const value of Object.values(titles)) expect(value.trim()).not.toBe('');
    }
  });
});
