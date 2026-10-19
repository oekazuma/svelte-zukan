import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import EntryList from './EntryList.svelte';

const load = () => Promise.reject(new Error('unused'));
const meta = () => Promise.resolve({ default: { sections: [], doc: null } });

describe('EntryList', () => {
  it('shows dir to tell same names apart', async () => {
    const screen = await render(EntryList, {
      props: {
        entries: [
          { group: 'ui', name: 'Button', dir: 'lib/forms', path: 'ui/lib/forms/Button', load, meta },
          { group: 'ui', name: 'Button', dir: 'lib/nav', path: 'ui/lib/nav/Button', load, meta }
        ]
      }
    });
    await expect.element(screen.getByText('lib/forms')).toBeInTheDocument();
    await expect.element(screen.getByText('lib/nav')).toBeInTheDocument();
    const hrefs = screen
      .getByRole('link')
      .elements()
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['#/ui/lib/forms/Button', '#/ui/lib/nav/Button']);
  });
});
