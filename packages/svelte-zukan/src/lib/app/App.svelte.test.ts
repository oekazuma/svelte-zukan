import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import type { ZukanMeta } from '../types.js';
import App from './App.svelte';
import Catalog from './Catalog.test.svelte';
import Wrapper from './Wrapper.test.svelte';
import { modifier } from './SearchDialog.svelte';

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

  it("a preview page with a theme keeps the html background of the app's CSS, which arrives with the wrapper", async () => {
    const style = document.createElement('style');
    style.textContent = 'html{background-color:rgb(250, 250, 250)}';
    try {
      const { props } = setup('#/preview/ui/Card?section=Two&theme=dark');
      props.wrapper = vi.fn(() => {
        document.head.append(style);
        return Promise.resolve({ default: Wrapper });
      });
      const screen = await render(App, { props });
      await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
      await expect.poll(() => document.documentElement.style.backgroundColor).toBe('');
      expect(getComputedStyle(document.documentElement).backgroundColor).toBe('rgb(250, 250, 250)');
      expect(document.documentElement.style.colorScheme).toBe('dark');
    } finally {
      style.remove();
      document.documentElement.style.colorScheme = '';
      document.documentElement.style.backgroundColor = '';
    }
  });

  it('a preview inside the catalog leaves the theme to its frame', async () => {
    localStorage.setItem('svelte-zukan:theme', 'dark');
    // the catalog page that frames it: same path, another window
    vi.stubGlobal('parent', { location: { pathname: location.pathname } });
    try {
      const { props } = setup('#/preview/ui/Card?section=Two');
      const screen = await render(App, { props });
      await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
      expect(document.documentElement.style.colorScheme).toBe('');
    } finally {
      vi.unstubAllGlobals();
      localStorage.removeItem('svelte-zukan:theme');
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

  it('the theme option fixes the theme and removes the switch', async () => {
    localStorage.setItem('svelte-zukan:theme', 'dark');
    try {
      const { props } = setup('#/ui/Card?theme=dark');
      const screen = await render(App, { props: { ...props, fixedTheme: 'light' as const } });
      const zukan = screen.container.querySelector('.zukan')!;
      expect(zukan.getAttribute('data-theme')).toBe('light');
      await expect.element(screen.getByRole('button', { name: 'Dark mode' })).not.toBeInTheDocument();
      await userEvent.keyboard('t');
      expect(zukan.getAttribute('data-theme')).toBe('light');
      const changed = new Promise((resolve) => addEventListener('hashchange', resolve, { once: true }));
      location.hash = '#/ui/Card?section=One&theme=dark';
      await changed;
      await tick();
      expect(zukan.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem('svelte-zukan:theme')).toBe('dark');
      await userEvent.keyboard('?');
      await expect.element(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
      expect(screen.getByRole('dialog').getByText('Switch between light and dark').query()).toBeNull();
    } finally {
      localStorage.removeItem('svelte-zukan:theme');
    }
  });

  it('a preview page uses the fixed theme over the link and the stored one', async () => {
    localStorage.setItem('svelte-zukan:theme', 'light');
    try {
      const { props } = setup('#/preview/ui/Card?section=Two&theme=light');
      const screen = await render(App, { props: { ...props, fixedTheme: 'dark' as const } });
      await expect.element(screen.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
      expect(document.documentElement.style.colorScheme).toBe('dark');
    } finally {
      localStorage.removeItem('svelte-zukan:theme');
      document.documentElement.style.colorScheme = '';
      document.documentElement.style.backgroundColor = '';
    }
  });

  it('the skip link moves focus to the main content without changing the route', async () => {
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await userEvent.keyboard('{Tab}');
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    await expect.element(skip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByRole('main')).toHaveFocus();
    expect(location.hash).toBe('#/ui/Card');
  });

  it('an unknown ID is not found, with ways back to the list and to the search', async () => {
    const { props } = setup('#/ui/Nope');
    const screen = await render(App, { props });
    const main = screen.getByRole('main');
    await expect.element(main.getByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
    await expect.element(main.getByText(/It may have been renamed or removed/)).toBeInTheDocument();
    await expect.element(main.getByRole('link', { name: 'All components' })).toHaveAttribute('href', '#/');
    await main.getByRole('button', { name: 'Search the catalog' }).click();
    await expect.element(screen.getByRole('combobox')).toHaveFocus();
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

  it('each card shows its first example as an inert thumbnail and the first line of its doc', async () => {
    const { props } = setup('');
    props.catalog[0].meta = () =>
      Promise.resolve({
        default: {
          sections: [
            { title: 'First one', code: '' },
            { title: 'Second', code: '' }
          ],
          doc: '<h2>Heading</h2><p>A card for <code>things</code>.</p><p>More.</p>'
        }
      });
    props.catalog.push({ group: 'ui', name: 'Button', dir: '', path: 'ui/Button', load, meta });
    const screen = await render(App, { props });
    const main = screen.getByRole('main');
    await expect.element(main.getByText('A card for things.')).toBeInTheDocument();
    const thumb = screen.container.querySelector('.thumb iframe')!;
    expect(thumb.getAttribute('src')).toBe(`${location.pathname}#/preview/ui/Card?section=First%20one`);
    expect(thumb.closest('[inert]')).not.toBeNull();
    // without sections there is nothing to show: the initial stands in
    await expect.poll(() => screen.container.querySelectorAll('.thumb .mark').length).toBe(1);
    await main.getByRole('link', { name: 'Button' }).click();
    await expect.element(screen.getByRole('heading', { level: 1, name: /Button/ })).toBeInTheDocument();
  });

  it('the top page lists the components without a catalog file, folded, even with no catalog files yet', async () => {
    const { props } = setup('');
    const screen = await render(App, {
      props: { ...props, catalog: [], uncataloged: [{ group: 'ui', file: 'src/lib/Lone.svelte' }] }
    });
    await expect.element(screen.getByText('No catalog files found. Searched:')).toBeInTheDocument();
    const summary = screen.container.querySelector<HTMLElement>('.uncataloged summary')!;
    expect(summary.textContent).toContain('Components without a catalog file');
    await expect.element(screen.getByText('src/lib/Lone.svelte')).not.toBeVisible();
    summary.click();
    await expect.element(screen.getByText('src/lib/Lone.svelte')).toBeVisible();
    // a long path wraps after a slash rather than inside a name
    expect(screen.container.querySelectorAll('.uncataloged code wbr')).toHaveLength(2);
  });

  it('on the dev server, the detail page opens the catalog file and the component in the editor', async () => {
    const { props } = setup('#/ui/Card');
    Object.assign(props.catalog[0], {
      edit: { file: '/repo/src/Card.zukan.svelte', component: '/repo/src/Card.svelte' }
    });
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(''));
    try {
      const screen = await render(App, { props });
      const group = screen.getByRole('group', { name: 'Open in editor' });
      await group.getByRole('button', { name: 'Card.svelte' }).click();
      expect(fetchSpy).toHaveBeenCalledWith(
        `${location.pathname.replace(/__zukan\/.*$/, '')}__open-in-editor?file=${encodeURIComponent('/repo/src/Card.svelte')}`
      );
      await expect.element(group.getByRole('button', { name: 'Card.zukan.svelte' })).toBeInTheDocument();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('without the files (a static build) there is nothing to open', async () => {
    const { props } = setup('#/ui/Card');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Open in editor' }).query()).toBeNull();
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

  it('has no Tailwind item without Tailwind data', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('navigation', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tailwind/ }).query()).toBeNull();
  });

  it('links one Tailwind item per entry, with the file when there are several', async () => {
    const tw = (id: string, file: string) => ({
      id,
      file,
      error: null,
      load: () => new Promise<never>(() => {})
    });
    const { props } = setup('');
    const one = await render(App, { props: { ...props, tailwind: [tw('a', 'src/app.css')] } });
    const nav = one.getByRole('navigation', { name: 'Components' });
    await expect
      .element(nav.getByRole('link', { name: 'Tailwind CSS', exact: true }))
      .toHaveAttribute('href', '#/tailwind?source=a');
    one.unmount();
    const two = await render(App, {
      props: { ...props, tailwind: [tw('a', 'src/app.css'), tw('b', 'src/theme.css')] }
    });
    const link = two.getByRole('link', { name: 'Tailwind CSS (src/theme.css)' });
    await expect.element(link).toHaveAttribute('href', '#/tailwind?source=b');
    await expect.element(link).not.toHaveAttribute('aria-current');
    await setHash('#/tailwind');
    // without a source the first entry is shown
    await expect
      .element(two.getByRole('link', { name: 'Tailwind CSS (src/app.css)' }))
      .toHaveAttribute('aria-current', 'page');
    // J and K do nothing on the Tailwind page
    await userEvent.keyboard('j');
    await userEvent.keyboard('k');
    expect(location.hash).toBe('#/tailwind');
  });

  it('T switches the theme and F expands the preview in view', async () => {
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
    await expect.element(screen.getByTitle('One')).toBeInTheDocument();
    const root = document.querySelector('.zukan')!;
    const before = root.getAttribute('data-theme');
    await userEvent.keyboard('t');
    expect(root.getAttribute('data-theme')).not.toBe(before);
    await userEvent.keyboard('f');
    await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(1);
    // the one in view: which heading the observer saw last depends on the page's scroll position
    expect(['One', 'Two']).toContain(document.querySelector('.preview.expanded iframe')!.getAttribute('title'));
    await userEvent.keyboard('f');
    await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(0);
  });

  const withProps =
    (doc: string | null = null) =>
    () =>
      Promise.resolve({
        default: {
          sections: [
            { title: 'One', code: '' },
            { title: 'Two', code: '' }
          ],
          doc,
          props: [{ name: 'a', type: 'string', default: null, required: true, bindable: false, description: null }],
          propsType: null
        }
      });

  // the observer marks the heading in the top third of the window
  async function scrollToProps(screen: Awaited<ReturnType<typeof render>>) {
    const link = screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Props' });
    await expect.element(link).toBeInTheDocument();
    document.getElementById('zukan-props')!.scrollIntoView();
    await expect.element(link).toHaveAttribute('aria-current', 'location');
  }

  it('F with the props in view expands the last section', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = withProps();
    const screen = await render(App, { props });
    document.body.style.minHeight = '5000px';
    try {
      await scrollToProps(screen);
      await userEvent.keyboard('f');
      await expect.poll(() => document.querySelector('.preview.expanded iframe')?.getAttribute('title')).toBe('Two');
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('the next page starts with nothing marked or expanded', async () => {
    const props = three();
    props.catalog[1].meta = withProps();
    // the doc keeps every heading of the next page below the top third
    props.catalog[2].meta = withProps('<div style="height: 1000px"></div>');
    const screen = await render(App, { props });
    document.body.style.minHeight = '5000px';
    try {
      await scrollToProps(screen);
      await userEvent.keyboard('j');
      await expect.element(screen.getByRole('heading', { level: 1, name: /Tabs/ })).toBeInTheDocument();
      const link = screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Props' });
      await expect.element(link).toBeInTheDocument();
      await expect.element(link).not.toHaveAttribute('aria-current');
      await userEvent.keyboard('k');
      await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
      await userEvent.keyboard('f');
      await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(1);
      await userEvent.keyboard('j');
      await expect.element(screen.getByRole('heading', { level: 1, name: /Tabs/ })).toBeInTheDocument();
      await expect.element(screen.getByTitle('One')).toBeInTheDocument();
      expect(document.querySelectorAll('.preview.expanded').length).toBe(0);
      // one press, not two
      await userEvent.keyboard('f');
      await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(1);
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('arrow keys move through the component list and fold folders', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog.push({ group: 'ui', name: 'Button', dir: 'forms', path: 'ui/forms/Button', load, meta });
    const screen = await render(App, { props });
    const nav = screen.getByRole('navigation', { name: 'Components' });
    const card = nav.getByRole('link', { name: 'Card' }).element() as HTMLElement;
    const folder = nav.getByText('forms').element().closest('summary')!;
    const button = nav.getByRole('link', { name: 'Button' }).element() as HTMLElement;
    // the tree's order: folders and entries as they were found, Card first
    card.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(folder);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(button);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(folder);
    await userEvent.keyboard('{ArrowLeft}');
    expect(folder.parentElement!.hasAttribute('open')).toBe(false);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(folder);
    await userEvent.keyboard('{ArrowRight}');
    expect(folder.parentElement!.hasAttribute('open')).toBe(true);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(card);
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

  it('the table of contents links to the props', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({
        default: {
          sections: [{ title: 'One', code: '' }],
          doc: null,
          props: [{ name: 'a', type: 'string', default: null, required: true, bindable: false, description: null }],
          propsType: null
        }
      });
    const screen = await render(App, { props });
    document.body.style.minHeight = '5000px';
    try {
      const link = screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Props' });
      await expect.element(link).toBeInTheDocument();
      scrollTo(0, 3000);
      (link.element() as HTMLElement).focus();
      await userEvent.keyboard('{Enter}');
      const heading = document.getElementById('zukan-props')!;
      await expect.poll(() => Math.round(heading.getBoundingClientRect().top)).toBe(0);
      expect(document.activeElement).toBe(heading);
      // the URL stays one that opens this page
      expect(location.hash).toBe('#/ui/Card');
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('Back onto an in-page anchor of a doc shows the page it was on', async () => {
    const props = three();
    const first = await render(App, { props });
    await expect.element(first.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await setHash('#usage');
    await userEvent.keyboard('j');
    await expect.element(first.getByRole('heading', { level: 1, name: /Tabs/ })).toBeInTheDocument();
    history.back();
    await expect.element(first.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    expect(location.hash).toBe('#usage');
    await first.unmount();
    const again = await render(App, { props });
    await expect.element(again.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
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
    // each member is kept on one line; the table wraps only between them
    expect([...document.querySelectorAll('.props .type-part')].map((e) => e.textContent)).toEqual([
      'string',
      "'sm'",
      "'md'"
    ]);
  });

  it('a narrow props table stacks each prop and stays a table', async () => {
    await page.viewport(400, 800);
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({
        default: {
          sections: [],
          doc: null,
          props: [
            {
              name: 'cover',
              type: 'string',
              default: null,
              required: false,
              bindable: false,
              description: 'A CSS background for the cover area, such as a gradient'
            }
          ],
          propsType: null
        }
      });
    const screen = await render(App, { props });
    const table = screen.getByRole('table');
    await expect.element(table).toBeInTheDocument();
    // the empty default is hidden by sight only, so the row keeps its four cells
    expect(table.getByRole('cell').all()).toHaveLength(4);
    // the description gets the whole width instead of a squeezed fourth column
    const description = table.getByRole('cell').nth(3).element();
    expect(description.getBoundingClientRect().width).toBeGreaterThan(300);
    expect(getComputedStyle(table.getByRole('cell').nth(1).element(), '::before').content).toBe('"Type "');
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

  it('a link to the section already in the URL scrolls to it again', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Two');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const two = screen.getByRole('heading', { level: 2, name: 'Two' });
      await expect.element(two).toBeInTheDocument();
      expect(spy).toHaveBeenCalledOnce();
      await screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Two' }).click();
      await expect.poll(() => spy.mock.calls.length).toBe(2);
      expect(spy.mock.contexts[1]).toBe(two.element());
    } finally {
      spy.mockRestore();
    }
  });

  it('picking the section already in the URL in the search scrolls to it again', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Two');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const two = screen.getByRole('heading', { level: 2, name: 'Two' });
      await expect.element(two).toBeInTheDocument();
      await userEvent.keyboard(modifier === '⌘' ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}');
      await screen.getByRole('combobox').fill('Two');
      const before = spy.mock.calls.length;
      await screen.getByRole('option', { name: /Two/ }).first().click();
      await expect.poll(() => spy.mock.calls.length).toBeGreaterThan(before);
      expect(spy.mock.contexts.at(-1)).toBe(two.element());
      expect(location.hash).toBe('#/ui/Card?section=Two');
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

  it('Back and Forward keep the position the browser restores', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    document.body.style.minHeight = '5000px';
    try {
      window.scrollTo(0, 1000);
      await setHash('#/ui/Card');
      await expect.poll(() => window.scrollY).toBe(0);
      window.scrollTo(0, 500);
      history.back();
      await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
      await tick();
      await expect.poll(() => window.scrollY).toBe(1000);
      history.forward();
      await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
      await tick();
      await expect.poll(() => window.scrollY).toBe(500);
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

  it('on a narrow screen a folder opens and closes without closing the menu', async () => {
    await page.viewport(400, 800);
    const { props } = setup('');
    props.catalog.push({ group: 'ui', name: 'Button', dir: 'forms', path: 'ui/forms/Button', load, meta });
    const screen = await render(App, { props });
    const menu = screen.getByRole('button', { name: 'Menu' });
    await menu.click();
    const folder = screen.getByRole('navigation', { name: 'Components' }).getByText('forms');
    await folder.click();
    await expect.poll(() => folder.element().closest('details')!.open).toBe(false);
    await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.activeElement).toBe(folder.element().closest('summary'));
  });
});
