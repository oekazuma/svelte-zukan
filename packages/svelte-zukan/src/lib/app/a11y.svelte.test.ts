import axe from 'axe-core';
import axeSource from 'axe-core/axe.min.js?raw';
import { afterEach, describe, expect, it } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { TailwindListItem, ZukanMeta } from '../types.js';
import App from './App.svelte';
import Catalog from './Catalog.test.svelte';
import { modifier } from './SearchDialog.svelte';

const meta: ZukanMeta = {
  sections: [
    { title: 'One', code: '<p>one</p>' },
    { title: 'Two', code: '<p>two</p>' }
  ],
  doc:
    '<p>A <code>doc</code> with a <a href="https://example.com">link</a>.</p>' +
    '<table><tr><th>Variant</th><th>Use</th></tr><tr><td>primary</td><td>the main action</td></tr></table>',
  props: [
    { name: 'title', type: 'string', default: null, required: true, bindable: false, description: 'The heading' },
    { name: 'open', type: 'boolean', default: 'false', required: false, bindable: true, description: null }
  ],
  propsType: null
};

const props = (hash: string, theme: 'light' | 'dark') => {
  location.hash = hash;
  localStorage.setItem('svelte-zukan:theme', theme);
  const entry = (name: string, dir = '') => ({
    group: 'ui',
    name,
    dir,
    path: `ui/${dir ? `${dir}/` : ''}${name}`,
    load: () => Promise.resolve({ default: Catalog }),
    meta: () => Promise.resolve({ default: meta })
  });
  return {
    // two groups, so the sidebar shows its group headings
    catalog: [
      entry('Alert'),
      entry('Card'),
      entry('Button', 'forms'),
      { ...entry('Demo'), group: 'examples', path: 'examples/Demo' }
    ],
    logo: null,
    wrapper: null,
    title: 'zukan',
    locale: 'en' as const,
    searched: [],
    axe: () =>
      Promise.resolve(`window.axe = { run: async () => ({ violations: [{ id: 'image-alt', impact: 'critical',
        help: 'Images must have alternative text', helpUrl: 'https://example.com/image-alt',
        nodes: [{ target: ['body'] }] }] }) };`)
  };
};

/** the catalog UI only: what a preview renders is the user's component, checked by the panel instead */
async function violations() {
  const result = await axe.run({ include: document.querySelector('.zukan')!, exclude: 'iframe' });
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const tailwind: TailwindListItem[] = [
  {
    id: 'app',
    file: 'src/app.css',
    error: null,
    load: () =>
      Promise.resolve({
        default: {
          id: 'app',
          file: 'src/app.css',
          version: '4.3.3',
          prefix: null,
          categories: [
            {
              id: 'text-color',
              title: 'Text Color',
              tokens: [{ class: 'text-brand', cssVariable: '--color-brand', value: '#ff3e00' }]
            },
            {
              id: 'padding',
              title: 'Padding',
              tokens: [{ class: 'p-4', cssVariable: null, value: 'calc(0.25rem * 4)' }]
            },
            {
              id: 'breakpoints',
              title: 'Breakpoints',
              tokens: [{ class: null, cssVariable: '--breakpoint-sm', value: '40rem' }]
            }
          ],
          variables: { '--color-brand': '#ff3e00', '--breakpoint-sm': '40rem' },
          css: '.text-brand { color: #ff3e00 } .p-4 { padding: 1rem }'
        }
      })
  }
];

/** the cards in the sample frame; the samples themselves are the project's tokens, whatever their contrast */
async function frameViolations(container: HTMLElement) {
  await expect
    .poll(() => container.querySelector('iframe')?.contentDocument?.querySelector('[data-token]'))
    .toBeTruthy();
  const doc = container.querySelector('iframe')!.contentDocument!;
  const win = doc.defaultView as Window & { axe?: typeof axe };
  if (!win.axe) {
    const script = doc.createElement('script');
    script.textContent = axeSource;
    doc.head.append(script);
  }
  const result = await win.axe!.run(
    { include: doc.querySelector('.zukan-tokens')!, exclude: '.zukan-sample' },
    // the frame is a part of the page, which has the title, the landmarks and the heading
    {
      rules: Object.fromEntries(
        ['region', 'document-title', 'landmark-one-main', 'page-has-heading-one'].map((id) => [id, { enabled: false }])
      )
    }
  );
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

afterEach(() => {
  localStorage.clear();
  history.replaceState(null, '', location.pathname + location.search);
});

// `violations()` checks inside `.zukan`, so it cannot see content left outside every landmark of the page
it('keeps all of the catalog page in landmarks', async () => {
  await page.viewport(1280, 800);
  const screen = await render(App, { props: props('', 'light') });
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
  const result = await axe.run(document, { runOnly: ['region'] });
  expect(result.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
});

it('stops its own transitions when the system asks for reduced motion', async () => {
  const media = (value: string) =>
    cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
  await media('reduce');
  try {
    const screen = await render(App, { props: props('', 'light') });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    const card = document.querySelector('.zukan .card')!;
    expect(
      getComputedStyle(card)
        .transitionDuration.split(', ')
        .every((d) => d === '0s')
    ).toBe(true);
  } finally {
    await media('');
  }
});

it('marks the picked search result with an outline in forced colors mode, which drops its background', async () => {
  const media = (value: string) =>
    cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value }] });
  await media('active');
  try {
    const screen = await render(App, { props: props('#/ui/Card', 'light') });
    await userEvent.keyboard(modifier === '⌘' ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}');
    await screen.getByRole('combobox').fill('t');
    const option = screen.getByRole('option', { selected: true });
    await expect.element(option).toBeInTheDocument();
    expect(getComputedStyle(option.element()).outlineStyle).toBe('solid');
  } finally {
    await media('');
  }
});

describe.each(['light', 'dark'] as const)('the catalog UI in %s has no axe violations', (theme) => {
  it('on the list', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: props('', theme) });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('on a detail page with sections, a doc and props', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: props('#/ui/Card', theme) });
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Props' })).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('with the accessibility panel open', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: props('#/ui/Card', theme) });
    const check = screen.getByRole('button', { name: 'Check accessibility' }).first();
    await expect.element(check).toBeEnabled();
    await check.click();
    await expect.element(screen.getByText('Accessibility issues (1)')).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('with the search dialog showing results', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: props('#/ui/Card', theme) });
    await userEvent.keyboard(modifier === '⌘' ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}');
    // matches names, section titles, a prop and the doc
    await screen.getByRole('combobox').fill('t');
    await expect.element(screen.getByRole('option').first()).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('on a narrow screen with the menu open', async () => {
    await page.viewport(400, 800);
    const screen = await render(App, { props: props('#/ui/Card', theme) });
    await screen.getByRole('button', { name: 'Menu' }).click();
    await expect.element(screen.getByRole('navigation', { name: 'Components' })).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('on the list with a Tailwind CSS card', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: { ...props('', theme), tailwind } });
    await expect.element(screen.getByRole('definition').first()).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('on the Tailwind CSS page and in its sample frame', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: { ...props('#/tailwind', theme), tailwind } });
    expect(await frameViolations(screen.container)).toEqual([]);
    expect(await violations()).toEqual([]);
  });

  it('on the size rows of the Tailwind CSS page', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: { ...props('#/tailwind?category=padding', theme), tailwind } });
    expect(await frameViolations(screen.container)).toEqual([]);
    expect(await violations()).toEqual([]);
  });

  it('on the Tailwind CSS page on a narrow screen', async () => {
    await page.viewport(400, 800);
    const screen = await render(App, { props: { ...props('#/tailwind', theme), tailwind } });
    await expect.element(screen.getByRole('combobox', { name: 'Tailwind CSS categories' })).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });

  it('on the Full config of the Tailwind CSS page', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: { ...props('#/tailwind?category=full-config', theme), tailwind } });
    await expect.element(screen.getByRole('table', { name: '--color-*' })).toBeInTheDocument();
    expect(await violations()).toEqual([]);
  });
});
