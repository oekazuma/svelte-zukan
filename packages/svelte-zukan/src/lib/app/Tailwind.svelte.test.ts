import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { TailwindListItem, TailwindSource } from '../types.js';
import App from './App.svelte';

const source: TailwindSource = {
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
    {
      id: 'font-size',
      title: 'Font Size',
      tokens: [{ class: 'text-lg', cssVariable: '--text-lg', value: '1.125rem' }]
    },
    {
      id: 'breakpoints',
      title: 'Breakpoints',
      tokens: [{ class: null, cssVariable: '--breakpoint-sm', value: '40rem' }]
    }
  ],
  variables: {
    '--color-brand-500': '#ff3e00',
    '--color-white': '#fff',
    '--text-lg': '1.125rem',
    '--breakpoint-sm': '40rem'
  },
  // the brand colour comes from a :root variable; the dark rule must never apply in the samples
  css: [
    ':root { --color-brand-500: #ff3e00; --color-white: #fff; --text-lg: 1.125rem }',
    '.bg-brand-500 { background-color: var(--color-brand-500) }',
    '@media (prefers-color-scheme: dark) { .bg-brand-500 { background-color: rgb(0, 0, 255) } }',
    '.bg-white { background-color: var(--color-white) }',
    '.text-lg { font-size: var(--text-lg) }'
  ].join('\n')
};

const item = (data: TailwindSource, error: string | null = null): TailwindListItem => ({
  id: data.id,
  file: data.file,
  error,
  load: () => Promise.resolve({ default: data })
});

function props(hash: string, tailwind: TailwindListItem[] = [item(source)]) {
  location.hash = hash;
  return {
    catalog: [],
    logo: null,
    wrapper: null,
    title: 'zukan',
    locale: 'en' as const,
    searched: [],
    tailwind
  };
}

async function setHash(hash: string) {
  const changed = new Promise((r) => addEventListener('hashchange', r, { once: true }));
  location.hash = hash;
  await changed;
  await tick();
}

/** the sample document, once the tokens are mounted in it */
async function frame(container: HTMLElement) {
  await expect
    .poll(() => container.querySelector('iframe')?.contentDocument?.querySelector('[data-token]'))
    .toBeTruthy();
  const iframe = container.querySelector('iframe')!;
  return { iframe, doc: iframe.contentDocument! };
}

const tokenTexts = (doc: Document) =>
  [...doc.querySelectorAll('[data-token]')].map((el) => el.getAttribute('data-token'));

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(() => {
  localStorage.clear();
  history.replaceState(null, '', location.pathname + location.search);
});

describe('the Tailwind CSS page', () => {
  it('shows the first category in an iframe with the class and the variable', async () => {
    const screen = await render(App, { props: props('#/tailwind') });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Tailwind CSS' })).toBeInTheDocument();
    expect(document.title).toBe('Tailwind CSS | zukan');
    await expect.element(screen.getByRole('main').getByText('src/app.css')).toBeInTheDocument();
    await expect
      .element(screen.getByRole('link', { name: 'Background Color' }))
      .toHaveAttribute('aria-current', 'page');
    const { doc } = await frame(screen.container);
    expect(tokenTexts(doc)).toEqual(['bg-brand-500', 'bg-white']);
    expect(doc.body.textContent).toContain('--color-brand-500');
    expect(doc.body.textContent).toContain('#ff3e00');
  });

  it('draws a :root-based swatch', async () => {
    const screen = await render(App, { props: props('#/tailwind') });
    const { doc } = await frame(screen.container);
    const sample = doc.querySelector('.bg-brand-500')!;
    await expect.poll(() => getComputedStyle(sample).backgroundColor).toBe('rgb(255, 62, 0)');
  });

  it('keeps the sample CSS out of the catalog document', async () => {
    const screen = await render(App, { props: props('#/tailwind') });
    const { doc } = await frame(screen.container);
    expect([...doc.querySelectorAll('style')].some((s) => s.textContent!.includes('.bg-brand-500'))).toBe(true);
    expect([...document.querySelectorAll('style')].some((s) => s.textContent!.includes('.bg-brand-500'))).toBe(false);
    expect(document.querySelector('.bg-brand-500')).toBeNull();
  });

  it('switches category through the hash', async () => {
    const screen = await render(App, { props: props('#/tailwind') });
    await frame(screen.container);
    await screen.getByRole('link', { name: 'Font Size' }).click();
    expect(location.hash).toBe('#/tailwind?source=app&category=font-size');
    await expect.element(screen.getByRole('link', { name: 'Font Size' })).toHaveAttribute('aria-current', 'page');
    await expect
      .poll(() => tokenTexts(screen.container.querySelector('iframe')!.contentDocument!))
      .toEqual(['text-lg']);
    // a text category has a sample text field
    await screen.getByRole('textbox', { name: 'Sample text' }).fill('Hello zukan');
    await expect
      .poll(() => screen.container.querySelector('iframe')!.contentDocument!.body.textContent)
      .toContain('Hello zukan');
    await setHash('#/tailwind?category=breakpoints');
    await expect
      .poll(() => tokenTexts(screen.container.querySelector('iframe')!.contentDocument!))
      .toEqual(['--breakpoint-sm']);
  });

  it('filters by class name and value', async () => {
    const screen = await render(App, { props: props('#/tailwind') });
    const { doc } = await frame(screen.container);
    const filter = screen.getByRole('searchbox', { name: 'Filter tokens' });
    await filter.fill('brand');
    await expect.poll(() => tokenTexts(doc)).toEqual(['bg-brand-500']);
    await filter.fill('#fff');
    await expect.poll(() => tokenTexts(doc)).toEqual(['bg-white']);
    await filter.fill('nothing like this');
    await expect.poll(() => doc.body.textContent).toContain('No matching tokens');
  });

  it('copies the class name', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    try {
      const screen = await render(App, { props: props('#/tailwind') });
      const { doc } = await frame(screen.container);
      doc.querySelector<HTMLButtonElement>('button[aria-label="Copy class: bg-brand-500"]')!.click();
      await expect.poll(() => writeText.mock.calls).toEqual([['bg-brand-500']]);
      await expect.poll(() => doc.body.textContent).toContain('Copied');
      doc.querySelector<HTMLButtonElement>('button[aria-label="Copy variable: --color-brand-500"]')!.click();
      await expect.poll(() => writeText.mock.calls.at(-1)).toEqual(['--color-brand-500']);
    } finally {
      writeText.mockRestore();
    }
  });

  it('keeps samples light in the dark catalog theme', async () => {
    localStorage.setItem('svelte-zukan:theme', 'dark');
    // the catalog page sets it from its theme; here App is rendered into a container, which that rule does not match
    document.documentElement.style.colorScheme = 'dark';
    try {
      const screen = await render(App, { props: props('#/tailwind') });
      const { iframe, doc } = await frame(screen.container);
      expect(getComputedStyle(iframe).colorScheme).toBe('light');
      expect(getComputedStyle(doc.documentElement).colorScheme).toBe('light');
      expect(doc.defaultView!.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
      await expect
        .poll(() => getComputedStyle(doc.querySelector('.bg-brand-500')!).backgroundColor)
        .toBe('rgb(255, 62, 0)');
    } finally {
      document.documentElement.style.colorScheme = '';
    }
  });

  it('lists every theme variable in Full config', async () => {
    const screen = await render(App, { props: props('#/tailwind?category=full-config') });
    await expect.element(screen.getByRole('link', { name: 'Full config' })).toHaveAttribute('aria-current', 'page');
    const table = screen.getByRole('table');
    for (const [name, value] of Object.entries(source.variables)) {
      await expect.element(table.getByRole('row', { name: `${name} ${value}` })).toBeInTheDocument();
    }
    await screen.getByRole('searchbox', { name: 'Filter tokens' }).fill('breakpoint');
    await expect.poll(() => table.getByRole('row').elements().length).toBe(2);
  });

  it("shows the entry's error instead of the tokens", async () => {
    const broken = { ...source, categories: [], variables: {}, css: '' };
    const error = 'Tailwind CSS 4.0.5 is older than 4.1.0, the first version svelte-zukan supports';
    const screen = await render(App, { props: props('#/tailwind', [item(broken, error)]) });
    await expect.element(screen.getByText(error, { exact: false })).toBeInTheDocument();
    await expect
      .element(screen.getByText('Could not load the Tailwind CSS data:', { exact: false }))
      .toBeInTheDocument();
    expect(screen.container.querySelector('iframe')).toBeNull();
  });

  it('shows the selected entry', async () => {
    const other = { ...source, id: 'other', file: 'src/other.css' };
    const screen = await render(App, { props: props('#/tailwind?source=other', [item(source), item(other)]) });
    await expect.element(screen.getByRole('main').getByText('src/other.css')).toBeInTheDocument();
    await expect
      .element(screen.getByRole('link', { name: 'Tailwind CSS (src/other.css)' }))
      .toHaveAttribute('aria-current', 'page');
  });
});
