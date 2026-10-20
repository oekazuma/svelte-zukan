import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { PREVIEW_SECTION_KEY } from './context.js';
import Section from './Section.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>content</p>' }));

describe('Section', () => {
  it('renders children without context', async () => {
    const screen = await render(Section, { props: { title: 'A', children } });
    await expect.element(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders children when title matches', async () => {
    const screen = await render(Section, {
      props: { title: 'A', children },
      context: new Map([[PREVIEW_SECTION_KEY, 'A']])
    });
    await expect.element(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders nothing when title differs', async () => {
    const screen = await render(Section, {
      props: { title: 'A', children },
      context: new Map([[PREVIEW_SECTION_KEY, 'B']])
    });
    await expect.element(screen.getByText('content')).not.toBeInTheDocument();
  });

  it('renders nothing and does not throw without children', async () => {
    const screen = await render(Section, { props: { title: 'A' } });
    expect(screen.container.textContent).toBe('');
  });
});
