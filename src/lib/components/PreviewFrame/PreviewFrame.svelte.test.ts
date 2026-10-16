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
    screen.container.style.width = '1000px';
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

  it('reports the effective width when the stage is narrower than the preset', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '600px';
    await screen.getByRole('button', { name: '1280', exact: true }).click();
    expect(frameStyle(screen.container).width).toBe('1280px');
    await expect.element(screen.getByText('600px', { exact: true })).toBeInTheDocument();
    await expect.element(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '600');
    await expect
      .element(screen.getByRole('button', { name: '1280', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
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
