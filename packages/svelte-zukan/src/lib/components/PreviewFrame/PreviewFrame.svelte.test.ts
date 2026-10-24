import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { userEvent } from 'vitest/browser';
import { messages } from '../../app/i18n.js';
import PreviewFrame from './PreviewFrame.svelte';

const props = {
  src: 'about:blank',
  tabHref: 'about:blank',
  title: 'preview',
  theme: 'light' as const,
  labels: messages.en
};

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
    // above the stage it is laid out at that width (up to 3840) and scaled down to the stage
    await userEvent.fill(input, '5000');
    await userEvent.keyboard('{Enter}');
    await expect.element(input).toHaveValue(3840);
    await expect.poll(() => iframeWidth(screen.container)).toBe(1000 - 14);
    await userEvent.fill(input, '300');
    await userEvent.keyboard('{Escape}');
    await expect.element(input).toHaveValue(3840);
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

  it('lays out a preset wider than the stage at its width and scales it to fit', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '600px';
    await screen.getByRole('button', { name: 'Desktop (1280px)', exact: true }).click();
    const iframe = screen.container.querySelector('iframe')!;
    // laid out at 1280px, shown at the 586px the stage has
    await expect.poll(() => iframe.offsetWidth).toBe(1280);
    await expect.poll(() => iframeWidth(screen.container)).toBe(586);
    expect(iframe.contentWindow!.innerWidth).toBe(1280);
    await expect.element(screen.getByRole('spinbutton', { name: 'Width in pixels' })).toHaveValue(1280);
    // its explanation is the tooltip, and read after the number by screen readers
    const zoom = screen.container.querySelector<HTMLElement>('.zoom')!;
    await expect.element(zoom).toHaveTextContent(`46% ${messages.en.scaledToFit}`);
    expect(zoom.getAttribute('data-tip')).toBe(messages.en.scaledToFit);
    await expect.element(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '1280');
    // the visible box follows the scaled height
    const viewport = iframe.parentElement!;
    expect(Math.abs(viewport.getBoundingClientRect().height - iframe.getBoundingClientRect().height)).toBeLessThan(1.5);
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
    // centered, the frame grows on both sides: twice the pointer's movement
    await expect.poll(() => iframeWidth(screen.container)).toBe(475);
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
    await expect.poll(() => iframeWidth(screen.container)).toBe(476);
    await expect.element(screen.getByRole('spinbutton', { name: 'Width in pixels' })).toHaveValue(476);
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

  it('content with min-height: 100vh keeps its height after the preview is expanded and back', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.minHeight = '100vh';
    doc.body.append(target);
    await new Promise((r) => setTimeout(r, 500));
    const before = iframe.style.height;
    // the expanded stage is far taller than the preview, and the page follows it while expanded
    await screen.getByRole('button', { name: 'Expand' }).click();
    await expect.poll(() => iframe.getBoundingClientRect().height).toBeGreaterThan(parseFloat(before) + 100);
    await new Promise((r) => setTimeout(r, 500));
    await screen.getByRole('button', { name: 'Exit expanded view (Esc)' }).click();
    await new Promise((r) => setTimeout(r, 500));
    expect(iframe.style.height).toBe(before);
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

  it('runs axe-core inside the preview page and lists what it finds', async () => {
    const source = `window.axe = { run: async (context) => ({ violations: [{ id: 'image-alt', impact: 'critical',
      help: 'Images must have alternative text', helpUrl: 'https://example.com/image-alt',
      nodes: [{ target: [context.tagName.toLowerCase()] }] }] }) };`;
    const axe = vi.fn(() => Promise.resolve(source));
    const screen = await render(PreviewFrame, { props: { ...props, axe } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    await expect.element(screen.getByRole('button', { name: 'Check accessibility' })).toBeEnabled();
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.element(screen.getByText('Accessibility issues (1)')).toBeInTheDocument();
    await expect.element(screen.getByText('critical')).toBeInTheDocument();
    await expect.element(screen.getByText('body')).toBeInTheDocument();
    await expect
      .element(screen.getByRole('link', { name: 'Learn more' }))
      .toHaveAttribute('href', 'https://example.com/image-alt');
    await screen.getByRole('button', { name: 'Check again' }).click();
    await expect.element(screen.getByText('Accessibility issues (1)')).toBeInTheDocument();
    expect(axe).toHaveBeenCalledTimes(1);
    await screen.getByRole('button', { name: 'Close' }).click();
    await expect.element(screen.getByText('Accessibility issues (1)')).not.toBeInTheDocument();
  });

  it('highlights the reported elements, thicker when picked, and simulates vision', async () => {
    const source = `window.axe = { run: async () => ({ violations: [{ id: 'color-contrast', impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds', helpUrl: 'https://example.com/c',
      nodes: [{ target: ['body'] }] }] }) };`;
    const screen = await render(PreviewFrame, { props: { ...props, axe: () => Promise.resolve(source) } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    const head = () => frame.contentDocument!.head.textContent;
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.poll(head).toContain('body{outline:2px solid');
    await screen.getByRole('button', { name: 'body' }).click();
    await expect.element(screen.getByRole('button', { name: 'body' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(head).toContain('body{outline:4px solid');
    await screen.getByRole('button', { name: 'body' }).click();
    await screen.getByRole('button', { name: 'body' }).hover();
    await expect.poll(head).toContain('body{outline:4px solid');
    await screen.getByRole('switch', { name: 'Outline where issues were found' }).click();
    await expect.poll(head).not.toContain('outline');
    const vision = screen.getByRole('radiogroup', { name: 'Simulate vision' });
    await expect.element(vision.getByRole('radio', { name: 'Normal' })).toBeChecked();
    await vision.getByRole('radio', { name: 'Deuteranopia' }).click();
    await expect.element(vision.getByRole('radio', { name: 'Deuteranopia' })).toBeChecked();
    await expect.poll(head).toContain('url(#zukan-vision)');
    expect(frame.contentDocument!.querySelector('#zukan-vision feColorMatrix')).not.toBeNull();
    // a radio group: the arrow keys move the choice
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await expect.element(vision.getByRole('radio', { name: 'Blurred' })).toBeChecked();
    expect(document.activeElement?.textContent?.trim()).toBe('Blurred');
    await expect.poll(head).toContain('blur(2px)');
    await screen.getByRole('button', { name: 'Close' }).click();
    await expect.poll(head).not.toContain('filter');
    expect(frame.contentDocument!.querySelector('#zukan-vision')).toBeNull();
  });

  it('lists what axe-core could not decide as needing a manual check, outlined dashed', async () => {
    const source = `window.axe = { run: async () => ({ violations: [], incomplete: [{ id: 'color-contrast', impact: 'serious',
      help: 'Elements must meet minimum color contrast ratio thresholds', helpUrl: 'https://example.com/c',
      nodes: [{ target: ['body'] }] }] }) };`;
    const screen = await render(PreviewFrame, { props: { ...props, axe: () => Promise.resolve(source) } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.element(screen.getByText('Needs a manual check (1)')).toBeInTheDocument();
    expect(screen.getByText('No accessibility issues found').query()).toBeNull();
    await expect.element(screen.getByRole('button', { name: 'body' })).toBeInTheDocument();
    await expect.poll(() => frame.contentDocument!.head.textContent).toContain('body{outline:2px dashed');
  });

  it('names and outlines an element inside a shadow root, not the elements its selectors match outside', async () => {
    // axe-core gives a node inside a shadow root as a path: the host, then the selector inside it
    const source = `window.axe = { run: async () => {
      const host = document.body.appendChild(document.createElement('my-el'));
      host.attachShadow({ mode: 'open' }).innerHTML = '<span>inside</span>';
      document.body.appendChild(document.createElement('span'));
      return { violations: [{ id: 'color-contrast', impact: 'serious', help: 'Contrast', helpUrl: 'https://example.com/c',
        nodes: [{ target: [['my-el', 'span']] }] }] };
    } };`;
    const screen = await render(PreviewFrame, { props: { ...props, axe: () => Promise.resolve(source) } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.element(screen.getByRole('button', { name: 'my-el >>> span' })).toBeInTheDocument();
    const shadow = () => frame.contentDocument!.querySelector('my-el')!.shadowRoot!.querySelector('style')?.textContent;
    await expect.poll(shadow).toContain('span{outline:2px solid');
    expect(frame.contentDocument!.head.textContent).not.toContain('span{outline');
  });

  it('still outlines the other elements when a selector has ` >>> ` inside an attribute value', async () => {
    // split, the first half still matches a host here (an unclosed string ends at the selector's end), and the second throws
    const source = `window.axe = { run: async () => {
      const host = document.body.appendChild(document.createElement('my-el'));
      host.title = 'go';
      host.attachShadow({ mode: 'open' });
      return { violations: [{ id: 'button-name', impact: 'critical', help: 'Buttons must have discernible text',
        helpUrl: 'https://example.com/b', nodes: [{ target: ['my-el[title="go >>> next"]'] }, { target: ['body'] }] }] };
    } };`;
    const screen = await render(PreviewFrame, { props: { ...props, axe: () => Promise.resolve(source) } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.poll(() => frame.contentDocument!.head.textContent).toContain('body{outline:2px solid');
  });

  it('doubles the text size of the preview, from its own root font size', async () => {
    const screen = await render(PreviewFrame, {
      props: { ...props, axe: () => Promise.resolve('window.axe = { run: async () => ({ violations: [] }) };') }
    });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    const doc = frame.contentDocument!;
    doc.documentElement.style.fontSize = '10px';
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    const zoom = screen.getByRole('button', { name: 'Text 200%' });
    await zoom.click();
    await expect.element(zoom).toHaveAttribute('aria-pressed', 'true');
    expect(doc.defaultView!.getComputedStyle(doc.documentElement).fontSize).toBe('20px');
    await zoom.click();
    expect(doc.defaultView!.getComputedStyle(doc.documentElement).fontSize).toBe('10px');
  });

  it('numbers the elements in Tab order over the preview, and again when they change', async () => {
    const screen = await render(PreviewFrame, {
      props: { ...props, axe: () => Promise.resolve('window.axe = { run: async () => ({ violations: [] }) };') }
    });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    const doc = frame.contentDocument!;
    const root = doc.createElement('div');
    root.setAttribute('data-zukan-preview', '');
    root.innerHTML = '<button>a</button><input><a href="#" tabindex="1">b</a><button disabled>c</button>';
    doc.body.append(root);
    const badges = () => [...doc.querySelectorAll('[aria-hidden="true"] > span')].map((b) => b.textContent);
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await screen.getByRole('button', { name: 'Tab order' }).click();
    await expect.poll(badges).toEqual(['1', '2', '3']);
    // the link has tabindex="1", so its badge comes first and sits at its corner
    const link = doc.querySelector('a')!.getBoundingClientRect();
    const badge = doc.querySelector('[aria-hidden="true"] > span')!.getBoundingClientRect();
    expect(Math.round(badge.left + 9)).toBe(Math.round(link.left));
    root.append(doc.createElement('textarea'));
    await expect.poll(badges).toEqual(['1', '2', '3', '4']);
    await screen.getByRole('button', { name: 'Tab order' }).click();
    await expect.poll(badges).toEqual([]);
  });

  it('numbers the elements again on a scroll inside the preview and on a radio pick, which change no DOM', async () => {
    const screen = await render(PreviewFrame, {
      props: { ...props, axe: () => Promise.resolve('window.axe = { run: async () => ({ violations: [] }) };') }
    });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    const doc = frame.contentDocument!;
    const root = doc.createElement('div');
    root.setAttribute('data-zukan-preview', '');
    root.innerHTML = `<div style="height: 40px; overflow: auto"><div style="height: 100px"></div><button>a</button>
      <div style="height: 100px"></div></div><input type="radio" name="r" checked><input type="radio" name="r">`;
    doc.body.append(root);
    const badge = (n: number) => doc.querySelectorAll('[aria-hidden="true"] > span')[n]?.getBoundingClientRect();
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await screen.getByRole('button', { name: 'Tab order' }).click();
    await expect.poll(() => badge(1)).toBeTruthy();
    // the preview's height settles first, so only the scroll below can draw the badges again
    await new Promise((r) => setTimeout(r, 500));
    const before = badge(0)!.top;
    root.querySelector('div')!.scrollTop = 60;
    await expect.poll(() => badge(0)!.top).toBeCloseTo(before - 60, 0);
    const [one, two] = root.querySelectorAll('input');
    expect(badge(1)!.left).toBeCloseTo(one.getBoundingClientRect().left - 9, 0);
    two.click();
    await expect.poll(() => badge(1)!.left).toBeCloseTo(two.getBoundingClientRect().left - 9, 0);
  });

  it('says when nothing is found, and when the check fails', async () => {
    const axe = () =>
      Promise.resolve(
        'window.axe = { run: async () => { if (window.fail) throw new Error("boom"); return { violations: [] }; } };'
      );
    const screen = await render(PreviewFrame, { props: { ...props, axe } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.element(screen.getByText('No accessibility issues found')).toBeInTheDocument();
    (frame.contentWindow as Window & { fail?: boolean }).fail = true;
    await screen.getByRole('button', { name: 'Check again' }).click();
    await expect.element(screen.getByText('Could not run the check: boom')).toBeInTheDocument();
  });

  it('reports a preview that failed to load instead of checking its error message', async () => {
    const axe = vi.fn(() => Promise.resolve('window.axe = { run: async () => ({ violations: [] }) };'));
    const screen = await render(PreviewFrame, { props: { ...props, axe } });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    frame.contentDocument!.body.innerHTML =
      '<div data-zukan-preview><p data-zukan-error>Failed to load: boom</p></div>';
    await screen.getByRole('button', { name: 'Check accessibility' }).click();
    await expect.element(screen.getByText('Could not run the check: Failed to load: boom')).toBeInTheDocument();
    expect(axe).not.toHaveBeenCalled();
  });

  it('has no accessibility button without axe-core', async () => {
    const screen = await render(PreviewFrame, { props });
    await expect.element(screen.getByRole('button', { name: 'Show outlines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check accessibility' }).query()).toBeNull();
  });

  it('a narrow toolbar wraps instead of clipping its buttons', async () => {
    const screen = await render(PreviewFrame, {
      props: { ...props, axe: () => Promise.resolve(''), shareUrl: () => '' }
    });
    screen.container.style.width = '330px';
    const toolbar = screen.container.querySelector<HTMLElement>('.toolbar')!;
    await expect.poll(() => toolbar.getBoundingClientRect().width).toBeLessThanOrEqual(330);
    expect(toolbar.scrollWidth).toBeLessThanOrEqual(toolbar.clientWidth);
    const box = toolbar.getBoundingClientRect();
    for (const el of toolbar.querySelectorAll('button, a')) {
      const r = el.getBoundingClientRect();
      expect(r.right).toBeLessThanOrEqual(box.right + 0.5);
    }
    const input = toolbar.querySelector('input')!.getBoundingClientRect();
    const unit = toolbar.querySelector('.unit')!.getBoundingClientRect();
    expect(Math.abs(unit.top - input.top)).toBeLessThan(input.height);
  });

  it('a preset narrower than the stage is centered on a patterned stage; full width is not', async () => {
    const screen = await render(PreviewFrame, { props });
    screen.container.style.width = '1000px';
    const stage = screen.container.querySelector<HTMLElement>('.stage')!;
    const frame = screen.container.querySelector<HTMLElement>('.frame')!;
    await screen.getByRole('button', { name: 'Mobile (375px)', exact: true }).click();
    await expect.poll(() => iframeWidth(screen.container)).toBe(375);
    expect(stage.classList.contains('sized')).toBe(true);
    const s = stage.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    expect(Math.abs(f.left - s.left - (s.right - f.right))).toBeLessThan(1);
    await screen.getByRole('button', { name: 'Full width', exact: true }).click();
    await expect.poll(() => stage.classList.contains('sized')).toBe(false);
  });

  it('measures the element under the pointer with its margin, border and padding', async () => {
    const screen = await render(PreviewFrame, { props });
    const frame = screen.container.querySelector('iframe')!;
    await expect.poll(() => frame.contentDocument?.readyState).toBe('complete');
    const doc = frame.contentDocument!;
    const target = doc.createElement('div');
    target.className = 'card svelte-1abc2de';
    target.style.cssText = 'width:100px;height:50px;margin:10px;padding:5px;border:2px solid;box-sizing:border-box';
    doc.body.append(target);
    const hover = () => target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    hover();
    expect(doc.body.textContent).not.toContain('100 × 50');
    await screen.getByRole('button', { name: 'Measure elements on hover' }).click();
    await expect.poll(() => (hover(), doc.documentElement.textContent)).toContain('div.card  100 × 50');
    const boxes = [...doc.documentElement.querySelectorAll<HTMLElement>('[aria-hidden="true"] > div')];
    expect(boxes.map((b) => [b.style.width, b.style.borderWidth]).slice(0, 3)).toEqual([
      ['120px', '10px'],
      ['100px', '2px'],
      ['96px', '5px']
    ]);
    await screen.getByRole('button', { name: 'Measure elements on hover' }).click();
    await expect.poll(() => doc.documentElement.textContent).not.toContain('100 × 50');
  });

  it('labels come from props', async () => {
    const screen = await render(PreviewFrame, {
      props: {
        ...props,
        labels: {
          ...messages.en,
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

  it('fills the preview page with its own body color, so a page taller than its content is one color', async () => {
    const screen = await render(PreviewFrame, { props: { ...props, theme: 'dark' } });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    doc.body.style.background = 'rgb(21, 19, 29)';
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    doc.body.append(target);
    await expect.poll(() => doc.documentElement.style.backgroundColor).toBe('rgb(21, 19, 29)');
  });

  it('has no theme buttons of its own', async () => {
    const screen = await render(PreviewFrame, { props });
    await expect.element(screen.getByRole('button', { name: 'Dark', exact: true })).not.toBeInTheDocument();
  });

  it('links to the preview in a new tab', async () => {
    const screen = await render(PreviewFrame, {
      props: { ...props, src: './#/preview/ui/Card?section=One', tabHref: './#/preview/ui/Card?section=One' }
    });
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

  it('shows a tooltip with the name of a toolbar control on hover, without a native title', async () => {
    const screen = await render(PreviewFrame, { props: { ...props, shareUrl: () => '' } });
    const tip = screen.container.querySelector<HTMLElement>('.tip')!;
    expect(screen.container.querySelectorAll('.toolbar [title]')).toHaveLength(0);
    expect(tip.getAttribute('aria-hidden')).toBe('true');
    await screen.getByRole('button', { name: 'Measure elements on hover' }).hover();
    await expect.poll(() => tip.matches(':popover-open') && tip.textContent).toBe('Measure elements on hover');
    await screen.getByRole('spinbutton', { name: 'Width in pixels' }).hover();
    await expect.poll(() => tip.matches(':popover-open')).toBe(false);
    // it follows a state change, as the title did
    await screen.getByRole('button', { name: 'Background: Theme' }).hover();
    await expect.poll(() => tip.matches(':popover-open') && tip.textContent).toBe('Background: Theme');
    await screen.getByRole('button', { name: 'Background: Theme' }).click();
    await expect.poll(() => tip.textContent).toBe('Background: Checkerboard');
    // the clicked Background button losing focus does not hide the next button's tip
    await screen.getByRole('button', { name: 'Show outlines' }).hover();
    await screen.getByRole('button', { name: 'Show outlines' }).click();
    await expect.poll(() => tip.matches(':popover-open') && tip.textContent).toBe('Show outlines');
  });

  it('shows the tooltip on keyboard focus and keeps it inside the viewport', async () => {
    const screen = await render(PreviewFrame, { props: { ...props, shareUrl: () => '' } });
    const tip = screen.container.querySelector<HTMLElement>('.tip')!;
    // the pointer is left where the previous test put it; keep it off the buttons
    await screen.getByRole('spinbutton', { name: 'Width in pixels' }).hover();
    screen.getByRole('button', { name: 'Mobile (375px)', exact: true }).element().focus();
    await userEvent.tab();
    await expect.poll(() => tip.matches(':popover-open') && tip.textContent).toBe('Tablet (768px)');
    await userEvent.tab({ shift: true });
    await expect.poll(() => tip.textContent).toBe('Mobile (375px)');
    expect(tip.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
    const link = screen.getByRole('link', { name: 'Open in new tab' });
    link.element().focus();
    // a programmatic focus after keyboard use is still :focus-visible
    await expect.poll(() => tip.textContent).toBe('Open in new tab');
    expect(tip.getBoundingClientRect().right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    await userEvent.keyboard('{Escape}');
    await expect.poll(() => tip.matches(':popover-open')).toBe(false);
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
