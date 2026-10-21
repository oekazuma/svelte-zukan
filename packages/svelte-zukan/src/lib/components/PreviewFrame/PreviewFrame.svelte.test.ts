import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import PreviewFrame from './PreviewFrame.svelte';

const props = { src: 'about:blank', title: 'preview' };

// widths and the background are remembered in storage; no test may start from another test's choice
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/** the iframe's rendered width: the grip sits beside it, so this is the width the preview gets */
function iframeWidth(container: HTMLElement) {
  return Math.round(container.querySelector('iframe')!.getBoundingClientRect().width);
}

describe('PreviewFrame', () => {
  it('preset sets frame width', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    await screen.getByRole('button', { name: 'Tablet (768px)', exact: true }).click();
    await expect.poll(() => iframeWidth(screen.container)).toBe(768);
    await expect.element(screen.getByRole('spinbutton', { name: 'Width in pixels' })).toHaveValue(768);
  });

  it('a typed width is applied, clamped, and Escape restores the shown one', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    const input = screen.getByRole('spinbutton', { name: 'Width in pixels' });
    // the stage is measured after the resize; a width typed before that would be clamped to the old one
    await expect.element(input).toHaveValue(1000 - 14);
    await userEvent.fill(input, '420');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => iframeWidth(screen.container)).toBe(420);
    await userEvent.fill(input, '5000');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => iframeWidth(screen.container)).toBe(1000 - 14);
    await expect.element(input).toHaveValue(1000 - 14);
    await userEvent.fill(input, '300');
    await userEvent.keyboard('{Escape}');
    await expect.element(input).toHaveValue(1000 - 14);
    expect(iframeWidth(screen.container)).toBe(1000 - 14);
  });

  it('the background button cycles theme, checkerboard and grid, and is remembered', async () => {
    const screen = await render(PreviewFrame, { props });
    const frame = () => screen.container.querySelector('iframe')!.contentDocument!;
    await expect.poll(() => frame().readyState).toBe('complete');
    await screen.getByRole('button', { name: 'Background: Theme' }).click();
    await expect.poll(() => frame().head.textContent).toContain('conic-gradient');
    await screen.getByRole('button', { name: 'Background: Checkerboard' }).click();
    await expect.poll(() => frame().head.textContent).toContain('linear-gradient');
    expect(sessionStorage.getItem('svelte-zukan:background')).toBe('grid');
    await screen.getByRole('button', { name: 'Background: Grid' }).click();
    await expect.poll(() => frame().head.textContent).not.toContain('gradient');
  });

  it('width presets are a labelled group and the readout is not a live region', async () => {
    const screen = await render(PreviewFrame, { props });
    await expect
      .element(
        screen
          .getByRole('group', { name: 'Preview width' })
          .getByRole('button', { name: 'Tablet (768px)', exact: true })
      )
      .toBeInTheDocument();
    expect(screen.container.querySelector('output')).toBeNull();
  });

  it('full width preset', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    await screen.getByRole('button', { name: 'Mobile (375px)', exact: true }).click();
    await expect.poll(() => iframeWidth(screen.container)).toBe(375);
    await screen.getByRole('button', { name: 'Full width', exact: true }).click();
    // the stage minus the 14px grip
    await expect.poll(() => iframeWidth(screen.container)).toBe(986);
  });

  it('reports the effective width when the stage is narrower than the preset', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '600px';
    await screen.getByRole('button', { name: 'Desktop (1280px)', exact: true }).click();
    await expect.poll(() => iframeWidth(screen.container)).toBe(586);
    await expect.element(screen.getByRole('spinbutton', { name: 'Width in pixels' })).toHaveValue(586);
    await expect.element(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '586');
    await expect
      .element(screen.getByRole('button', { name: 'Desktop (1280px)', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('presets are buttons with aria-pressed', async () => {
    const screen = await render(PreviewFrame, { props });
    await screen.getByRole('button', { name: 'Laptop (1024px)', exact: true }).click();
    await expect
      .element(screen.getByRole('button', { name: 'Laptop (1024px)', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect
      .element(screen.getByRole('button', { name: 'Tablet (768px)', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
    await expect
      .element(screen.getByRole('button', { name: 'Full width', exact: true }))
      .toHaveAttribute('aria-pressed', 'false');
  });
});

describe('PreviewFrame resizing', () => {
  it('keyboard resize', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    const handle = screen.getByRole('separator');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '986');
    handle.element().focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '976');
    await userEvent.keyboard('{Home}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '200');
    await userEvent.keyboard('{End}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '986');
  });

  it('drag resize', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    await screen.getByRole('button', { name: 'Mobile (375px)', exact: true }).click();
    const handle = screen.getByRole('separator').element();
    const iframe = screen.container.querySelector('iframe')!;
    const send = (type: string, clientX: number, button = 0) =>
      handle.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button, clientX }));

    send('pointerdown', 100, 2);
    send('pointermove', 150);
    await expect.poll(() => iframeWidth(screen.container)).toBe(375);

    send('pointerdown', 100);
    await expect.poll(() => getComputedStyle(iframe).pointerEvents).toBe('none');
    send('pointermove', 150);
    send('pointerup', 150);
    await expect.poll(() => iframeWidth(screen.container)).toBe(425);
    expect(getComputedStyle(iframe).pointerEvents).not.toBe('none');
  });

  it('dragging keeps whole pixels', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    await screen.getByRole('button', { name: 'Mobile (375px)', exact: true }).click();
    const handle = screen.getByRole('separator').element();
    const send = (type: string, clientX: number) =>
      handle.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, clientX }));
    send('pointerdown', 100);
    send('pointermove', 150.4);
    send('pointerup', 150.4);
    await expect.poll(() => iframeWidth(screen.container)).toBe(425);
    await expect.element(screen.getByRole('spinbutton', { name: 'Width in pixels' })).toHaveValue(425);
  });

  it('aria-valuemin follows a narrow stage', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '150px';
    const handle = screen.getByRole('separator');
    // the stage minus the 14px grip
    await expect.element(handle).toHaveAttribute('aria-valuemin', '136');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '136');
    handle.element().focus();
    await userEvent.keyboard('{Home}');
    await expect.element(handle).toHaveAttribute('aria-valuenow', '136');
  });

  it('height follows the preview', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.height = '300px';
    doc.body.style.margin = '0';
    doc.body.append(target);
    await expect.poll(() => iframe.style.height).toBe('300px');
  });

  it('height includes the body padding and margin of the preview page', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    doc.body.style.margin = '8px';
    doc.body.style.padding = '16px';
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.height = '300px';
    doc.body.append(target);
    await expect.poll(() => iframe.style.height).toBe('348px');
    const scroller = doc.scrollingElement!;
    expect(scroller.scrollHeight).toBeLessThanOrEqual(scroller.clientHeight);
  });

  it('height includes a horizontal scrollbar', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '400px';
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.cssText = 'height: 300px; width: 2000px';
    doc.body.append(target);
    const scroller = doc.scrollingElement!;
    await expect.poll(() => scroller.scrollHeight <= scroller.clientHeight).toBe(true);
  });

  it('content exactly as tall as the initial frame still gets the body spacing', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    doc.body.style.margin = '0';
    doc.body.style.padding = '24px';
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    // 80px is also the frame's height before the first measurement
    target.style.height = '80px';
    doc.body.append(target);
    await expect.poll(() => iframe.style.height).toBe('128px');
  });

  it('content with min-height: 100vh does not keep growing', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.minHeight = '100vh';
    doc.body.append(target);
    await new Promise((r) => setTimeout(r, 500));
    const first = parseFloat(iframe.style.height);
    await new Promise((r) => setTimeout(r, 500));
    expect(parseFloat(iframe.style.height)).toBe(first);
  });

  it('shows no width before the stage is measured', async () => {
    const hidden = document.body.appendChild(document.createElement('div'));
    try {
      hidden.style.display = 'none';
      const screen = await render(PreviewFrame, { props, target: hidden });
      const handle = screen.getByRole('separator', { includeHidden: true }).element();
      expect(hidden.querySelector<HTMLInputElement>('.width input')!.value).toBe('');
      for (const name of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'])
        expect(handle.hasAttribute(name)).toBe(false);
      hidden.style.display = '';
      await expect.poll(() => handle.getAttribute('aria-valuenow')).not.toBeNull();
    } finally {
      hidden.remove();
    }
  });

  it('a width from a shared link wins over the remembered one', async () => {
    sessionStorage.setItem('svelte-zukan:width:about:blank', '500');
    const screen = await render(PreviewFrame, { props: { ...props, requestedWidth: 375 } });
    screen.container.style.width = '1000px';
    await expect.poll(() => iframeWidth(screen.container)).toBe(375);
  });

  it('copies a link to the current width and opens the themed page in a new tab', async () => {
    const shareUrl = (width: number | null) => `https://example.com/#/ui/A?width=${width}`;
    const screen = await render(PreviewFrame, {
      props: { ...props, shareUrl, tabHref: '/x#/preview/ui/A?theme=dark' }
    });
    screen.container.style.width = '1000px';
    await screen.getByRole('button', { name: 'Tablet (768px)', exact: true }).click();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await screen.getByRole('button', { name: 'Copy link to this view' }).click();
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('https://example.com/#/ui/A?width=768');
    expect(screen.getByRole('link', { name: 'Open in new tab' }).element().getAttribute('href')).toBe(
      '/x#/preview/ui/A?theme=dark'
    );
  });

  it('has no copy-link button without a share URL', async () => {
    const screen = await render(PreviewFrame, { props });
    await expect.element(screen.getByRole('link', { name: 'Open in new tab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link to this view' }).query()).toBeNull();
  });

  it('labels come from props', async () => {
    const screen = await render(PreviewFrame, {
      props: {
        ...props,
        labels: {
          previewWidth: 'Frame width',
          mobile: 'Phone',
          tablet: 'Pad',
          laptop: 'Notebook',
          desktop: 'Monitor',
          fullWidth: 'Full',
          openInNewTab: 'Pop out',
          outline: 'Boxes',
          expand: 'Bigger',
          collapse: 'Smaller',
          loading: 'Wait',
          copyLink: 'Share',
          copied: 'Done',
          copyFailed: 'Nope',
          background: 'Backdrop',
          backgroundTheme: 'Plain',
          backgroundChecker: 'Checks',
          backgroundGrid: 'Lines',
          widthInPixels: 'Pixels'
        }
      }
    });
    await expect.element(screen.getByRole('separator', { name: 'Frame width' })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Full' })).toBeInTheDocument();
    await expect.element(screen.getByRole('button', { name: 'Phone (375px)' })).toBeInTheDocument();
    await expect.element(screen.getByRole('link', { name: 'Pop out' })).toBeInTheDocument();
  });
});

describe('PreviewFrame toolbar', () => {
  it('applies the theme to the preview page and follows it', async () => {
    const screen = await render(PreviewFrame, { props: { ...props, theme: 'dark' } });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    await expect.poll(() => iframe.contentDocument!.documentElement.style.colorScheme).toBe('dark');
    expect(iframe.style.colorScheme).toBe('dark');
    expect(iframe.contentDocument!.documentElement.style.backgroundColor).toBe('rgb(13, 17, 23)');
    await screen.rerender({ theme: 'light' });
    await expect.poll(() => iframe.contentDocument!.documentElement.style.colorScheme).toBe('light');
    expect(iframe.style.colorScheme).toBe('light');
  });

  it('has no theme buttons of its own', async () => {
    const screen = await render(PreviewFrame, { props });
    await expect.element(screen.getByRole('button', { name: 'Dark', exact: true })).not.toBeInTheDocument();
  });

  it('links to the preview in a new tab', async () => {
    const screen = await render(PreviewFrame, { props: { ...props, src: './#/preview/ui/Card?section=One' } });
    const link = screen.getByRole('link', { name: 'Open in new tab' });
    await expect.element(link).toHaveAttribute('href', './#/preview/ui/Card?section=One');
    await expect.element(link).toHaveAttribute('target', '_blank');
  });

  it('loads the iframe lazily', async () => {
    const screen = await render(PreviewFrame, { props });
    expect(screen.container.querySelector('iframe')!.getAttribute('loading')).toBe('lazy');
  });
});

describe('PreviewFrame storage', () => {
  it('remembers the width per preview in sessionStorage', async () => {
    const screen = await render(PreviewFrame, { props });
    await screen.getByRole('button', { name: 'Mobile (375px)', exact: true }).click();
    await expect.poll(() => sessionStorage.getItem('svelte-zukan:width:about:blank')).toBe('375');
    await screen.getByRole('button', { name: 'Full width', exact: true }).click();
    await expect.poll(() => sessionStorage.getItem('svelte-zukan:width:about:blank')).toBeNull();
  });

  it('starts from a stored width', async () => {
    sessionStorage.setItem('svelte-zukan:width:about:blank', '768');
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    await expect.poll(() => iframeWidth(screen.container)).toBe(768);
  });
});

describe('PreviewFrame tools', () => {
  const addPreview = (iframe: HTMLIFrameElement, height = '120px') => {
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.height = height;
    doc.body.append(target);
    return doc;
  };

  it('outlines the elements of the preview page', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = addPreview(iframe);
    const toggle = screen.getByRole('button', { name: 'Show outlines' });
    await toggle.click();
    await expect.element(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => doc.head.querySelector('style')?.textContent ?? '').toContain('outline');
    await toggle.click();
    await expect.poll(() => doc.head.querySelector('style')).toBeNull();
  });

  it('expands over the page and leaves with Escape', async () => {
    const screen = await render(PreviewFrame, { props });
    const preview = screen.container.querySelector('.preview')!;
    await screen.getByRole('button', { name: 'Expand' }).click();
    expect(preview.classList.contains('expanded')).toBe(true);
    await expect
      .element(screen.getByRole('button', { name: 'Exit expanded view (Esc)' }))
      .toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => preview.classList.contains('expanded')).toBe(false);
    await expect.element(screen.getByRole('button', { name: 'Expand' })).toHaveFocus();
  });

  it('shows a skeleton until the preview is measured', async () => {
    const screen = await render(PreviewFrame, { props });
    await expect.element(screen.getByRole('status', { name: 'Loading the preview' })).toBeInTheDocument();
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    addPreview(iframe);
    await expect.element(screen.getByRole('status', { name: 'Loading the preview' })).not.toBeInTheDocument();
    expect(screen.container.querySelector('.frame')!.getAttribute('aria-busy')).toBe('false');
  });
});
