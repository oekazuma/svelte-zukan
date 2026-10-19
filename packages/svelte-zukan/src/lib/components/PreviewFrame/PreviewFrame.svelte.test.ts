import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
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

describe('PreviewFrame resizing', () => {
  it('keyboard resize', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    const handle = screen.getByRole('separator');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '1000');
    handle.element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '990');
    await userEvent.keyboard('{Home}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '200');
    await userEvent.keyboard('{End}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '1000');
  });

  it('drag resize', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    await screen.getByRole('button', { name: '375', exact: true }).click();
    const handle = screen.getByRole('separator').element();
    const iframe = screen.container.querySelector('iframe')!;
    const send = (type: string, clientX: number, button = 0) =>
      handle.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button, clientX }));

    send('pointerdown', 100, 2);
    send('pointermove', 150);
    expect(frameStyle(screen.container).width).toBe('375px');

    send('pointerdown', 100);
    await expect.poll(() => getComputedStyle(iframe).pointerEvents).toBe('none');
    send('pointermove', 150);
    send('pointerup', 150);
    await expect.poll(() => frameStyle(screen.container).width).toBe('425px');
    expect(getComputedStyle(iframe).pointerEvents).not.toBe('none');
  });

  it('aria-valuemin follows a narrow stage', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '150px';
    const handle = screen.getByRole('separator');
    await expect.element(handle).toHaveAttribute('aria-valuemin', '150');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '150');
    handle.element().focus();
    await userEvent.keyboard('{Home}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '150');
  });

  it('height follows the preview', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.height = '300px';
    doc.body.append(target);
    await expect.poll(() => iframe.style.height).toBe('300px');
  });

  it('shows no width before the stage is measured', async () => {
    const hidden = document.body.appendChild(document.createElement('div'));
    hidden.style.display = 'none';
    const screen = await render(PreviewFrame, { props, target: hidden });
    const handle = screen.getByRole('separator', { includeHidden: true }).element();
    expect(hidden.querySelector('output')!.textContent).toBe('');
    for (const name of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'])
      expect(handle.hasAttribute(name)).toBe(false);
    hidden.style.display = '';
    await expect.poll(() => handle.getAttribute('aria-valuenow')).not.toBeNull();
    hidden.remove();
  });

  it('labels come from props', async () => {
    const screen = await render(PreviewFrame, {
      props: { ...props, labels: { previewWidth: 'Frame width', fullWidth: 'Full' } }
    });
    await expect.element(screen.getByRole('separator', { name: 'Frame width' })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Full' })).toBeInTheDocument();
  });
});
