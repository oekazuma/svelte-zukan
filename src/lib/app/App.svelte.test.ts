import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import App from './App.svelte';
import Catalog from './Catalog.test.svelte';
import Wrapper from './Wrapper.test.svelte';

const load = () => Promise.resolve({ default: Catalog, __zukan: { sections: [], doc: null } });

function setup(hash: string) {
  location.hash = hash;
  const wrapper = vi.fn(() => Promise.resolve({ default: Wrapper }));
  const catalog = [{ group: 'ui', name: 'Card', dir: '', path: 'ui/Card', load }];
  return { wrapper, props: { catalog, logo: null, wrapper, title: 'zukan', locale: 'en' as const } };
}

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

  it('an unknown ID is not found', async () => {
    const { props } = setup('#/ui/Nope');
    const screen = await render(App, { props });
    await expect.element(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('a load error is shown', async () => {
    const { props } = setup('#/ui/Card');
    props.catalog[0].load = () => Promise.reject(new Error('boom'));
    const screen = await render(App, { props });
    await expect.element(screen.getByText('Failed to load: boom')).toBeInTheDocument();
  });

  it('follows hashchange', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    location.hash = '#/ui/Card';
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });
});
