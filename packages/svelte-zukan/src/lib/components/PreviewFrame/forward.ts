/** what the detail page takes as the reader's own scroll or click, which ends a heading's pin */
const POINTER_EVENTS = ['pointerdown', 'wheel', 'touchmove'];
const NOT_TYPED = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'];
/** a field where Escape cancels the edit; by tag name, as an element of a frame is of the frame's realm */
export const typesText = (el: HTMLElement) =>
  el.isContentEditable ||
  ['TEXTAREA', 'SELECT'].includes(el.tagName) ||
  (el.tagName === 'INPUT' && !NOT_TYPED.includes((el as HTMLInputElement).type));

/**
 * Keys and pointers in a frame never reach the catalog's window, so its shortcuts would stop once the frame has the
 * focus; the copy goes to the frame element, so the catalog's handlers get an element as the target, as on the page.
 * Returns the cleanup
 */
export function forwardEvents(view: Window, frame: HTMLIFrameElement) {
  const forward = (e: KeyboardEvent) => {
    const target = e.composedPath()[0] as HTMLElement;
    // the catalog's own page takes no shortcut from a checkbox either, but Escape still leaves the expanded view
    const typing =
      e.key === 'Escape'
        ? typesText(target)
        : target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    // Escape closes a dialog or a popover open in the frame first, which must not leave the expanded view too
    const closes = e.key === 'Escape' && view.document.querySelector('dialog[open], :popover-open');
    // as on the catalog's own page, a key in a dialog is the dialog's, but ⌘K still opens the search. The path, as
    // `closest` stops at a shadow root, and by tag name, as its elements are of the frame's realm
    const inDialog =
      !e.metaKey && !e.ctrlKey && e.composedPath().some((node) => (node as Element).tagName === 'DIALOG');
    if (e.defaultPrevented || e.isComposing || typing || closes || inDialog) return;
    const { key, code, location, repeat, ctrlKey, shiftKey, altKey, metaKey } = e;
    const copy = { key, code, location, repeat, ctrlKey, shiftKey, altKey, metaKey, bubbles: true, cancelable: true };
    // a shortcut the catalog handled (⌘K) must not also do what the browser does with it
    if (!frame.dispatchEvent(new KeyboardEvent('keydown', copy))) e.preventDefault();
  };
  // the catalog's handlers only need to know the reader acted, as on its own page
  const point = (e: Event) => frame.dispatchEvent(new Event(e.type, { bubbles: true }));
  // on the window, after the page's own handlers on its elements and document, which may take the key
  view.addEventListener('keydown', forward);
  // in the capture phase: a page that stops one on its way up still had the reader act
  for (const type of POINTER_EVENTS) view.addEventListener(type, point, { capture: true, passive: true });
  return () => {
    view.removeEventListener('keydown', forward);
    for (const type of POINTER_EVENTS) view.removeEventListener(type, point, { capture: true });
  };
}
