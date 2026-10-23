const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable="false"])';

const radio = (el: HTMLElement): el is HTMLInputElement =>
  el.localName === 'input' && (el as HTMLInputElement).type === 'radio' && !!(el as HTMLInputElement).name;

/**
 * The elements under `root` that the Tab key moves to, in that order: a positive `tabindex` first, by its value, then
 * the rest in document order. Elements in a shadow root or another frame are not followed.
 */
export function tabOrder(root: Element): HTMLElement[] {
  const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.matches(':disabled, [type="hidden"]') &&
      !el.closest('[inert]') &&
      el.checkVisibility({ visibilityProperty: true })
  );
  // a radio group is one stop: its checked radio, or else its first
  const stops = focusable.filter((el) => {
    if (!radio(el)) return true;
    const group = focusable.filter((other) => radio(other) && other.name === el.name && other.form === el.form);
    return group.some((r) => (r as HTMLInputElement).checked) ? el.checked : group[0] === el;
  });
  const positive = stops.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
  return [...positive, ...stops.filter((el) => el.tabIndex === 0)];
}
