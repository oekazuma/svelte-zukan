export type Theme = 'light' | 'dark';
/** the preview page's own background, under the app's CSS */
export const BACKGROUNDS: Record<Theme, string> = { light: '#fff', dark: '#0d1117' };
/** a computed color that paints nothing: `transparent`, or any color whose alpha is 0, such as `rgba(255, 255, 255, 0)` */
export const transparent = (color: string) =>
  color === 'transparent' || /^rgba\((?:[^,]+,){3}\s*0\)$/.test(color) || /\/\s*0\)$/.test(color);

/**
 * The page's own body color, when it has one and its html has none, for the whole page: an expanded preview is taller
 * than its content. Without either, the theme's color.
 */
export function paint(page: Document, theme: Theme) {
  const view = page.defaultView!;
  const html = page.documentElement;
  // the app's own html background, without the color set here last time
  html.style.backgroundColor = '';
  if (!transparent(view.getComputedStyle(html).backgroundColor)) return;
  const body = view.getComputedStyle(page.body).backgroundColor;
  html.style.backgroundColor = transparent(body) ? BACKGROUNDS[theme] : body;
}

const THEME_KEY = 'svelte-zukan:theme';
const widthKey = (src: string) => `svelte-zukan:width:${src}`;
const BACKGROUND_KEY = 'svelte-zukan:background';

export type Background = 'theme' | 'checker' | 'grid';
export const BACKGROUND_MODES: readonly Background[] = ['theme', 'checker', 'grid'];

// storage can throw (blocked site data, some private modes); the catalog then just forgets
const tryStorage = <T>(fn: () => T, fallback: T) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** shared by every catalog tab, so a preview opened in its own tab gets it too */
export const readTheme = (): Theme | null =>
  tryStorage(() => {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  }, null);

export const writeTheme = (value: Theme) => tryStorage(() => localStorage.setItem(THEME_KEY, value), undefined);

/** per tab: widths only need to survive the reload after an edit */
export const readWidth = (src: string): number | null =>
  tryStorage(() => {
    const value = Number(sessionStorage.getItem(widthKey(src)));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, null);

export const writeWidth = (src: string, value: number | null) =>
  tryStorage(
    () =>
      value === null ? sessionStorage.removeItem(widthKey(src)) : sessionStorage.setItem(widthKey(src), String(value)),
    undefined
  );

/** per tab, like widths, and shared by every frame: it is a way of looking, not a setting of one example */
export const readBackground = (): Background =>
  tryStorage(() => {
    const value = sessionStorage.getItem(BACKGROUND_KEY);
    return BACKGROUND_MODES.includes(value as Background) ? (value as Background) : 'theme';
  }, 'theme');

/** every frame on the page listens, so they all switch together; the event carries the value, as storage may throw */
const BACKGROUND_EVENT = 'svelte-zukan:background';

export const writeBackground = (value: Background) => {
  tryStorage(() => sessionStorage.setItem(BACKGROUND_KEY, value), undefined);
  dispatchEvent(new CustomEvent(BACKGROUND_EVENT, { detail: value }));
};

/** calls `fn` with each background written on this page; returns the function that stops it */
export const onBackground = (fn: (value: Background) => void) => {
  const listener = (e: Event) => fn((e as CustomEvent<Background>).detail);
  addEventListener(BACKGROUND_EVENT, listener);
  return () => removeEventListener(BACKGROUND_EVENT, listener);
};
