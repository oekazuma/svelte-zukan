import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntryList from './EntryList.svelte';

const load = () => Promise.reject(new Error('unused'));
const meta = () => Promise.resolve({ default: { sections: [], doc: null } });
const entries = [
  { group: 'ui', name: 'Alert', dir: 'lib', path: 'ui/lib/Alert', load, meta },
  { group: 'ui', name: 'Button', dir: 'lib/forms', path: 'ui/lib/forms/Button', load, meta },
  { group: 'ui', name: 'Button', dir: 'lib/nav', path: 'ui/lib/nav/Button', load, meta }
];

describe('EntryList', () => {
  it('shows each dir as a folder, so same names are told apart', async () => {
    const screen = await render(EntryList, { props: { entries } });
    for (const name of ['lib', 'forms', 'nav'])
      await expect.element(screen.getByText(name, { exact: true })).toBeInTheDocument();
    const hrefs = screen
      .getByRole('link')
      .elements()
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['#/ui/lib/Alert', '#/ui/lib/forms/Button', '#/ui/lib/nav/Button']);
  });

  it('counts the entries in each folder, and a folder folds', async () => {
    const screen = await render(EntryList, { props: { entries } });
    const lib = screen.container.querySelector('summary')!;
    expect(lib.textContent).toBe('lib3');
    lib.click();
    await expect.poll(() => (lib.parentElement as HTMLDetailsElement).open).toBe(false);
    expect(screen.container.querySelector('a[href="#/ui/lib/Alert"]')!.checkVisibility()).toBe(false);
  });

  it('lists the sections that matched a search under their entry', async () => {
    const screen = await render(EntryList, {
      props: { entries, hits: new Map([['ui/lib/Alert', ['Dismissible']]]) }
    });
    await expect
      .element(screen.getByRole('link', { name: 'Dismissible' }))
      .toHaveAttribute('href', '#/ui/lib/Alert?section=Dismissible');
  });
});
