import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import PreviewFrame from './PreviewFrame.svelte';

const props = { src: 'about:blank', title: 'preview' };

function frameStyle(container: HTMLElement) {
  return container.querySelector('iframe')!.parentElement!.style;
}

describe('PreviewFrame', () => {
  it('preset sets frame width', async () => {
    const screen = await render(PreviewFrame, { props });
    await screen.getByRole('button', { name: '768', exact: true }).click();
    expect(frameStyle(screen.container).width).toBe('768px');
    await expect.element(screen.getByText('768px', { exact: true })).toBeInTheDocument();
  });

  it('full width preset', async () => {
    const screen = await render(PreviewFrame, { props });
    await screen.getByRole('button', { name: '375', exact: true }).click();
    expect(frameStyle(screen.container).width).toBe('375px');
    await screen.getByRole('button', { name: '100%', exact: true }).click();
    expect(frameStyle(screen.container).width).toBe('100%');
  });

  it('presets are buttons with aria-pressed', async () => {
    const screen = await render(PreviewFrame, { props });
    await screen.getByRole('button', { name: '1024', exact: true }).click();
    await expect
      .element(screen.getByRole('button', { name: '1024', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(screen.getByRole('button', { name: '768', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
    await expect
      .element(screen.getByRole('button', { name: '100%', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
  });
});
