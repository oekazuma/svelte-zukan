import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CodeBlock from './CodeBlock.svelte';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CodeBlock', () => {
  it('copies the code', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const screen = await render(CodeBlock, { props: { code: '<a />' } });
    await screen.getByRole('button', { name: 'Copy' }).click();
    expect(writeText).toHaveBeenCalledWith('<a />');
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('copy failure is shown', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const screen = await render(CodeBlock, { props: { code: '<a />' } });
    await screen.getByRole('button', { name: 'Copy' }).click();
    await expect.element(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });

  it('the copy button sits on the summary row and does not toggle the code', async () => {
    const screen = await render(CodeBlock, { props: { code: '<a />' } });
    const summary = screen.getByText('Code').element().getBoundingClientRect();
    const button = screen.getByRole('button', { name: 'Copy' });
    const rect = button.element().getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(summary.top);
    expect(rect.bottom).toBeLessThanOrEqual(summary.bottom);
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await button.click();
    expect(screen.container.querySelector('details')!.open).toBe(false);
  });

  it('labels come from props', async () => {
    const labels = { code: 'コード', copy: 'コピー', copied: 'コピーしました', copyFailed: 'コピーできませんでした' };
    const screen = await render(CodeBlock, { props: { code: '', labels } });
    await expect.element(screen.getByText('コード')).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'コピー' })).toBeInTheDocument();
  });
});
