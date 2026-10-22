import { assert, describe, expect, it } from 'vitest';
import { categoryTitles } from './i18n.js';
import { search, type SearchItem, type TailwindSearchItem } from './search.js';

const item = (path: string, more: Partial<SearchItem> = {}): SearchItem => ({
  path,
  name: path.split('/').at(-1)!,
  group: path.split('/')[0],
  sections: [],
  doc: '',
  props: [],
  ...more
});

const summary = (hits: ReturnType<typeof search>) =>
  hits.map((h) =>
    h.kind === 'tailwind'
      ? `tailwind:${h.item.source}/${h.item.category}:${h.label ?? ''}`
      : `${h.kind}:${h.item.path}:${h.label ?? ''}`
  );

const tailwind = (locale: 'en' | 'ja'): TailwindSearchItem[] => [
  {
    source: 'app',
    category: 'background-color',
    title: categoryTitles[locale]['background-color'],
    tokens: [
      { class: 'bg-brand-500', cssVariable: '--color-brand-500', value: '#ff3e00' },
      { class: 'bg-white', cssVariable: '--color-white', value: '#fff' }
    ]
  },
  {
    source: 'app',
    category: 'font-size',
    title: categoryTitles[locale]['font-size'],
    tokens: [{ class: 'text-lg', cssVariable: '--text-lg', value: '1.125rem' }]
  },
  {
    source: 'app',
    category: 'full-config',
    title: categoryTitles[locale]['full-config'],
    tokens: [
      { class: null, cssVariable: '--color-brand-500', value: '#ff3e00' },
      { class: null, cssVariable: '--text-lg', value: '1.125rem' }
    ]
  }
];

describe('search', () => {
  it('an empty query finds nothing', () => {
    expect(search([item('ui/Button')], '  ', null)).toEqual([]);
  });

  it('ranks name prefix, ID, section, prop name, prop description, description', () => {
    const items = [
      item('ui/Card', { doc: 'Shows a <button> in a card' }),
      item('ui/Dialog', { props: [{ name: 'open', description: 'Renders a close button' }] }),
      item('ui/Menu', { props: [{ name: 'buttonLabel', description: '' }] }),
      item('ui/Form', { sections: ['With a button'] }),
      item('ui/buttons/Group'),
      item('ui/Button')
    ];
    expect(summary(search(items, 'BUTTON', null))).toEqual([
      'component:ui/Button:',
      'component:ui/buttons/Group:',
      'section:ui/Form:With a button',
      'prop:ui/Menu:buttonLabel',
      'prop:ui/Dialog:open',
      'description:ui/Card:'
    ]);
  });

  it('keeps catalog order within a tier and lists every matching section', () => {
    const items = [item('ui/B', { sections: ['Small', 'Large small'] }), item('ui/A', { sections: ['small'] })];
    expect(summary(search(items, 'small', null))).toEqual([
      'section:ui/B:Small',
      'section:ui/B:Large small',
      'section:ui/A:small'
    ]);
  });

  it('matches Japanese text and cuts a snippet around the match', () => {
    const doc = `${'前置き'.repeat(20)}ボタンを押すと閉じます。${'後書き'.repeat(20)}`;
    const [hit] = search([item('ui/Dialog', { doc })], '閉じ', null);
    assert(hit.kind === 'description');
    expect(hit.snippet).toMatch(/^….*ボタンを押すと閉じます.*…$/);
    expect(hit.snippet!.length).toBeLessThan(80);
  });

  it('collapses whitespace in snippets', () => {
    const [hit] = search([item('ui/A', { doc: 'one\n\n  two' })], 'two', null);
    assert(hit.kind === 'description');
    expect(hit.snippet).toBe('one two');
  });

  it('a prop name match shows the start of its description', () => {
    const [hit] = search([item('ui/A', { props: [{ name: 'size', description: 'The size' }] })], 'siz', null);
    expect(hit).toMatchObject({ kind: 'prop', label: 'size', snippet: 'The size' });
  });

  it('filters by group', () => {
    const items = [item('ui/Button'), item('examples/Button')];
    expect(summary(search(items, 'button', new Set(['examples'])))).toEqual(['component:examples/Button:']);
  });

  it('caps the results', () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`ui/Item${i}`));
    expect(search(items, 'item', null)).toHaveLength(20);
    expect(search(items, 'item', null, 5)).toHaveLength(5);
  });

  describe('Tailwind CSS', () => {
    it('finds a class, and a variable where the class does not match, with its value', () => {
      expect(summary(search([], 'brand', null, 20, tailwind('en')))).toEqual([
        'tailwind:app/background-color:bg-brand-500',
        'tailwind:app/full-config:--color-brand-500'
      ]);
      expect(search([], 'color-white', null, 20, tailwind('en'))).toMatchObject([
        { kind: 'tailwind', label: '--color-white', value: '#fff' }
      ]);
    });

    it('finds a category by its title in English and in Japanese, with no label', () => {
      expect(summary(search([], 'font size', null, 20, tailwind('en')))).toEqual(['tailwind:app/font-size:']);
      const ja = categoryTitles.ja['font-size'];
      expect(summary(search([], ja, null, 20, tailwind('ja')))).toEqual(['tailwind:app/font-size:']);
      expect(summary(search([], 'font size', null, 20, tailwind('ja')))).toEqual([]);
    });

    it('comes after every component result, those starting with the query first', () => {
      const items = [item('ui/Text'), item('ui/RichText'), item('ui/Card', { sections: ['Long text'] })];
      expect(summary(search(items, 'text', null, 20, tailwind('en')))).toEqual([
        'component:ui/Text:',
        'component:ui/RichText:',
        'section:ui/Card:Long text',
        'tailwind:app/font-size:text-lg',
        'tailwind:app/full-config:--text-lg'
      ]);
    });

    it('never pushes component results out and is capped on its own', () => {
      const items = [
        ...Array.from({ length: 25 }, (_, i) => item(`ui/Text${i}`)),
        item('ui/RichText', { sections: ['Long text'] })
      ];
      const many: TailwindSearchItem[] = [
        {
          source: 'app',
          category: 'font-size',
          title: 'Font Size',
          tokens: Array.from({ length: 300 }, (_, i) => ({ class: `text-${i}`, cssVariable: null, value: '1rem' }))
        }
      ];
      const components = search(items, 'text', null);
      const hits = search(items, 'text', null, 20, many);
      expect(hits.slice(0, components.length)).toEqual(components);
      expect(components).toHaveLength(20);
      expect(summary(hits.slice(components.length))).toEqual(
        Array.from({ length: 10 }, (_, i) => `tailwind:app/font-size:text-${i}`)
      );
      expect(search([item('ui/Text'), item('ui/RichText')], 'text', null, 20, many, 3)).toHaveLength(5);
    });
  });
});
