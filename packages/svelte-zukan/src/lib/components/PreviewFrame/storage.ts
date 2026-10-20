export type Background = 'light' | 'dark';
export const BACKGROUNDS: Record<Background, string> = { light: '#fff', dark: '#0d1117' };

const BACKGROUND_KEY = 'svelte-zukan:background';
const widthKey = (src: string) => `svelte-zukan:width:${src}`;

// storage can throw (blocked site data, some private modes); the toolbar then just forgets
const tryStorage = <T>(fn: () => T, fallback: T) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** shared by every catalog tab, so a preview opened in its own tab gets it too */
export const readBackground = (): Background | null =>
  tryStorage(() => {
    const value = localStorage.getItem(BACKGROUND_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  }, null);

export const writeBackground = (value: Background) =>
  tryStorage(() => localStorage.setItem(BACKGROUND_KEY, value), undefined);

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
