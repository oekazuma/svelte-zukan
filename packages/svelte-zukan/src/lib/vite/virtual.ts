import type { CatalogItem, TailwindSource } from '../types.js';

export const ENTRY = 'virtual:svelte-zukan/entry';
export const CATALOG = 'virtual:svelte-zukan/catalog';
export const META = 'virtual:svelte-zukan/meta/';
/** the source of axe-core as a string, injected into a preview page when its check runs */
export const AXE = 'virtual:svelte-zukan/axe';
/** the Tailwind CSS entries, each one's data and sample CSS in `TAILWIND_SOURCE + id`: JS strings, never a CSS import */
export const TAILWIND = 'virtual:svelte-zukan/tailwind';
export const TAILWIND_SOURCE = 'virtual:svelte-zukan/tailwind/';

/** hex of the UTF-8 ID: the dev server's decodeURI leaves it alone, and it never ends like a file extension */
export const metaId = (path: string) => META + Buffer.from(path, 'utf8').toString('hex');
export const pathOfMeta = (hex: string) =>
  /^(?:[0-9a-f]{2})*$/.test(hex) ? Buffer.from(hex, 'hex').toString('utf8') : null;

export function generateCatalogModule(
  items: CatalogItem[],
  uncataloged: { group: string; file: string }[] = [],
  /** the files to open in an editor, by absolute path: on the dev server only */
  edit?: (file: string) => { file: string; component: string | null }
): string {
  // `file` is left out so that absolute paths do not end up in the static build
  const entries = items.map(
    ({ file, ...item }) =>
      `  { ...${JSON.stringify({ ...item, ...(edit && { edit: edit(file) }) })}, load: () => import(${JSON.stringify(file)}), meta: () => import(${JSON.stringify(metaId(item.path))}) }`
  );
  return (
    `export const catalog = [\n${entries.join(',\n')}\n];\n` +
    `export const uncataloged = ${JSON.stringify(uncataloged)};\n`
  );
}

export function generateTailwindModule(sources: TailwindSource[]): string {
  const items = sources.map(
    ({ id, file, error }) =>
      `  { ...${JSON.stringify({ id, file, error: error ?? null })}, load: () => import(${JSON.stringify(TAILWIND_SOURCE + id)}) }`
  );
  return `export const tailwind = [\n${items.join(',\n')}\n];\n`;
}

/**
 * Part of the entry module, exported so that a test can run it in a page. A deploy deletes the previous build's
 * chunks, which a page loaded from a cached index.html still asks for; Vite's preload helper then fires
 * `vite:preloadError`, and the top catalog page reloads once.
 */
export const RELOAD_ON_PRELOAD_ERROR = [
  `const inPreview = () => {`,
  `  try { return window !== parent && parent.location.pathname === location.pathname; } catch { return false; }`,
  `};`,
  `window.addEventListener('vite:preloadError', (event) => {`,
  // without storage there is no guard against a reload loop, so the error shows instead
  `  try {`,
  `    if (Date.now() - Number(sessionStorage.getItem('svelte-zukan:reloaded')) < 10000) return;`,
  `    sessionStorage.setItem('svelte-zukan:reloaded', String(Date.now()));`,
  `  } catch { return; }`,
  // a prevented error resolves the import to undefined, which is only harmless when the page goes away
  `  event.preventDefault();`,
  `  (inPreview() ? parent : window).location.reload();`,
  `});`
].join('\n');

export function generateEntryModule(opts: {
  appFile: string;
  logo: string | null;
  wrapper: string | null;
  title: string;
  locale: 'en' | 'ja';
  theme?: 'light' | 'dark' | null;
  /** false leaves the Tailwind list out of the module graph, so the build gains no file */
  tailwind?: boolean;
  /** dirs relative to the Vite root, shown when the catalog is empty */
  searched: { group: string; dirs: string[] }[];
}): string {
  const s = JSON.stringify;
  // the listener comes first and the app and the list are imported lazily,
  // so that the tab recovers from an error in the list (e.g. a duplicate ID) on the next reload event
  return [
    `import { mount } from 'svelte';`,
    ...(opts.logo ? [`import logo from ${s(opts.logo + '?url')};`] : []),
    RELOAD_ON_PRELOAD_ERROR,
    // a preview iframe is recreated when its catalog page reloads; any other page (a tab, an editor's iframe) reloads itself
    `if (import.meta.hot) import.meta.hot.on('zukan:reload', () => {`,
    `  if (!inPreview()) location.reload();`,
    `});`,
    opts.tailwind
      ? `Promise.all([import(${s(opts.appFile)}), import(${s(CATALOG)}), import(${s(TAILWIND)})]).then(([{ default: App }, { catalog, uncataloged }, { tailwind }]) =>`
      : `Promise.all([import(${s(opts.appFile)}), import(${s(CATALOG)})]).then(([{ default: App }, { catalog, uncataloged }]) =>`,
    `  mount(App, {`,
    `    target: document.body,`,
    `    props: {`,
    `      catalog,`,
    `      uncataloged,`,
    opts.tailwind ? `      tailwind,` : `      tailwind: [],`,
    `      logo: ${opts.logo ? 'logo' : 'null'},`,
    `      wrapper: ${opts.wrapper ? `() => import(${s(opts.wrapper)})` : 'null'},`,
    `      title: ${s(opts.title)},`,
    `      locale: ${s(opts.locale)},`,
    `      fixedTheme: ${s(opts.theme ?? null)},`,
    `      searched: ${s(opts.searched)},`,
    `      axe: () => import(${s(AXE)}).then((m) => m.default)`,
    `    }`,
    `  })`,
    `);`,
    ''
  ].join('\n');
}
