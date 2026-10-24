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

/** sizes drawn as rows, with the CSS their samples need */
const sizes: TailwindSource = {
  ...source,
  categories: [
    source.categories[0],
    {
      id: 'padding',
      title: 'Padding',
      tokens: [
        { class: 'p-0', cssVariable: null, value: '0px' },
        { class: 'p-4', cssVariable: null, value: 'calc(0.25rem * 4)' }
      ]
    },
    {
      id: 'breakpoints',
      title: 'Breakpoints',
      tokens: [
        { class: null, cssVariable: '--breakpoint-sm', value: '40rem' },
        { class: null, cssVariable: '--breakpoint-md', value: '48rem' }
      ]
    }
  ],
  css: [
    source.css,
    ':root { --spacing: 0.25rem }',
    '.p-0 { padding: calc(var(--spacing) * 0) }',
    '.p-4 { padding: calc(var(--spacing) * 4) }'
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

  it('lists the categories in groups, with their token counts', async () => {
    const screen = await render(App, { props: props('#/tailwind') });
    const nav = screen.getByRole('navigation', { name: 'Tailwind CSS categories' });
    await expect.element(nav).toBeInTheDocument();
    // Spacing & sizing, Borders and Effects have no category in the data
    expect(
      nav
        .getByRole('heading')
        .elements()
        .map((h) => h.textContent)
    ).toEqual(['Colors', 'Typography', 'Layout']);
    // each list is named by its heading
    await expect
      .element(nav.getByRole('list', { name: 'Typography' }).getByRole('link', { name: 'Font Size' }))
      .toBeInTheDocument();
    // the count is shown but left out of the link's name
    expect(
      nav
        .getByRole('link')
        .elements()
        .map((a) => [a.querySelector('span:not(.count)')!.textContent, a.querySelector('.count')!.textContent])
    ).toEqual([
      ['Background Color', '2'],
      ['Font Size', '1'],
      ['Breakpoints', '1'],
      ['Full config', '4']
    ]);
    await expect.element(nav.getByRole('link', { name: 'Font Size', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tailwind CSS categories' }).query()).toBeNull();
  });

  it('opens the first listed category when the hash names none', async () => {
    // Width is listed before Font Size, though Font Size comes first in the category order
    const sizes: TailwindSource = {
      ...source,
      categories: [
        { id: 'font-size', title: 'Font Size', tokens: source.categories[1].tokens },
        { id: 'width', title: 'Width', tokens: [{ class: 'w-4', cssVariable: '--spacing', value: '0.25rem' }] }
      ]
    };
    const screen = await render(App, { props: props('#/tailwind', [item(sizes)]) });
    const nav = screen.getByRole('navigation', { name: 'Tailwind CSS categories' });
    expect(
      nav
        .getByRole('link')
        .elements()
        .map((a) => a.querySelector('span:not(.count)')!.textContent)
    ).toEqual(['Width', 'Font Size', 'Full config']);
    await expect.element(nav.getByRole('link', { name: 'Width' })).toHaveAttribute('aria-current', 'page');
    await expect.element(nav.getByRole('link', { name: 'Font Size' })).not.toHaveAttribute('aria-current');
  });

  it('switches category with a select on a narrow screen', async () => {
    await page.viewport(390, 800);
    const screen = await render(App, { props: props('#/tailwind') });
    await frame(screen.container);
    expect(screen.getByRole('navigation', { name: 'Tailwind CSS categories' }).query()).toBeNull();
    const select = screen.getByRole('combobox', { name: 'Tailwind CSS categories' });
    await expect.element(select).toHaveValue('background-color');
    expect(
      [...select.element().querySelectorAll('optgroup')].map((g) => [
        g.label,
        [...g.querySelectorAll('option')].map((o) => o.textContent)
      ])
    ).toEqual([
      ['Colors', ['Background Color']],
      ['Typography', ['Font Size']],
      ['Layout', ['Breakpoints']]
    ]);
    await select.selectOptions('Font Size');
    await expect.poll(() => location.hash).toBe('#/tailwind?source=app&category=font-size');
    await expect
      .poll(() => tokenTexts(screen.container.querySelector('iframe')!.contentDocument!))
      .toEqual(['text-lg']);
    await select.selectOptions('Full config');
    await expect.element(screen.getByRole('table').first()).toBeInTheDocument();
    await expect.element(select).toHaveValue('full-config');
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

  it('draws the padding of a padding token around a block', async () => {
    const screen = await render(App, { props: props('#/tailwind?category=padding', [item(sizes)]) });
    const { doc } = await frame(screen.container);
    const p4 = doc.querySelector<HTMLElement>('.p-4')!;
    const p0 = doc.querySelector<HTMLElement>('.p-0')!;
    await expect.poll(() => getComputedStyle(p4).paddingTop).toBe('16px');
    expect(getComputedStyle(p0).paddingTop).toBe('0px');
    // the tinted box is larger than its block by the padding
    expect(p4.getBoundingClientRect().width - p0.getBoundingClientRect().width).toBe(32);
  });

  it('shows the computed px next to a value that is not px already', async () => {
    const screen = await render(App, { props: props('#/tailwind?category=padding', [item(sizes)]) });
    const { doc } = await frame(screen.container);
    const row = (token: string) => doc.querySelector(`[data-token="${token}"]`)!;
    await expect.poll(() => row('p-4').querySelector('.zukan-px')?.textContent).toContain('16px');
    expect(row('p-4').textContent).toContain('calc(0.25rem * 4)');
    expect(row('p-4').querySelector('.zukan-px')!.textContent).toContain('Computed size:');
    expect(row('p-0').querySelector('.zukan-px')).toBeNull();
  });

  it('draws sizes as rows and colours as cards', async () => {
    const screen = await render(App, { props: props('#/tailwind?category=padding', [item(sizes)]) });
    const { doc } = await frame(screen.container);
    expect(
      [...doc.querySelectorAll('ul.zukan-rows > li.zukan-row')].map((li) => li.getAttribute('data-token'))
    ).toEqual(['p-0', 'p-4']);
    expect(doc.querySelector('.zukan-card')).toBeNull();
    await setHash('#/tailwind?category=background-color');
    await expect.poll(() => doc.querySelectorAll('ul.zukan-cards > li.zukan-card').length).toBe(2);
    expect(doc.querySelector('.zukan-rows')).toBeNull();
  });

  it('draws breakpoints as bars in proportion to the largest, also under a filter', async () => {
    const screen = await render(App, { props: props('#/tailwind?category=breakpoints', [item(sizes)]) });
    const { doc } = await frame(screen.container);
    const width = (token: string) =>
      doc.querySelector(`[data-token="${token}"] .zukan-bar`)?.getBoundingClientRect().width ?? 0;
    const track = () => {
      const sample = doc.querySelector<HTMLElement>('[data-token="--breakpoint-md"] .zukan-sample')!;
      const style = getComputedStyle(sample);
      return sample.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    };
    await expect.poll(() => width('--breakpoint-md')).toBeGreaterThan(0);
    expect(width('--breakpoint-md')).toBeCloseTo(track(), 0);
    expect(width('--breakpoint-sm') / width('--breakpoint-md')).toBeCloseTo(40 / 48, 2);
    expect(doc.querySelector('[data-token="--breakpoint-sm"]')!.textContent).toContain('640px');
    const full = width('--breakpoint-sm');
    await screen.getByRole('searchbox', { name: 'Filter tokens' }).fill('sm');
    await expect.poll(() => tokenTexts(doc)).toEqual(['--breakpoint-sm']);
    expect(width('--breakpoint-sm')).toBeCloseTo(full, 0);
  });

  it('draws long widths across the row, and marks a bar cut off by it', async () => {
    const widths: TailwindSource = {
      ...source,
      categories: [
        {
          id: 'width',
          title: 'Width',
          tokens: [
            { class: 'w-64', cssVariable: null, value: 'calc(0.25rem * 64)' },
            { class: 'w-96', cssVariable: null, value: 'calc(0.25rem * 96)' },
            { class: 'w-7xl', cssVariable: '--container-7xl', value: '80rem' },
            { class: 'w-full', cssVariable: null, value: '100%' }
          ]
        }
      ]
    };
    const screen = await render(App, { props: props('#/tailwind', [item(widths)]) });
    const { doc } = await frame(screen.container);
    const bar = (token: string) => doc.querySelector<HTMLElement>(`[data-token="${token}"] .zukan-bar`);
    await expect.poll(() => bar('w-96')?.getBoundingClientRect().width).toBe(384);
    expect(bar('w-64')!.getBoundingClientRect().width).toBe(256);
    expect(bar('w-96')!.hasAttribute('data-cut')).toBe(false);
    // 1280px does not fit: the bar ends at the track with a fading end
    await expect.poll(() => bar('w-7xl')!.hasAttribute('data-cut')).toBe(true);
    expect(getComputedStyle(bar('w-7xl')!).maskImage).toContain('linear-gradient');
    expect(bar('w-7xl')!.getBoundingClientRect().width).toBeLessThan(1280);
    // a width that follows the frame is not drawn
    expect(doc.querySelector('[data-token="w-full"] .zukan-sample')).toBeNull();
  });

  it('shows no px for a value the property rejects or that follows the frame', async () => {
    const odd: TailwindSource = {
      ...source,
      categories: [
        {
          id: 'width',
          title: 'Width',
          tokens: [
            { class: 'w-4', cssVariable: null, value: 'calc(0.25rem * 4)' },
            // has a length in it, but is no width
            { class: 'w-odd', cssVariable: null, value: '2rem banana' },
            { class: 'w-screen', cssVariable: null, value: '100vw' },
            { class: 'w-8', cssVariable: null, value: 'calc(0.25rem * 8)' }
          ]
        }
      ]
    };
    const screen = await render(App, { props: props('#/tailwind', [item(odd)]) });
    const { doc } = await frame(screen.container);
    const row = (token: string) => doc.querySelector(`[data-token="${token}"]`)!;
    await expect.poll(() => row('w-8').querySelector('.zukan-px')?.textContent).toContain('32px');
    expect(row('w-4').querySelector('.zukan-px')!.textContent).toContain('16px');
    for (const token of ['w-odd', 'w-screen']) {
      expect(row(token).querySelector('.zukan-px')).toBeNull();
      expect(row(token).querySelector('.zukan-sample')).toBeNull();
      // no empty track for the bar under the names
      expect(getComputedStyle(row(token)).gridTemplateRows.split(' ')).toHaveLength(1);
    }
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

  it('keeps the filter in the route without adding history entries', async () => {
    const screen = await render(App, { props: props('#/tailwind?source=app&q=brand') });
    const { doc } = await frame(screen.container);
    const filter = screen.getByRole('searchbox', { name: 'Filter tokens' });
    await expect.element(filter).toHaveValue('brand');
    await expect.poll(() => tokenTexts(doc)).toEqual(['bg-brand-500']);
    const entries = history.length;
    await filter.fill('white');
    await expect.poll(() => tokenTexts(doc)).toEqual(['bg-white']);
    expect(location.hash).toBe('#/tailwind?source=app&q=white');
    expect(history.length).toBe(entries);
    const link = screen.getByRole('link', { name: 'Font Size' });
    await expect.element(link).toHaveAttribute('href', '#/tailwind?source=app&category=font-size&q=white');
    await link.click();
    await expect.poll(() => location.hash).toBe('#/tailwind?source=app&category=font-size&q=white');
    await expect.element(filter).toHaveValue('white');
    await setHash('#/tailwind?source=app&category=background-color&q=brand');
    await expect.element(filter).toHaveValue('brand');
    await filter.fill('');
    expect(location.hash).toBe('#/tailwind?source=app&category=background-color');
  });

  it('a filter replaces the route an ignored hash left in the history entry', async () => {
    location.hash = '#/tailwind';
    history.replaceState({ zukanHash: '#/tailwind?q=old' }, '');
    const screen = await render(App, { props: props('#/tailwind') });
    const filter = screen.getByRole('searchbox', { name: 'Filter tokens' });
    await expect.element(filter).toHaveValue('old');
    await filter.fill('brand');
    expect(location.hash).toBe('#/tailwind?q=brand');
    expect(history.state?.zukanHash).toBeUndefined();
  });

  it('filters when the browser refuses to replace the URL', async () => {
    const replaceState = vi.spyOn(history, 'replaceState').mockImplementation(() => {
      throw new DOMException('too many calls', 'SecurityError');
    });
    try {
      const screen = await render(App, { props: props('#/tailwind') });
      const { doc } = await frame(screen.container);
      await screen.getByRole('searchbox', { name: 'Filter tokens' }).fill('brand');
      await expect.poll(() => tokenTexts(doc)).toEqual(['bg-brand-500']);
      expect(replaceState).toHaveBeenCalled();
    } finally {
      replaceState.mockRestore();
    }
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

  it('shows a failed copy on the button and announces it', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    try {
      const screen = await render(App, { props: props('#/tailwind') });
      const { doc } = await frame(screen.container);
      const button = doc.querySelector<HTMLButtonElement>('button[aria-label="Copy class: bg-brand-500"]')!;
      button.click();
      await expect.poll(() => button.textContent).toContain('Copy failed');
      expect(button.classList.contains('zukan-failed')).toBe(true);
      expect(doc.querySelector('[aria-live="polite"]')!.textContent).toBe('Copy failed');
    } finally {
      writeText.mockRestore();
    }
  });

  it('shows the last selected entry when an earlier load finishes later', async () => {
    const deferred = () => {
      let resolve!: (value: { default: TailwindSource }) => void;
      const promise = new Promise<{ default: TailwindSource }>((r) => (resolve = r));
      return { promise, resolve };
    };
    const first = deferred();
    const second = deferred();
    const other = { ...source, id: 'other', file: 'src/other.css', version: '4.9.9' };
    const tailwind = [
      { ...item(source), load: () => first.promise },
      { ...item(other), load: () => second.promise }
    ];
    const screen = await render(App, { props: props('#/tailwind?source=app', tailwind) });
    await setHash('#/tailwind?source=other');
    second.resolve({ default: other });
    await expect.element(screen.getByRole('main').getByText('v4.9.9', { exact: false })).toBeInTheDocument();
    first.resolve({ default: source });
    await new Promise((r) => setTimeout(r, 50));
    await expect.element(screen.getByRole('main').getByText('v4.9.9', { exact: false })).toBeInTheDocument();
    await expect.element(screen.getByRole('link', { name: 'Background Color' })).toBeInTheDocument();
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

  it("keeps the entry's own dark theme rules out of the samples in the dark catalog theme", async () => {
    localStorage.setItem('svelte-zukan:theme', 'dark');
    const themed = { ...source, css: `${source.css}\n[data-theme="dark"] { --color-brand-500: rgb(255, 0, 255) }` };
    const screen = await render(App, { props: props('#/tailwind', [item(themed)]) });
    const { doc } = await frame(screen.container);
    expect(getComputedStyle(doc.querySelector('.bg-brand-500')!).backgroundColor).toBe('rgb(255, 62, 0)');
    // the cards around the samples do follow the dark theme
    expect(getComputedStyle(doc.querySelector('.zukan-copy')!).color).toBe('rgb(240, 246, 252)');
  });

  it("draws text samples in the entry's base font, and the names in the catalog's", async () => {
    const based = { ...source, css: `${source.css}\nhtml { font-family: Georgia, serif; line-height: 2 }` };
    const screen = await render(App, { props: props('#/tailwind?category=font-size', [item(based)]) });
    const { doc } = await frame(screen.container);
    const sample = getComputedStyle(doc.querySelector('.zukan-sample .text-lg')!);
    expect(sample.fontFamily).toBe('Georgia, serif');
    expect(sample.lineHeight).toBe(`${parseFloat(sample.fontSize) * 2}px`);
    expect(getComputedStyle(doc.querySelector('.zukan-copy')!).fontFamily).toContain('system-ui');
  });

  it('lists every theme variable in Full config', async () => {
    const screen = await render(App, { props: props('#/tailwind?category=full-config') });
    await expect.element(screen.getByRole('link', { name: 'Full config' })).toHaveAttribute('aria-current', 'page');
    for (const [name, value] of Object.entries(source.variables)) {
      const button = screen.getByRole('button', { name: `Copy variable: ${name}` });
      await expect.element(button).toBeInTheDocument();
      expect(button.element().closest('tr')!.textContent).toContain(value);
    }
  });

  it('groups Full config by namespace, with a swatch for colours only', async () => {
    const grouped: TailwindSource = {
      ...source,
      variables: {
        '--text-lg': '1.125rem',
        '--color-brand-500': '#ff3e00',
        '--brand-gap': '3px',
        '--default-font-family': 'var(--font-sans)',
        // Chromium parses a dashed function like `var()`
        '--default-mono-font-family': '--theme(--font-mono, initial)',
        '--color-white': '#fff',
        '--shadow-sm': '0 1px 2px #0003',
        '--color-current': 'currentcolor'
      }
    };
    const screen = await render(App, { props: props('#/tailwind?category=full-config', [item(grouped)]) });
    await expect.element(screen.getByRole('table', { name: '--color-*' })).toBeInTheDocument();
    const headings = () => [...screen.container.querySelectorAll('h2.namespace')].map((h) => h.textContent!.trim());
    expect(headings()).toEqual(['--color-*', '--text-*', '--shadow-*', '--default-*', 'Other']);
    // Tailwind's order inside a group
    expect(
      screen
        .getByRole('table', { name: '--color-*' })
        .getByRole('button')
        .elements()
        .map((b) => b.textContent!.trim())
    ).toEqual(['--color-brand-500', '--color-white', '--color-current']);
    const swatches = Object.fromEntries(
      [...screen.container.querySelectorAll('tbody tr')].map((tr) => [
        tr.querySelector('button')!.textContent!.trim(),
        tr.querySelector<HTMLElement>('.swatch') && getComputedStyle(tr.querySelector('.swatch')!).backgroundColor
      ])
    );
    expect(swatches).toEqual({
      '--color-brand-500': 'rgb(255, 62, 0)',
      '--color-white': 'rgb(255, 255, 255)',
      '--color-current': null,
      '--text-lg': null,
      '--shadow-sm': null,
      '--default-font-family': null,
      '--default-mono-font-family': null,
      '--brand-gap': null
    });

    const filter = screen.getByRole('searchbox', { name: 'Filter tokens' });
    await filter.fill('brand');
    await expect.poll(headings).toEqual(['--color-*', 'Other']);
    await filter.fill('nothing like this');
    await expect.poll(headings).toEqual([]);
    expect(screen.container.querySelector('table')).toBeNull();
    await expect.element(screen.getByText('No matching tokens')).toBeInTheDocument();
  });

  it('copies a variable from Full config and shows a failure', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    try {
      const screen = await render(App, { props: props('#/tailwind?category=full-config') });
      const live = () => screen.container.querySelector('[aria-live="polite"]')!.textContent;
      await screen.getByRole('button', { name: 'Copy variable: --text-lg' }).click();
      await expect.poll(() => writeText.mock.calls).toEqual([['--text-lg']]);
      await expect.poll(live).toBe('Copied');
      writeText.mockRejectedValue(new Error('denied'));
      const button = screen.getByRole('button', { name: 'Copy variable: --color-white' });
      await button.click();
      await expect.poll(live).toBe('Copy failed');
      expect(button.element().textContent).toContain('Copy failed');
      expect(button.element().classList.contains('failed')).toBe(true);
    } finally {
      writeText.mockRestore();
    }
  });

  it('draws border colours as rows with a thick border', async () => {
    const borders: TailwindSource = {
      ...source,
      categories: [
        {
          id: 'border-color',
          title: 'Border Color',
          tokens: [{ class: 'border-red-50', cssVariable: '--color-red-50', value: '#fef2f2' }]
        }
      ],
      css: '.border-red-50 { border-color: #fef2f2 }'
    };
    const screen = await render(App, { props: props('#/tailwind?category=border-color', [item(borders)]) });
    const { doc } = await frame(screen.container);
    expect(doc.querySelector('.zukan-card')).toBeNull();
    const ring = doc.querySelector('li.zukan-row .border-red-50')!;
    await expect.poll(() => getComputedStyle(ring).borderTopColor).toBe('rgb(254, 242, 242)');
    expect(parseFloat(getComputedStyle(ring).borderTopWidth)).toBeGreaterThanOrEqual(3);
    expect(getComputedStyle(ring).borderTopStyle).toBe('solid');
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

  it('shows a card for each entry on the top page, linking to its page', async () => {
    const other = { ...source, id: 'other', file: 'src/other.css' };
    const screen = await render(App, { props: props('', [item(source), item(other)]) });
    const section = screen.getByRole('region', { name: 'Tailwind CSS' });
    await expect
      .element(section.getByRole('link', { name: 'src/app.css' }))
      .toHaveAttribute('href', '#/tailwind?source=app');
    await expect
      .element(section.getByRole('link', { name: 'src/other.css' }))
      .toHaveAttribute('href', '#/tailwind?source=other');
    await expect
      .element(section.getByRole('link', { name: 'src/app.css' }))
      .toHaveAccessibleDescription('Tailwind CSS v4.3.3');
    await expect.element(section.getByText('Tokens').first()).toBeInTheDocument();
    expect(
      section
        .getByRole('definition')
        .elements()
        .map((d) => d.textContent)
    ).toEqual(['4', '4', '4', '4']);
    // the colours are drawn inline; the entry's CSS stays out of the catalog document
    const swatch = screen.container.querySelector<HTMLElement>('.thumb span')!;
    expect(getComputedStyle(swatch).backgroundColor).toBe('rgb(255, 62, 0)');
    expect([...document.querySelectorAll('style')].some((s) => s.textContent!.includes('.bg-brand-500'))).toBe(false);
  });

  it('shows the card of an entry that fails to load without its numbers', async () => {
    const failing: TailwindListItem = { ...item(source), load: () => Promise.reject(new Error('gone')) };
    const screen = await render(App, { props: props('', [failing]) });
    const section = screen.getByRole('region', { name: 'Tailwind CSS' });
    await expect
      .element(section.getByRole('link', { name: 'src/app.css' }))
      .toHaveAccessibleDescription('Tailwind CSS');
    expect(section.getByRole('definition').query()).toBeNull();
  });

  it('shows no Tailwind CSS card on the top page without Tailwind data', async () => {
    const screen = await render(App, { props: props('', []) });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tailwind CSS' }).query()).toBeNull();
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
