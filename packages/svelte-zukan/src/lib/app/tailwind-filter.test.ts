import { describe, expect, it } from 'vitest';
import { countTokens, groupVariables } from './tailwind-filter.js';

describe('groupVariables', () => {
  it('groups by namespace in Tailwind order, the longest namespace first, unknown ones last', () => {
    const groups = groupVariables(
      [
        ['--text-shadow-sm', 'x'],
        ['--font-weight-bold', '700'],
        ['--spacing', '0.25rem'],
        ['--color-red-500', 'red'],
        ['--brand', 'x'],
        ['--font-sans', 'x'],
        ['--text-sm', 'x'],
        ['--color-white', '#fff']
      ],
      null
    );
    expect(groups.map((g) => [g.title, g.variables.map(([name]) => name)])).toEqual([
      ['--color-*', ['--color-red-500', '--color-white']],
      ['--font-*', ['--font-sans']],
      ['--text-*', ['--text-sm']],
      ['--font-weight-*', ['--font-weight-bold']],
      ['--spacing', ['--spacing']],
      ['--text-shadow-*', ['--text-shadow-sm']],
      [null, ['--brand']]
    ]);
  });

  it('reads the namespace after the prefix', () => {
    expect(
      groupVariables(
        [
          ['--tw-color-red-500', 'red'],
          ['--color-x', 'x']
        ],
        'tw'
      ).map((g) => g.title)
    ).toEqual(['--tw-color-*', null]);
  });
});

describe('countTokens', () => {
  it('counts a token that two categories list once', () => {
    const p4 = { class: 'p-4', cssVariable: null, value: '1rem' };
    expect(
      countTokens([
        { id: 'spacing', title: 'Spacing', tokens: [{ class: null, cssVariable: '--spacing', value: '0.25rem' }, p4] },
        { id: 'padding', title: 'Padding', tokens: [p4, { class: 'p-5', cssVariable: null, value: '1.25rem' }] }
      ])
    ).toBe(3);
  });
});
