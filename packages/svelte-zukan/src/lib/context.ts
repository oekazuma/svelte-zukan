import { getContext, setContext } from 'svelte';

export const PREVIEW_SECTION_KEY = Symbol('zukan-preview-section');

export function setPreviewSection(title: string): void {
  setContext(PREVIEW_SECTION_KEY, title);
}

export function getPreviewSection(): string | undefined {
  return getContext<string | undefined>(PREVIEW_SECTION_KEY);
}
