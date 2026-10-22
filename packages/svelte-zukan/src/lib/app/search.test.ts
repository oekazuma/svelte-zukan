import { describe, expect, it } from 'vitest';
import { search, type SearchItem } from './search.js';

const item = (path: string, more: Partial<SearchItem> = {}): SearchItem => ({
  path,
  name: path.split('/').at(-1)!,
  group: path.split('/')[0],
  sections: [],
  doc: '',
  props: [],
  ...more
});

const summary = (hits: ReturnType<typeof search>) => hits.map((h) => `${h.kind}:${h.item.path}:${h.label ?? ''}`);

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
    expect(hit.kind).toBe('description');
    expect(hit.snippet).toMatch(/^….*ボタンを押すと閉じます.*…$/);
    expect(hit.snippet!.length).toBeLessThan(80);
  });

  it('collapses whitespace in snippets', () => {
    const [hit] = search([item('ui/A', { doc: 'one\n\n  two' })], 'two', null);
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
});
