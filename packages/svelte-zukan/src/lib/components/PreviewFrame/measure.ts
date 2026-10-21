/** the colors of browser dev tools, so the boxes read the way people already know them */
const COLORS = {
  margin: 'rgb(246 178 107 / 0.55)',
  border: 'rgb(255 229 153 / 0.65)',
  padding: 'rgb(147 196 125 / 0.55)',
  content: 'rgb(111 168 220 / 0.55)'
};

const px = (value: string) => Math.max(0, parseFloat(value) || 0);

/**
 * While the pointer is over an element of `doc`, draws its margin, border, padding and content boxes and a label with
 * its size, like the box model overlay of browser dev tools. Returns the function that stops it.
 */
export function startMeasure(doc: Document): () => void {
  const layer = doc.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  const box = (color: string) => {
    const el = doc.createElement('div');
    el.style.cssText = `position:fixed;box-sizing:border-box;border-style:solid;border-color:${color}`;
    layer.append(el);
    return el;
  };
  const margin = box(COLORS.margin);
  const border = box(COLORS.border);
  const padding = box(COLORS.padding);
  padding.style.backgroundColor = COLORS.content;
  padding.style.backgroundClip = 'padding-box';
  const label = doc.createElement('div');
  label.style.cssText =
    'position:fixed;padding:2px 6px;border-radius:4px;background:#1f2328;color:#fff;' +
    'font:12px/1.4 ui-monospace,monospace;white-space:nowrap';
  layer.append(label);

  const place = (el: HTMLElement, left: number, top: number, width: number, height: number, widths: number[]) => {
    Object.assign(el.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${Math.max(0, width)}px`,
      height: `${Math.max(0, height)}px`,
      borderWidth: widths.map((w) => `${w}px`).join(' ')
    });
  };

  function show(target: Element) {
    if (target === doc.documentElement || layer.contains(target)) return hide();
    const r = target.getBoundingClientRect();
    const s = doc.defaultView!.getComputedStyle(target);
    const m = [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].map(px);
    const b = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].map(px);
    const p = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px);
    place(margin, r.left - m[3], r.top - m[0], r.width + m[1] + m[3], r.height + m[0] + m[2], m);
    place(border, r.left, r.top, r.width, r.height, b);
    place(padding, r.left + b[3], r.top + b[0], r.width - b[1] - b[3], r.height - b[0] - b[2], p);
    // Svelte's scoping classes (`svelte-1abc2de`) say nothing about the element
    const classes = [...target.classList].filter((c) => !/^svelte-[a-z0-9]+$/.test(c));
    const name = target.tagName.toLowerCase() + classes.map((c) => `.${c}`).join('');
    label.textContent = `${name}  ${Math.round(r.width * 100) / 100} × ${Math.round(r.height * 100) / 100}`;
    // below the element when there is no room above it
    const above = r.top - m[0] - 24;
    label.style.left = `${Math.max(0, r.left - m[3])}px`;
    label.style.top = `${above >= 0 ? above : r.bottom + m[2] + 4}px`;
    if (!layer.isConnected) doc.documentElement.append(layer);
  }

  function hide() {
    layer.remove();
  }

  const onmove = (e: Event) => {
    if (e.target instanceof doc.defaultView!.Element) show(e.target);
  };
  doc.addEventListener('pointermove', onmove);
  doc.documentElement.addEventListener('pointerleave', hide);
  return () => {
    doc.removeEventListener('pointermove', onmove);
    doc.documentElement.removeEventListener('pointerleave', hide);
    hide();
  };
}
