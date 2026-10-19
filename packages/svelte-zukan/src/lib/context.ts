import { getContext, setContext } from 'svelte';

// a global symbol: in dev, Vite may prebundle `svelte-zukan` for the user's catalog files
// while the catalog app imports this file directly, so this module can exist twice
export const PREVIEW_SECTION_KEY = Symbol.for('svelte-zukan:preview-section');

export function setPreviewSection(title: string): void {
  setContext(PREVIEW_SECTION_KEY, title);
}

export function getPreviewSection(): string | undefined {
  return getContext<string | undefined>(PREVIEW_SECTION_KEY);
}
