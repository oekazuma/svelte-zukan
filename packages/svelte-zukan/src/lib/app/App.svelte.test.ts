import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { ZukanMeta } from '../types.js';
import App from './App.svelte';
import Catalog from './Catalog.test.svelte';
import Wrapper from './Wrapper.test.svelte';

// a negative assertion needs the hashchange to have been handled first
async function setHash(hash: string) {
  const changed = new Promise((r) => addEventListener('hashchange', r, { once: true }));
  location.hash = hash;
  await changed;
  await tick();
}

const load = () => Promise.resolve({ default: Catalog });
const meta = () => Promise.resolve<{ default: ZukanMeta }>({ default: { sections: [], doc: null } });

function setup(hash: string) {
  location.hash = hash;
  const wrapper = vi.fn(() => Promise.resolve({ default: Wrapper }));
  const catalog = [{ group: 'ui', name: 'Card', dir: '', path: 'ui/Card', load, meta }];
  const searched = [{ group: 'ui', dirs: ['src', '../lib'] }];
  return {
    wrapper,
    props: { catalog, logo: null as string | null, wrapper, title: 'zukan', locale: 'en' as 'en' | 'ja', searched }
  };
}

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(() => {
  history.replaceState(null, '', location.pathname + location.search);
});

describe('App', () => {
  it('the list does not load the wrapper', async () => {
    const { wrapper, props } = setup('');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    await expect.element(screen.getByRole('navigation', { name: 'Components' })).toBeInTheDocument();
    expect(document.title).toBe('zukan');
    expect(wrapper).not.toHaveBeenCalled();
  });

  it('a detail page sets the title and does not load the wrapper', async () => {
    const { wrapper, props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    expect(document.title).toBe('Card | zukan');
    expect(wrapper).not.toHaveBeenCalled();
  });

  it('a preview renders only the section inside the wrapper', async () => {
    const { wrapper, props } = setup('#/preview/ui/Card?section=Two');
    const screen = await render(App, { props });
    await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
    await expect.element(screen.getByText('one')).not.toBeInTheDocument();
    expect(wrapper).toHaveBeenCalledOnce();
    expect(screen.container.querySelector('nav')).toBeNull();
  });

  it('a preview page applies the stored theme', async () => {
    localStorage.setItem('svelte-zukan:theme', 'dark');
    try {
      const { props } = setup('#/preview/ui/Card?section=Two');
      const screen = await render(App, { props });
      await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
      expect(document.documentElement.style.colorScheme).toBe('dark');
    } finally {
      localStorage.removeItem('svelte-zukan:theme');
      document.documentElement.style.colorScheme = '';
      document.documentElement.style.backgroundColor = '';
    }
  });

  it('shows the logo image with the title as its alt text', async () => {
    const { props } = setup('');
    props.logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
    props.title = 'My UI';
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('img', { name: 'My UI' })).toBeInTheDocument();
  });

  it('the theme switch changes the catalog and is remembered', async () => {
    localStorage.setItem('svelte-zukan:theme', 'light');
    try {
      const { props } = setup('#/ui/Card');
      const screen = await render(App, { props });
      const zukan = screen.container.querySelector('.zukan')!;
      const toggle = screen.getByRole('button', { name: 'Dark mode' });
      expect(zukan.getAttribute('data-theme')).toBe('light');
      await expect.element(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      expect(zukan.getAttribute('data-theme')).toBe('dark');
      await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(getComputedStyle(zukan).backgroundColor).toBe('rgb(13, 17, 23)');
      expect(localStorage.getItem('svelte-zukan:theme')).toBe('dark');
    } finally {
      localStorage.removeItem('svelte-zukan:theme');
    }
  });

  it('starts from the stored theme', async () => {
    localStorage.setItem('svelte-zukan:theme', 'dark');
    try {
      const { props } = setup('');
      const screen = await render(App, { props });
      expect(screen.container.querySelector('.zukan')!.getAttribute('data-theme')).toBe('dark');
    } finally {
      localStorage.removeItem('svelte-zukan:theme');
    }
  });

  it('the theme switch still works when storage throws', async () => {
    localStorage.setItem('svelte-zukan:theme', 'light');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const { props } = setup('');
      const screen = await render(App, { props });
      await screen.getByRole('button', { name: 'Dark mode' }).click();
      expect(screen.container.querySelector('.zukan')!.getAttribute('data-theme')).toBe('dark');
    } finally {
      spy.mockRestore();
      localStorage.removeItem('svelte-zukan:theme');
    }
  });

  it('an unknown ID is not found', async () => {
    const { props } = setup('#/ui/Nope');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
  });

  it('the list shows each group with a count and links to every entry', async () => {
    const { props } = setup('');
    props.catalog.push({ group: 'ui', name: 'Button', dir: 'forms', path: 'ui/forms/Button', load, meta });
    const screen = await render(App, { props });
    const main = screen.getByRole('main');
    await expect.element(main.getByRole('heading', { level: 2, name: 'ui 2' })).toBeInTheDocument();
    await expect.element(main.getByRole('link', { name: /Button/ })).toHaveAttribute('href', '#/ui/forms/Button');
    await expect.element(main.getByRole('link', { name: /Card/ })).toHaveAttribute('href', '#/ui/Card');
  });

  const three = () => {
    const { props } = setup('#/ui/Card');
    props.catalog.unshift({ group: 'ui', name: 'Alert', dir: '', path: 'ui/Alert', load, meta });
    props.catalog.push({ group: 'ui', name: 'Tabs', dir: '', path: 'ui/Tabs', load, meta });
    return props;
  };

  it('a detail page links to the previous and next components', async () => {
    const screen = await render(App, { props: three() });
    const pager = screen.getByRole('navigation', { name: 'Previous / Next' });
    await expect.element(pager.getByRole('link', { name: /Previous.*Alert/ })).toHaveAttribute('href', '#/ui/Alert');
    await expect.element(pager.getByRole('link', { name: /Next.*Tabs/ })).toHaveAttribute('href', '#/ui/Tabs');
  });

  it('J and K move to the next and previous components', async () => {
    const screen = await render(App, { props: three() });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await userEvent.keyboard('j');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Tabs/ })).toBeInTheDocument();
    await userEvent.keyboard('k');
    await userEvent.keyboard('k');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Alert/ })).toBeInTheDocument();
  });

  it('J does nothing while typing in the search box', async () => {
    const screen = await render(App, { props: three() });
    await screen.getByRole('searchbox', { name: 'Search' }).fill('');
    screen.getByRole('searchbox', { name: 'Search' }).element().focus();
    await userEvent.keyboard('j');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });

  it('? and the sidebar button open the shortcuts', async () => {
    const screen = await render(App, { props: three() });
    const dialog = screen.container.querySelector('dialog')!;
    await screen.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect.poll(() => dialog.open).toBe(true);
    await expect.element(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await screen.getByRole('button', { name: 'Close' }).click();
    await expect.poll(() => dialog.open).toBe(false);
    await userEvent.keyboard('?');
    await expect.poll(() => dialog.open).toBe(true);
  });

  it('a page with several sections has a table of contents', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({
        default: {
          sections: [
            { title: 'One', code: '' },
            { title: 'Two', code: '' }
          ],
          doc: null
        }
      });
    const screen = await render(App, { props });
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    await expect.element(toc.getByRole('link', { name: 'Two' })).toHaveAttribute('href', '#/ui/Card?section=Two');
  });

  it('a page with one section has no table of contents', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () => Promise.resolve({ default: { sections: [{ title: 'One', code: '' }], doc: null } });
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 2, name: 'One' })).toBeInTheDocument();
    await expect.element(screen.getByRole('navigation', { name: 'On this page' })).not.toBeInTheDocument();
  });

  it('an empty catalog lists the searched places', async () => {
    const { props } = setup('');
    props.catalog = [];
    const screen = await render(App, { props });
    await expect.element(screen.getByText('No catalog files found. Searched:')).toBeInTheDocument();
    await expect.element(screen.getByRole('main').getByRole('listitem')).toHaveTextContent('ui: src, ../lib');
  });

  it('uses the Japanese dictionary', async () => {
    const { props } = setup('');
    props.locale = 'ja';
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'コンポーネント一覧' })).toBeInTheDocument();
    await expect.element(screen.getByRole('navigation', { name: 'コンポーネント' })).toBeInTheDocument();
    location.hash = '#/ui/Nope';
    await expect.element(screen.getByRole('heading', { level: 1, name: '見つかりません' })).toBeInTheDocument();
  });

  it('a load error is shown', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () => Promise.reject(new Error('boom'));
    const screen = await render(App, { props });
    await expect.element(screen.getByText('Failed to load: boom')).toBeInTheDocument();
  });

  it('a detail page reads the metadata, not the component', async () => {
    const { props } = setup('#/ui/Card');
    const spy = vi.fn(load);
    props.catalog[0].load = spy;
    props.catalog[0].meta = () => Promise.resolve({ default: { sections: [], doc: '<p>Doc text</p>' } });
    const screen = await render(App, { props });
    await expect.element(screen.getByText('Doc text')).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
  });

  it('a detail page lists the props of the component', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({
        default: {
          sections: [],
          doc: null,
          props: [
            { name: 'title', type: 'string', default: null, required: true, bindable: false, description: null },
            {
              name: 'size',
              type: "'sm' | 'md'",
              default: "'md'",
              required: false,
              bindable: true,
              description: 'The <code>size</code>'
            }
          ],
          propsType: null
        }
      });
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 2, name: 'Props' })).toBeInTheDocument();
    const cells = [...document.querySelectorAll('.props :is(th, td)')];
    expect(cells.map((c) => c.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Name',
      'Type',
      'Default',
      'Description',
      'title required',
      'string',
      '',
      '',
      'size bindable',
      "'sm' | 'md'",
      "'md'",
      'The size'
    ]);
  });

  it('a file without sections says so', async () => {
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect
      .element(screen.getByText('This file has no <Section>, so there is nothing to preview.'))
      .toBeInTheDocument();
  });

  it('a file with sections shows no such message', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({ default: { sections: [{ title: 'One', code: '<p>one</p>' }], doc: null } });
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 2, name: 'One' })).toBeInTheDocument();
    await expect.element(screen.getByText(/has no <Section>/)).not.toBeInTheDocument();
  });

  const twoSections = () =>
    Promise.resolve({
      default: {
        sections: [
          { title: 'One', code: '<p>1</p>' },
          { title: 'Two', code: '<p>2</p>' }
        ],
        doc: null
      }
    });

  it('each section heading links to itself', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = twoSections;
    const screen = await render(App, { props });
    await expect
      .element(screen.getByRole('heading', { level: 2, name: 'Two' }).getByRole('link'))
      .toHaveAttribute('href', '#/ui/Card?section=Two');
  });

  it('a detail URL with ?section scrolls that section into view', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Two');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      await expect.element(screen.getByRole('heading', { level: 2, name: 'Two' })).toBeInTheDocument();
      expect(spy.mock.contexts.map((el) => (el as Element).textContent)).toEqual(['Two']);
    } finally {
      spy.mockRestore();
    }
  });

  it('changing only the section scrolls without remounting the page', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const one = screen.getByRole('heading', { level: 2, name: 'One' });
      await expect.element(one).toBeInTheDocument();
      const node = one.element();
      expect(spy).not.toHaveBeenCalled();
      await setHash('#/ui/Card?section=One');
      await expect.poll(() => spy.mock.calls.length).toBe(1);
      expect(spy.mock.contexts[0]).toBe(node);
      expect(one.element()).toBe(node);
      expect(document.title).toBe('Card | zukan');
    } finally {
      spy.mockRestore();
    }
  });

  it('an unknown section shows the page without scrolling', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Nope');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      await expect.element(screen.getByRole('heading', { level: 2, name: 'Two' })).toBeInTheDocument();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('follows hashchange', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    location.hash = '#/ui/Card';
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });

  it('a preview ignores hashes that are not preview routes', async () => {
    const { props } = setup('#/preview/ui/Card?section=Two');
    const screen = await render(App, { props });
    await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
    for (const hash of ['#', '#details', '#/ui/Card']) {
      await setHash(hash);
      await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
      expect(screen.container.querySelector('nav')).toBeNull();
    }
  });

  it('a detail page ignores in-page anchors', async () => {
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await setHash('#usage');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });

  it.each(['#details', '#'])('a reload after %s in a preview shows the preview again', async (hash) => {
    const { props } = setup('#/preview/ui/Card?section=Two');
    const first = await render(App, { props });
    await expect.element(first.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
    // the app must be mounted while the hash changes, as on a real page
    await setHash(hash);
    await first.unmount();
    // a reload mounts the app again with the same URL and history entry
    const again = await render(App, { props });
    await expect.element(again.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
  });

  it('a reload after an in-page anchor in a doc shows the detail page again', async () => {
    const { props } = setup('#/ui/Card');
    const first = await render(App, { props });
    await expect.element(first.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await setHash('#usage');
    await first.unmount();
    const again = await render(App, { props });
    await expect.element(again.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });

  it('an empty hash still shows the list', async () => {
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    location.hash = '';
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
  });

  it('the search filters the sidebar', async () => {
    const { props } = setup('');
    props.catalog.push({ group: 'ui', name: 'Button', dir: 'forms', path: 'ui/forms/Button', load, meta });
    const screen = await render(App, { props });
    const nav = screen.getByRole('navigation', { name: 'Components' });
    await screen.getByRole('searchbox', { name: 'Search' }).fill('FORMS');
    await expect.element(nav.getByRole('link', { name: /Button/ })).toBeInTheDocument();
    await expect.element(nav.getByRole('link', { name: 'Card' })).not.toBeInTheDocument();
    await screen.getByRole('searchbox', { name: 'Search' }).fill('nothing');
    await expect.element(nav.getByText('No matches')).toBeInTheDocument();
  });

  it('the search also finds section titles and links to them', async () => {
    const { props } = setup('');
    props.catalog[0].meta = () =>
      Promise.resolve({ default: { sections: [{ title: 'Dismissible', code: '' }], doc: null } });
    const screen = await render(App, { props });
    const nav = screen.getByRole('navigation', { name: 'Components' });
    await screen.getByRole('searchbox', { name: 'Search' }).fill('dismiss');
    await expect
      .element(nav.getByRole('link', { name: 'Dismissible' }))
      .toHaveAttribute('href', '#/ui/Card?section=Dismissible');
    await expect.element(nav.getByRole('link', { name: 'Card' })).toBeInTheDocument();
  });

  it('/ focuses the search', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    await userEvent.keyboard('/');
    await expect.element(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
  });

  it('/ opens the menu and focuses the search on a narrow screen', async () => {
    await page.viewport(400, 800);
    const { props } = setup('');
    const screen = await render(App, { props });
    await userEvent.keyboard('/');
    await expect.element(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();
    await expect.element(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('navigating scrolls back to the top', async () => {
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    document.body.style.minHeight = '5000px';
    try {
      window.scrollTo(0, 1000);
      expect(window.scrollY).toBe(1000);
      location.hash = '#/ui/Nope';
      await expect.poll(() => window.scrollY).toBe(0);
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('groups are labelled only when there are several', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    const nav = screen.getByRole('navigation', { name: 'Components' });
    await expect.element(nav.getByRole('list', { name: 'ui' })).not.toBeInTheDocument();
    props.catalog.push({ group: 'examples', name: 'Demo', dir: '', path: 'examples/Demo', load, meta });
    await screen.rerender({ catalog: [...props.catalog] });
    await expect.element(nav.getByRole('list', { name: 'ui' })).toBeInTheDocument();
    await expect.element(nav.getByRole('list', { name: 'examples' })).toHaveTextContent('Demo');
  });

  it('on a narrow screen the menu closes when the logo link or Back navigates', async () => {
    await page.viewport(400, 800);
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    const menu = screen.getByRole('button', { name: 'Menu' });
    await menu.click();
    await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
    await screen.getByRole('link', { name: 'zukan' }).click();
    await expect.element(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
    history.back();
    await expect.element(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('the preview URL is the page path plus the preview hash', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({ default: { sections: [{ title: 'One', code: '<p>one</p>' }], doc: null } });
    const screen = await render(App, { props });
    const src = `${location.pathname}#/preview/ui/Card?section=One`;
    await expect.element(screen.getByTitle('One')).toHaveAttribute('src', src);
    await expect
      .element(screen.getByRole('link', { name: 'Open in new tab' }))
      .toHaveAttribute(
        'href',
        expect.stringMatching(new RegExp(`^${src.replace(/[.?]/g, '\\$&')}&theme=(light|dark)$`))
      );
  });

  it('a shared link sets the theme and the width without storing the theme', async () => {
    localStorage.removeItem('svelte-zukan:theme');
    const { props } = setup('#/ui/Card?section=One&width=375&theme=dark');
    props.catalog[0].meta = () =>
      Promise.resolve({ default: { sections: [{ title: 'One', code: '<p>one</p>' }], doc: null } });
    const screen = await render(App, { props });
    await expect.element(screen.getByTitle('One')).toBeInTheDocument();
    expect(document.querySelector('.zukan')!.getAttribute('data-theme')).toBe('dark');
    await expect.poll(() => Math.round(screen.getByTitle('One').element().getBoundingClientRect().width)).toBe(375);
    expect(localStorage.getItem('svelte-zukan:theme')).toBeNull();
  });

  it('on a narrow screen the menu button shows the navigation', async () => {
    await page.viewport(400, 800);
    const { props } = setup('');
    const screen = await render(App, { props });
    const menu = screen.getByRole('button', { name: 'Menu' });
    await expect.element(screen.getByRole('navigation', { name: 'Components' })).not.toBeInTheDocument();
    await menu.click();
    await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
    await screen.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Card' }).click();
    await expect.element(menu).toHaveAttribute('aria-expanded', 'false');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });
});
