import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { ZukanMeta } from '../types.js';
import App from './App.svelte';
import Catalog from './Catalog.test.svelte';

const meta: ZukanMeta = {
  sections: [
    { title: 'One', code: '<p>one</p>' },
    { title: 'Two', code: '<p>two</p>' }
  ],
  doc: '<p>A <code>doc</code> with a <a href="https://example.com">link</a>.</p>',
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
    catalog: [entry('Alert'), entry('Card'), entry('Button', 'forms')],
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

afterEach(() => {
  localStorage.clear();
  history.replaceState(null, '', location.pathname + location.search);
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
    await userEvent.keyboard('{Control>}k{/Control}');
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
});
