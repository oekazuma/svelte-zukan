import axe from 'axe-core';
import axeSource from 'axe-core/axe.min.js?raw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { TailwindListItem, ZukanMeta } from '../types.js';
import App from './App.svelte';
import Catalog from './Catalog.test.svelte';
import { modifier } from './SearchDialog.svelte';

/** the URL the catalog gives for axe-core's script, here a stand-in's */
const scriptUrl = (source: string) =>
  Promise.resolve(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));

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
      scriptUrl(`window.axe = { run: async () => ({ violations: [{ id: 'image-alt', impact: 'critical',
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

it('marks the pressed toolbar buttons with an outline in forced colors mode, which drops their background', async () => {
  const media = (value: string) =>
    cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value }] });
  await media('active');
  try {
    const screen = await render(App, { props: props('#/ui/Card', 'light') });
    const pressed = screen.getByRole('button', { name: 'Full width', pressed: true }).first();
    await expect.element(pressed).toBeInTheDocument();
    expect(getComputedStyle(pressed.element()).outlineStyle).toBe('solid');
  } finally {
    await media('');
  }
});

/** moves the focus by keyboard to each place a route or a contents link sends it, with `check` run at each */
async function eachLandedFocus(theme: 'light' | 'dark', check: (el: HTMLElement) => void) {
  const screen = await render(App, { props: props('#/ui/Card', theme) });
  const toc = screen.getByRole('navigation', { name: 'On this page' });
  await expect.element(toc).toBeInTheDocument();
  for (const name of ['Props', 'Two']) {
    (toc.getByRole('link', { name }).element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => document.activeElement?.closest('h2')?.textContent?.trim()).toBe(name);
    check(document.activeElement as HTMLElement);
  }
  (screen.getByRole('link', { name: /Next/ }).element() as HTMLElement).focus();
  await userEvent.keyboard('{Enter}');
  await expect.poll(() => document.activeElement?.id).toBe('zukan-main');
  check(document.activeElement as HTMLElement);
}

it('keeps the focus rings where the keyboard lands in forced colors mode', async () => {
  const media = (value: string) =>
    cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value }] });
  await media('active');
  try {
    await eachLandedFocus('light', (el) => expect(getComputedStyle(el).outlineStyle).toBe('solid'));
  } finally {
    await media('');
  }
});

/** the WCAG ratio of a color at `alpha` over a background, for what axe-core does not read or can not decide */
function contrast(color: string, background: string, alpha = 1) {
  // `color-mix()` computes to `color(srgb 0-1 0-1 0-1)`
  const channels = (css: string) =>
    css
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map((c) => Number(c) * (css.startsWith('color(') ? 255 : 1));
  const back = channels(background);
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((c) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [one, two] = [luminance(channels(color).map((c, i) => c * alpha + back[i] * (1 - alpha))), luminance(back)];
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

describe.each(['light', 'dark'] as const)('the catalog UI in %s has no axe violations', (theme) => {
  it('on open code that overflows, with a comment and the copied label', async () => {
    await page.viewport(1280, 800);
    const code = `<!-- ${'a long comment '.repeat(40)} -->`;
    const base = props('#/ui/Card', theme);
    const long: ZukanMeta = {
      ...meta,
      sections: [{ title: 'One', code }],
      doc: `<pre><code>${'long code '.repeat(60)}</code></pre>`
    };
    base.catalog[1].meta = () => Promise.resolve({ default: long });
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    try {
      const screen = await render(App, { props: base });
      await screen.getByText('Code', { exact: true }).click();
      await screen.getByRole('button', { name: 'Copy' }).click();
      const copied = screen.getByRole('button', { name: 'Copied' });
      await expect.element(copied).toBeInTheDocument();
      // polled: the colors change in a short transition
      await expect
        .poll(() => {
          const { color, backgroundColor } = getComputedStyle(copied.element());
          return contrast(color, backgroundColor);
        })
        .toBeGreaterThanOrEqual(4.5);
      expect(await violations()).toEqual([]);
    } finally {
      copy.mockRestore();
    }
  });

  it('with search placeholders above 4.5:1', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: { ...props('#/tailwind', theme), tailwind } });
    await expect.element(screen.getByRole('searchbox', { name: 'Filter tokens' })).toBeInTheDocument();
    await screen.getByRole('button', { name: 'Search the catalog' }).click();
    const inputs = document.querySelectorAll<HTMLInputElement>('.zukan input[placeholder]');
    expect(inputs).toHaveLength(3);
    const page_ = getComputedStyle(document.querySelector('.zukan')!).backgroundColor;
    for (const input of inputs) {
      const { color, opacity } = getComputedStyle(input, '::placeholder');
      const own = getComputedStyle(input).backgroundColor;
      expect(contrast(color, own === 'rgba(0, 0, 0, 0)' ? page_ : own, Number(opacity))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('with focus rings above 3:1 where the keyboard lands', async () => {
    await page.viewport(1280, 800);
    await eachLandedFocus(theme, (el) => {
      const { outlineColor, outlineStyle } = getComputedStyle(el);
      expect(outlineStyle).toBe('solid');
      const background = getComputedStyle(document.querySelector('.zukan')!).backgroundColor;
      expect(contrast(outlineColor, background)).toBeGreaterThanOrEqual(3);
    });
  });

  it('with a resize grip above 3:1', async () => {
    await page.viewport(1280, 800);
    const screen = await render(App, { props: props('#/ui/Card', theme) });
    const handle = screen.getByRole('separator', { name: 'Preview width' }).first();
    await expect.element(handle).toBeInTheDocument();
    const { color, opacity } = getComputedStyle(handle.element(), '::after');
    const ratio = contrast(color, getComputedStyle(handle.element()).backgroundColor, Number(opacity));
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

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
