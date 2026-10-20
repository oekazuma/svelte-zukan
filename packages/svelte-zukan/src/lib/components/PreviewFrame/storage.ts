export type Theme = 'light' | 'dark';
/** the preview page's own background, under the app's CSS */
export const BACKGROUNDS: Record<Theme, string> = { light: '#fff', dark: '#0d1117' };

const THEME_KEY = 'svelte-zukan:theme';
const widthKey = (src: string) => `svelte-zukan:width:${src}`;

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
