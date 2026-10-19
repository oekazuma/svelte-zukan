// a global symbol: in dev, Vite may prebundle `svelte-zukan` for the user's catalog files
// while the catalog app imports this file directly, so this module can exist twice
export const PREVIEW_SECTION_KEY = Symbol.for('svelte-zukan:preview-section');
