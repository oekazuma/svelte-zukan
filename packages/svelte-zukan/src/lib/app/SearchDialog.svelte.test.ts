import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { TailwindListItem, TailwindSource, ZukanMeta } from '../types.js';
import App from './App.svelte';
import { messages } from './i18n.js';
import { modifier } from './SearchDialog.svelte';
import Catalog from './Catalog.test.svelte';

const load = () => Promise.resolve({ default: Catalog });

function setup(hash = '#/ui/Card') {
  location.hash = hash;
  const entry = (group: string, name: string, meta: ZukanMeta) => ({
    group,
    name,
    dir: '',
    path: `${group}/${name}`,
    load,
    meta: vi.fn(() => Promise.resolve({ default: meta }))
  });
  const catalog = [
    entry('ui', 'Card', {
      sections: [{ title: 'Dismissible', code: '' }],
      doc: '<p>Groups related <strong>content</strong> on a raised surface.</p>',
      props: [
        {
          name: 'elevation',
          type: 'number',
          default: '1',
          required: false,
          bindable: false,
          description: 'How far the card <em>floats</em>'
        }
      ],
      propsType: null
    }),
    entry('examples', 'Gallery', { sections: [{ title: 'Grid of cards', code: '' }], doc: null }),
    { ...entry('ui', 'Broken', { sections: [], doc: null }), meta: vi.fn(() => Promise.reject(new Error('broken'))) }
  ];
  return {
    catalog,
    props: { catalog, logo: null, wrapper: null, title: 'zukan', locale: 'en' as const, searched: [] }
  };
}

const key = modifier === '⌘' ? 'Meta' : 'Control';
const openSearch = () => userEvent.keyboard(`{${key}>}k{/${key}}`);
// a closed dialog leaves the accessibility tree, so a role locator cannot find it
const isOpen = () => document.querySelector<HTMLDialogElement>('dialog[aria-label="Search the catalog"]')?.open;

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(() => {
  history.replaceState(null, '', location.pathname + location.search);
});

describe('the search dialog', () => {
  it('Ctrl+K opens it with the focus in the input and loads the metadata only then', async () => {
    const { catalog, props } = setup();
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    expect(catalog[1].meta).not.toHaveBeenCalled();
    await openSearch();
    const dialog = screen.getByRole('dialog', { name: 'Search the catalog' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByRole('combobox', { name: 'Search the catalog' })).toHaveFocus();
    for (const e of catalog.slice(1)) expect(e.meta).toHaveBeenCalledOnce();
    expect(dialog.element().closest('.zukan')).not.toBeNull();
  });

  it('opens while typing in the sidebar search box, and from the sidebar button', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await screen.getByRole('searchbox', { name: 'Search' }).click();
    await openSearch();
    await expect.poll(isOpen).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.poll(isOpen).toBe(false);
    await expect.element(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
    await screen.getByRole('button', { name: 'Search the catalog' }).click();
    await expect.poll(isOpen).toBe(true);
  });

  it('finds a section, a phrase in the description and a prop', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await openSearch();
    const input = screen.getByRole('combobox');
    const results = screen.getByRole('listbox', { name: 'Results' });
    await input.fill('dismiss');
    const sections = results.getByRole('group', { name: 'Sections' });
    await expect.element(sections.getByRole('option')).toMatchTextContent('Card');
    await expect.element(sections.getByRole('option')).toMatchTextContent('Dismissible');
    await input.fill('related content');
    await expect
      .element(results.getByRole('group', { name: 'Descriptions' }))
      .toMatchTextContent('Groups related content on a raised surface.');
    await input.fill('floats');
    const prop = results.getByRole('group', { name: 'Props' }).getByRole('option');
    await expect.element(prop).toMatchTextContent('elevation');
    await expect.element(prop).toMatchTextContent('How far the card floats');
    await expect.element(input).toHaveAttribute('aria-expanded', 'true');
    await input.fill('nothing like this');
    await expect.element(screen.getByText('No matches').last()).toBeVisible();
    await expect.element(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('a broken entry is still found by its name', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await openSearch();
    await screen.getByRole('combobox').fill('broken');
    await expect.element(screen.getByRole('option', { name: /Broken/ })).toBeInTheDocument();
  });

  it('the group filter narrows the results', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await openSearch();
    await screen.getByRole('combobox').fill('card');
    const results = screen.getByRole('listbox');
    await expect.element(results.getByRole('option', { name: /Gallery/ })).toBeInTheDocument();
    const filter = screen.getByRole('group', { name: 'Groups' });
    await filter.getByRole('button', { name: 'ui' }).click();
    await expect.element(filter.getByRole('button', { name: 'ui' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(results.getByRole('option', { name: /Gallery/ })).not.toBeInTheDocument();
    await expect.element(results.getByRole('option', { name: /Card/ }).first()).toBeInTheDocument();
    await filter.getByRole('button', { name: 'All' }).click();
    await expect.element(results.getByRole('option', { name: /Gallery/ })).toBeInTheDocument();
  });

  it('↓ and Enter open the highlighted result; a section result opens the section', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await openSearch();
    const input = screen.getByRole('combobox');
    await input.fill('card');
    const options = screen.getByRole('option');
    await expect.element(options.first()).toHaveAttribute('aria-selected', 'true');
    await expect.element(input).toHaveAttribute('aria-activedescendant', options.first().element().id);
    await userEvent.keyboard('{ArrowDown}');
    // Card (name), then the section "Grid of cards" of Gallery
    await expect.element(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect.element(input).toHaveAttribute('aria-activedescendant', options.nth(1).element().id);
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => location.hash).toBe('#/examples/Gallery?section=Grid%20of%20cards');
    expect(isOpen()).toBe(false);
  });

  it('a click opens a result', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await openSearch();
    await screen.getByRole('combobox').fill('elevation');
    await screen.getByRole('option', { name: /elevation/ }).click();
    await expect.poll(() => location.hash).toBe('#/ui/Card');
  });

  it('Escape and a click outside close it', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await openSearch();
    await expect.poll(isOpen).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.poll(isOpen).toBe(false);
    await openSearch();
    await expect.poll(isOpen).toBe(true);
    await page.elementLocator(document.body).click({ position: { x: 5, y: 5 }, force: true });
    await expect.poll(isOpen).toBe(false);
  });

  it('is listed in the shortcuts', async () => {
    const { props } = setup();
    const screen = await render(App, { props });
    await userEvent.keyboard('?');
    await expect
      .element(screen.getByRole('dialog', { name: 'Keyboard shortcuts' }))
      .toMatchTextContent('Search names, sections, props and descriptions');
  });

  it('a preview page does not open it', async () => {
    const { catalog, props } = setup('#/preview/ui/Card?section=One');
    const screen = await render(App, { props });
    await expect.element(screen.getByText('one')).toBeInTheDocument();
    await openSearch();
    expect(document.querySelector('dialog')).toBeNull();
    expect(catalog[1].meta).not.toHaveBeenCalled();
  });
});

const tailwindSource: TailwindSource = {
  id: 'app',
  file: 'src/app.css',
  version: '4.3.3',
  prefix: null,
  categories: [
    {
      id: 'background-color',
      title: 'Background Color',
      tokens: [
        { class: 'bg-brand-500', cssVariable: '--color-brand-500', value: '#ff3e00' },
        { class: 'bg-white', cssVariable: '--color-white', value: '#fff' }
      ]
    },
    { id: 'font-size', title: 'Font Size', tokens: [{ class: 'text-lg', cssVariable: '--text-lg', value: '1.125rem' }] }
  ],
  variables: { '--color-brand-500': '#ff3e00', '--color-white': '#fff', '--text-lg': '1.125rem' },
  css: [
    ':root { --color-brand-500: #ff3e00; --color-white: #fff; --text-lg: 1.125rem }',
    '.bg-brand-500 { background-color: var(--color-brand-500) }',
    '.bg-white { background-color: var(--color-white) }',
    '.text-lg { font-size: var(--text-lg) }'
  ].join('\n')
};

function setupTailwind(hash?: string, locale: 'en' | 'ja' = 'en') {
  const { catalog, props } = setup(hash);
  const tailwind: TailwindListItem[] = [
    { id: 'app', file: 'src/app.css', error: null, load: vi.fn(() => Promise.resolve({ default: tailwindSource })) },
    { id: 'broken', file: 'src/broken.css', error: null, load: vi.fn(() => Promise.reject(new Error('broken'))) }
  ];
  return { catalog, tailwind, props: { ...props, locale, tailwind } };
}

describe('Tailwind CSS in the search dialog', () => {
  it('loads the entries on the first open only and finds a class, with a swatch', async () => {
    const { tailwind, props } = setupTailwind();
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    for (const s of tailwind) expect(s.load).not.toHaveBeenCalled();
    await openSearch();
    for (const s of tailwind) expect(s.load).toHaveBeenCalledOnce();
    await screen.getByRole('combobox').fill('brand');
    const group = screen.getByRole('listbox').getByRole('group', { name: 'Tailwind CSS' });
    const option = group.getByRole('option', { name: /bg-brand-500/ });
    await expect.element(option).toMatchTextContent('Background Color');
    const swatch = option.element().querySelector<HTMLElement>('.swatch');
    expect(swatch && getComputedStyle(swatch).backgroundColor).toBe('rgb(255, 62, 0)');
    await screen.getByRole('combobox').fill('text-lg');
    await expect.element(screen.getByRole('option', { name: /text-lg/ }).first()).toBeInTheDocument();
    expect(
      screen
        .getByRole('option', { name: /text-lg/ })
        .first()
        .element()
        .querySelector('.swatch')
    ).toBeNull();
  });

  it('finds a category by its title in the catalog language and opens it unfiltered', async () => {
    const { props } = setupTailwind(undefined, 'ja');
    const screen = await render(App, { props });
    await openSearch();
    await screen.getByRole('combobox').fill('フォントサイズ');
    await screen.getByRole('option', { name: 'フォントサイズ' }).click();
    await expect.poll(() => location.hash).toBe('#/tailwind?source=app&category=font-size');
    await expect.element(screen.getByRole('searchbox', { name: messages.ja.filterTokens })).toHaveValue('');
  });

  it('the Tailwind CSS filter narrows to Tailwind results', async () => {
    const { props } = setupTailwind();
    const screen = await render(App, { props });
    await openSearch();
    await screen.getByRole('combobox').fill('c');
    const results = screen.getByRole('listbox');
    await expect.element(results.getByRole('group', { name: 'Tailwind CSS' })).toBeInTheDocument();
    await expect.element(results.getByRole('group', { name: 'Components' })).toBeInTheDocument();
    const filter = screen.getByRole('group', { name: 'Groups' });
    await filter.getByRole('button', { name: 'Tailwind CSS' }).click();
    await expect.element(results.getByRole('group', { name: 'Components' })).not.toBeInTheDocument();
    await expect.element(results.getByRole('group', { name: 'Sections' })).not.toBeInTheDocument();
    await expect.element(results.getByRole('group', { name: 'Tailwind CSS' })).toBeInTheDocument();
    await filter.getByRole('button', { name: 'ui' }).click();
    await expect.element(results.getByRole('group', { name: 'Tailwind CSS' })).not.toBeInTheDocument();
  });

  it('Enter opens the Tailwind page filtered to the token', async () => {
    const { props } = setupTailwind();
    const screen = await render(App, { props });
    await openSearch();
    await screen.getByRole('combobox').fill('brand');
    await expect.element(screen.getByRole('option', { name: /bg-brand-500/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => location.hash).toBe('#/tailwind?source=app&category=background-color&q=bg-brand-500');
    await expect.element(screen.getByRole('searchbox', { name: 'Filter tokens' })).toHaveValue('bg-brand-500');
    await expect
      .poll(() =>
        [...(screen.container.querySelector('iframe')?.contentDocument?.querySelectorAll('[data-token]') ?? [])].map(
          (el) => el.getAttribute('data-token')
        )
      )
      .toEqual(['bg-brand-500']);
  });

  it('has no Tailwind CSS group or filter without Tailwind data', async () => {
    const { props } = setup();
    const screen = await render(App, { props: { ...props, tailwind: [] } });
    await openSearch();
    await screen.getByRole('combobox').fill('c');
    await expect.element(screen.getByRole('group', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tailwind CSS' }).query()).toBeNull();
    expect(screen.getByRole('button', { name: 'Tailwind CSS' }).query()).toBeNull();
  });
});
