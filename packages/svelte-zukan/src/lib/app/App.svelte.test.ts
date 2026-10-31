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

  it('a preview shows a component that throws while rendering as an error, and marks the page as settled', async () => {
    const { props } = setup('#/preview/ui/Card?section=Two');
    const throws = () => {
      throw new Error('boom');
    };
    props.catalog[0].load = () => Promise.resolve({ default: throws as unknown as typeof Catalog });
    const screen = await render(App, { props });
    await expect.element(screen.getByText('Failed to render: boom')).toHaveAttribute('data-zukan-error');
    await expect
      .poll(() => screen.container.querySelector('[data-zukan-preview]')?.hasAttribute('data-zukan-ready'))
      .toBe(true);
  });

  it('a preview marks the page once the section is in', async () => {
    const { props } = setup('#/preview/ui/Card?section=Two');
    const screen = await render(App, { props });
    await expect
      .poll(() => screen.container.querySelector('[data-zukan-preview][data-zukan-ready]')?.textContent?.trim())
      .toBe('two');
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

  it('a preview that is gone before its wrapper loads leaves the page background to the one after it', async () => {
    let resolve!: (value: { default: typeof Wrapper }) => void;
    try {
      const { props } = setup('#/preview/ui/Card?section=Two&theme=dark');
      props.wrapper = vi.fn(() => new Promise((r) => (resolve = r)));
      const screen = await render(App, { props });
      screen.unmount();
      document.documentElement.style.backgroundColor = 'rgb(1, 2, 3)';
      resolve({ default: Wrapper });
      await new Promise((r) => setTimeout(r, 50));
      expect(document.documentElement.style.backgroundColor).toBe('rgb(1, 2, 3)');
    } finally {
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

  it('the top page shows why the catalog could not be listed, in place of the empty list', async () => {
    const { props } = setup('');
    const listError = 'svelte-zukan: duplicate catalog ID "ui/A":\n  src/A.zukan.svelte\n  src/A/A.zukan.svelte';
    const screen = await render(App, { props: { ...props, catalog: [], listError } });
    await expect.element(screen.getByText(/^Failed to load: svelte-zukan: duplicate catalog ID "ui\/A"/)).toBeVisible();
    await expect.element(screen.getByText('No catalog files found. Searched:')).not.toBeInTheDocument();
  });

  it('a detail page left without its entry by a listing error shows that error, not Not found', async () => {
    const { props } = setup('#/ui/Button');
    const listError = 'svelte-zukan: duplicate catalog ID "ui/Button"';
    const screen = await render(App, { props: { ...props, catalog: [], listError } });
    await expect.element(screen.getByText(`Failed to load: ${listError}`)).toBeVisible();
    await expect.element(screen.getByRole('heading', { name: 'Not found' })).not.toBeInTheDocument();
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

  it('J, K and T work with Shift or Caps Lock too', async () => {
    const screen = await render(App, { props: three() });
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    await userEvent.keyboard('J');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Tabs/ })).toBeInTheDocument();
    await userEvent.keyboard('K');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    const root = document.querySelector('.zukan')!;
    const before = root.getAttribute('data-theme');
    await userEvent.keyboard('T');
    expect(root.getAttribute('data-theme')).not.toBe(before);
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

  it('F moves the focus into the expanded preview, and leaving it brings the focus back', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = twoSections;
    const screen = await render(App, { props });
    const link = screen.getByRole('heading', { level: 2, name: 'One' }).getByRole('link');
    await expect.element(link).toBeInTheDocument();
    for (const leave of ['f', '{Escape}']) {
      (link.element() as HTMLElement).focus();
      await userEvent.keyboard('f');
      await expect.element(screen.getByRole('button', { name: 'Exit expanded view (Esc)' })).toHaveFocus();
      await userEvent.keyboard(leave);
      await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(0);
      await expect.element(link).toHaveFocus();
    }
  });

  it('going to another place on the page leaves the expanded preview and shows that place', async () => {
    const { props } = setup('#/ui/Card?section=One');
    props.catalog[0].meta = withProps();
    const screen = await render(App, { props });
    document.body.style.minHeight = '5000px';
    try {
      const link = screen.getByRole('heading', { level: 2, name: 'One' }).getByRole('link');
      await expect.element(link).toBeInTheDocument();
      // the URL marks the first section, which F then expands
      const expand = async () => {
        if (location.hash !== '#/ui/Card?section=One') await setHash('#/ui/Card?section=One');
        (link.element() as HTMLElement).focus({ preventScroll: true });
        await userEvent.keyboard('f');
        await expect.poll(() => document.querySelector('.preview.expanded iframe')?.getAttribute('title')).toBe('One');
      };
      await expand();
      await setHash('#/ui/Card?section=Two');
      await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(0);
      const two = screen.getByRole('heading', { level: 2, name: 'Two' }).element();
      await expect.poll(() => Math.round(two.getBoundingClientRect().top)).toBe(0);

      await expand();
      await setHash('#/ui/Card?section=');
      await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(0);
      const heading = document.getElementById('zukan-props')!;
      await expect.poll(() => Math.round(heading.getBoundingClientRect().top)).toBe(0);
      expect(document.activeElement).toBe(heading);

      await expand();
      await setHash('#/ui/Card');
      await expect.poll(() => document.querySelectorAll('.preview.expanded').length).toBe(0);
    } finally {
      document.body.style.minHeight = '';
    }
  });

  // the doc keeps every heading below the top third until the test scrolls
  const withProps =
    (doc = '<div style="height: 1000px"></div>') =>
    () =>
      Promise.resolve({
        default: {
          sections: [
            { title: 'One', code: '' },
            { title: 'Two', code: '' }
          ],
          doc,
          props: [
            {
              name: 'a',
              type: 'string',
              default: null,
              required: true,
              bindable: false,
              // keeps the first section's heading below the top third when the props heading is at the top
              description: '<div style="height: 1000px"></div>'
            }
          ],
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

  it('F with the props in view expands the first section', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = withProps();
    const screen = await render(App, { props });
    document.body.style.minHeight = '5000px';
    try {
      await scrollToProps(screen);
      await userEvent.keyboard('f');
      await expect.poll(() => document.querySelector('.preview.expanded iframe')?.getAttribute('title')).toBe('One');
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('the next page starts with nothing marked or expanded', async () => {
    const props = three();
    props.catalog[1].meta = withProps();
    props.catalog[2].meta = withProps();
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
      // a catalog route, so a new tab opens this page at the props
      await expect.element(link).toHaveAttribute('href', '#/ui/Card?section=');
      await setHash('#/ui/Card?section=One');
      scrollTo(0, 3000);
      (link.element() as HTMLElement).focus();
      await userEvent.keyboard('{Enter}');
      const heading = document.getElementById('zukan-props')!;
      await expect.poll(() => Math.round(heading.getBoundingClientRect().top)).toBe(0);
      expect(document.activeElement).toBe(heading);
      // the section left in the URL would scroll away from the props on a reload
      expect(location.hash).toBe('#/ui/Card?section=');
      await expect.element(link).toHaveAttribute('aria-current', 'location');
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('a URL with an empty section opens the page at the props', async () => {
    const { props } = setup('#/ui/Card?section=');
    props.catalog[0].meta = withProps();
    const screen = await render(App, { props });
    const heading = screen.getByRole('heading', { level: 2, name: 'Props' });
    await expect.element(heading).toBeInTheDocument();
    await expect.poll(() => Math.round(heading.element().getBoundingClientRect().top)).toBe(0);
    await expect
      .element(screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Props' }))
      .toHaveAttribute('aria-current', 'location');
  });

  /** a few rendered frames, in which an IntersectionObserver delivers what a scroll changed */
  const frames = async () => {
    for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r));
  };

  it('the last section stays marked after its link scrolls to the end of the page', async () => {
    // tall enough that what follows the last heading can not lift it into the top third
    await page.viewport(1280, 1600);
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = withProps();
    const screen = await render(App, { props });
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    await toc.getByRole('link', { name: 'Two' }).click();
    expect(location.hash).toBe('#/ui/Card?section=Two');
    // the observer reports the headings in the top third after the scroll
    await frames();
    await expect.element(toc.getByRole('link', { name: 'Two' })).toHaveAttribute('aria-current', 'location');
    // the reader's own scrolling hands the mark back to the observer
    document.body.style.minHeight = '5000px';
    try {
      dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
      scrollTo(0, 0);
      await frames();
      await scrollToProps(screen);
    } finally {
      document.body.style.minHeight = '';
    }
  });

  it('scrolling a little from the last section marks the heading already in the top third', async () => {
    await page.viewport(1280, 1600);
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = withProps();
    const screen = await render(App, { props });
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    await toc.getByRole('link', { name: 'Two' }).click();
    await frames();
    await expect.element(toc.getByRole('link', { name: 'Two' })).toHaveAttribute('aria-current', 'location');
    // a key that does not scroll keeps the mark
    await userEvent.keyboard('{Shift}');
    await frames();
    await expect.element(toc.getByRole('link', { name: 'Two' })).toHaveAttribute('aria-current', 'location');
    dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }));
    scrollBy(0, -1);
    await expect.element(toc.getByRole('link', { name: 'Props' })).toHaveAttribute('aria-current', 'location');
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

  it('an empty catalog says No matches only once something is typed', async () => {
    const { props } = setup('');
    props.catalog = [];
    const screen = await render(App, { props });
    const nav = screen.getByRole('navigation', { name: 'Components' });
    await expect.element(nav).toBeInTheDocument();
    await expect.element(nav.getByText('No matches')).not.toBeInTheDocument();
    await screen.getByRole('searchbox', { name: 'Search' }).fill('x');
    await expect.element(nav.getByText('No matches')).toBeInTheDocument();
  });

  it('a name starting with an emoji shows the whole emoji as its initial', async () => {
    const { props } = setup('');
    props.catalog[0].name = '\u{1F389}Party';
    const screen = await render(App, { props });
    await expect.poll(() => screen.container.querySelector('.thumb .mark')?.textContent).toBe('\u{1F389}');
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

  it('two props of one name do not break the page', async () => {
    const { props } = setup('#/ui/Card');
    const prop = { name: 'a', type: 'string', default: null, required: false, bindable: false, description: null };
    props.catalog[0].meta = () =>
      Promise.resolve({
        default: { sections: [{ title: 'One', code: '' }], doc: null, props: [prop, { ...prop, type: 'number' }] }
      });
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 2, name: 'One' })).toBeInTheDocument();
    expect(document.querySelectorAll('.props tbody tr').length).toBe(2);
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

  it('a file that does not compile shows its error', async () => {
    const { props } = setup('#/ui/Card');
    const error = 'src/Card.zukan.svelte:1 <Section> needs a title';
    props.catalog[0].meta = () => Promise.resolve({ default: { sections: [], doc: null, error } });
    const screen = await render(App, { props });
    await expect.element(screen.getByText(`Failed to load: ${error}`)).toBeInTheDocument();
    await expect.element(screen.getByText(/has no <Section>/)).not.toBeInTheDocument();
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

  it('a section from the URL goes on to the top as the previews grow, until the reader scrolls', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Two');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const two = screen.getByRole('heading', { level: 2, name: 'Two' });
      await expect.element(two).toBeInTheDocument();
      const top = () => Math.round(two.element().getBoundingClientRect().top);
      // the page is still too short to bring the heading to the top, as it is before the previews have their height
      expect(top()).toBeGreaterThan(10);
      document.querySelector<HTMLElement>('.example')!.style.minHeight = '1200px';
      document.body.style.paddingBottom = '2000px';
      await expect.poll(top).toBeLessThan(10);
      dispatchEvent(new WheelEvent('wheel'));
      const calls = spy.mock.calls.length;
      document.querySelector<HTMLElement>('.example')!.style.minHeight = '1600px';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(spy.mock.calls.length).toBe(calls);
    } finally {
      spy.mockRestore();
      document.body.style.paddingBottom = '';
    }
  });

  /** the test page renders no preview, and the skeleton covers the frame until one is measured */
  async function showPreview(screen: Awaited<ReturnType<typeof render>>, title: string) {
    const frame = screen.getByTitle(title);
    const doc = () => (frame.element() as HTMLIFrameElement).contentDocument;
    // the initial about:blank document is complete too
    await expect.poll(() => doc()?.readyState === 'complete' && doc()!.URL.includes('#/preview/')).toBe(true);
    doc()!.body.innerHTML = '<div data-zukan-preview style="height: 100px"></div>';
    await expect.poll(() => frame.element().closest('.preview')!.querySelector('.skeleton')).toBeNull();
    return frame;
  }

  it('a click in a preview releases a section from the URL, so its growth does not scroll the page', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Two');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const frame = await showPreview(screen, 'Two');
      const calls = spy.mock.calls.length;
      await frame.click();
      await expect.poll(() => document.activeElement).toBe(frame.element());
      // focus may leave the preview before it grows
      (screen.getByRole('heading', { level: 2, name: 'One' }).getByRole('link').element() as HTMLElement).focus();
      document.querySelector<HTMLElement>('.example')!.style.minHeight = '1200px';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.querySelector<HTMLElement>('.example')!.style.minHeight = '1600px';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(spy.mock.calls.length).toBe(calls);
    } finally {
      spy.mockRestore();
    }
  });

  it('a click in a preview that already has the focus releases a section from the URL', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const frame = await showPreview(screen, 'Two');
      await frame.click();
      await expect.poll(() => document.activeElement).toBe(frame.element());
      const view = (frame.element() as HTMLIFrameElement).contentWindow!;
      const actions = [() => frame.click(), () => view.dispatchEvent(new WheelEvent('wheel'))];
      for (const [i, act] of actions.entries()) {
        // Back or Forward onto a section keeps the focus where it is
        await setHash(`#/ui/Card?section=${i ? 'One' : 'Two'}`);
        await expect.poll(() => spy.mock.calls.length).toBe(i + 1);
        await act();
        document.querySelector<HTMLElement>('.example')!.style.minHeight = `${1200 + i * 400}px`;
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        expect(spy.mock.calls.length).toBe(i + 1);
      }
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

  it('after an in-page anchor of a doc, a link to the section on the page still scrolls to it', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    try {
      const { props } = setup('#/ui/Card?section=Two');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      const two = screen.getByRole('heading', { level: 2, name: 'Two' });
      await expect.element(two).toBeInTheDocument();
      await setHash('#usage');
      await screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Two' }).click();
      await expect.poll(() => spy.mock.calls.length).toBe(2);
      expect(spy.mock.contexts[1]).toBe(two.element());
      expect(location.hash).toBe('#/ui/Card?section=Two');
    } finally {
      spy.mockRestore();
    }
  });

  it('leaving the section in the URL releases it, so a preview growing above does not scroll back to it', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView');
    document.body.style.paddingBottom = '2000px';
    try {
      const { props } = setup('#/ui/Card');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      await screen.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Two' }).click();
      await expect.poll(() => spy.mock.calls.length).toBe(1);
      const back = new Promise((r) => addEventListener('hashchange', r, { once: true }));
      history.back();
      await back;
      await tick();
      expect(location.hash).toBe('#/ui/Card');
      document.querySelector<HTMLElement>('.example')!.style.minHeight = '700px';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      spy.mockRestore();
      document.body.style.paddingBottom = '';
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

  it('picking the page already shown in the search scrolls it to the top', async () => {
    document.body.style.paddingBottom = '2000px';
    try {
      const { props } = setup('#/ui/Card');
      props.catalog[0].meta = twoSections;
      const screen = await render(App, { props });
      await expect.element(screen.getByRole('heading', { level: 2, name: 'Two' })).toBeInTheDocument();
      scrollTo(0, 500);
      expect(scrollY).toBe(500);
      await userEvent.keyboard(modifier === '⌘' ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}');
      await screen.getByRole('combobox').fill('Card');
      await screen.getByRole('option', { name: /Card/ }).first().click();
      await expect.poll(() => scrollY).toBe(0);
      expect(location.hash).toBe('#/ui/Card');
    } finally {
      document.body.style.paddingBottom = '';
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

  it('a section that names no heading opens the page at the top', async () => {
    const { props } = setup('');
    props.catalog[0].meta = twoSections;
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    document.body.style.minHeight = '5000px';
    try {
      window.scrollTo(0, 1000);
      await setHash('#/ui/Card?section=Nope');
      await expect.element(screen.getByRole('heading', { level: 2, name: 'Two' })).toBeInTheDocument();
      await expect.poll(() => window.scrollY).toBe(0);
    } finally {
      document.body.style.minHeight = '';
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

  it('Back onto a page taller than the one left returns to its position', async () => {
    const { props } = setup('');
    for (let i = 0; i < 40; i++)
      props.catalog.push({ group: 'ui', name: `Item${i}`, dir: '', path: `ui/Item${i}`, load, meta });
    const screen = await render(App, { props });
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    await expect.poll(() => document.querySelectorAll('.thumb .mark').length).toBe(41);
    const bottom = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, bottom);
    await setHash('#/ui/Card');
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
    expect(document.documentElement.scrollHeight - innerHeight).toBeLessThan(bottom / 2);
    history.back();
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    await expect.poll(() => window.scrollY).toBe(bottom);
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

  it('a link copied at full width opens at full width over a remembered width', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].meta = () =>
      Promise.resolve({ default: { sections: [{ title: 'One', code: '<p>one</p>' }], doc: null } });
    sessionStorage.setItem(`svelte-zukan:width:${location.pathname}#/preview/ui/Card?section=One`, '375');
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    try {
      const screen = await render(App, { props });
      const iframeWidth = () => Math.round(screen.getByTitle('One').element().getBoundingClientRect().width);
      await expect.poll(iframeWidth).toBe(375);
      await screen.getByRole('button', { name: 'Full width' }).click();
      await screen.getByRole('button', { name: 'Copy link to this view' }).click();
      const link = writeText.mock.calls[0][0];
      expect(link).toMatch(/[?&]width=full(&|$)/);
      await screen.getByRole('button', { name: 'Tablet (768px)', exact: true }).click();
      await expect.poll(iframeWidth).toBe(768);
      await setHash(link.slice(link.indexOf('#')));
      await expect.poll(iframeWidth).toBeGreaterThan(768);
    } finally {
      writeText.mockRestore();
      sessionStorage.clear();
    }
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
