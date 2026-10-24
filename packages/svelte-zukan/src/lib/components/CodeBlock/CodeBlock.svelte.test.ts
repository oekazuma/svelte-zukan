import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import CodeBlock from './CodeBlock.svelte';

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderOpen(props: {
  code: string;
  labels?: { code: string; copy: string; copied: string; copyFailed: string };
}) {
  const screen = await render(CodeBlock, { props });
  await screen.getByText(props.labels?.code ?? 'Code').click();
  return screen;
}

describe('CodeBlock', () => {
  it('has no copy button while the code is collapsed', async () => {
    const screen = await render(CodeBlock, { props: { code: '<a />' } });
    expect(screen.container.querySelector('details')!.open).toBe(false);
    expect(screen.container.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy' }).query()).toBeNull();
  });

  it('starts open with `open`', async () => {
    const screen = await render(CodeBlock, { props: { code: '<a />', open: true } });
    expect(screen.container.querySelector('details')!.open).toBe(true);
    await expect.element(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  it('shows the copy button once the code is open, and removes it again on close', async () => {
    const screen = await render(CodeBlock, { props: { code: '<a />' } });
    await screen.getByText('Code').click();
    await expect.element(screen.getByRole('button', { name: 'Copy' })).toBeVisible();
    await screen.getByText('Code').click();
    await expect.poll(() => screen.container.querySelector('button')).toBeNull();
  });

  it('copies the code', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const screen = await renderOpen({ code: '<a />' });
    await screen.getByRole('button', { name: 'Copy' }).click();
    expect(writeText).toHaveBeenCalledWith('<a />');
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.container.querySelector('details')!.open).toBe(true);
  });

  it('copy failure is shown', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const screen = await renderOpen({ code: '<a />' });
    await screen.getByRole('button', { name: 'Copy' }).click();
    await expect.element(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });

  it('works from the keyboard: the summary opens the code, then Tab reaches the copy button', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const screen = await render(CodeBlock, { props: { code: '<a />' } });
    const summary = screen.container.querySelector('summary')!;
    summary.focus();
    await userEvent.keyboard('{Enter}');
    const button = screen.getByRole('button', { name: 'Copy' });
    await expect.element(button).toBeVisible();
    await userEvent.tab();
    expect(document.activeElement).toBe(button.element());
    await userEvent.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith('<a />');
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(summary);
  });

  it('the copy button does not cover a long first line', async () => {
    const screen = await renderOpen({ code: 'x'.repeat(400) });
    const button = screen.getByRole('button', { name: 'Copy' }).element().getBoundingClientRect();
    const text = screen.container.querySelector('code')!.getBoundingClientRect();
    expect(button.bottom).toBeLessThanOrEqual(text.top);
  });

  it('labels come from props', async () => {
    const labels = { code: 'Source', copy: 'Copy code', copied: 'Copied!', copyFailed: 'Copy error' };
    const screen = await renderOpen({ code: '', labels });
    await expect.element(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('colors the code without changing its text', async () => {
    const code = '<p class="x">{#if a}b{/if}</p>';
    const screen = await render(CodeBlock, { props: { code } });
    const el = screen.container.querySelector('code')!;
    expect(el.textContent).toBe(code);
    expect([...el.querySelectorAll('span')].map((s) => `${s.className.split(' ')[0]}:${s.textContent}`)).toContain(
      'tag:<p'
    );
  });
});
