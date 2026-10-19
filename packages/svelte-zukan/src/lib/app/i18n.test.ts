import { describe, expect, it } from 'vitest';
import { messages } from './i18n.js';

describe('messages', () => {
  it('en and ja have the same keys and no empty strings', () => {
    expect(Object.keys(messages.ja).sort()).toEqual(Object.keys(messages.en).sort());
    for (const value of [...Object.values(messages.en), ...Object.values(messages.ja)]) {
      expect(value.trim()).not.toBe('');
    }
  });
});
