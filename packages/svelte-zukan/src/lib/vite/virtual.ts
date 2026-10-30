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
  edit?: (file: string) => { file: string; component: string | null },
  /** why the catalog could not be listed, shown in place of the list */
  error: string | null = null
): string {
  // `file` is left out so that absolute paths do not end up in the static build
  const entries = items.map(
    ({ file, ...item }) =>
      `  { ...${JSON.stringify({ ...item, ...(edit && { edit: edit(file) }) })}, load: () => import(${JSON.stringify(file)}), meta: () => import(${JSON.stringify(metaId(item.path))}) }`
  );
  return (
    `export const catalog = [\n${entries.join(',\n')}\n];\n` +
    `export const uncataloged = ${JSON.stringify(uncataloged)};\n` +
    `export const error = ${JSON.stringify(error)};\n`
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
  /** the name of SvelteKit's dev global, as a JS string literal; set before the app's modules load */
  kitGlobal?: string;
}): string {
  const s = JSON.stringify;
  const imports = [
    [`import('svelte')`, '{ mount }'],
    [`import(${s(opts.appFile)})`, '{ default: App }'],
    [`import(${s(CATALOG)})`, '{ catalog, uncataloged, error }'],
    ...(opts.tailwind ? [[`import(${s(TAILWIND)})`, '{ tailwind }']] : [])
  ];
  // the module runs only once its static imports have loaded, and the key listener must be registered before the ones
  // that scripts injected into this page add (the Vite DevTools dock takes ⌘K in the capture phase of the window too),
  // so even `svelte` comes lazily. The logo stays static: Vite serves a public file's `?url` module only once it has
  // seen the import, and a dynamic one is requested before that. The app and the list come lazily, so that the tab
  // also recovers from an error in the list (e.g. a duplicate ID) on the next reload event
  return [
    // in the module, not an inline script, so that a `script-src 'self'` policy still allows it
    ...(opts.kitGlobal ? [`globalThis[${opts.kitGlobal}] = { env: {} };`] : []),
    ...(opts.logo
      ? [
          `import logo from ${s(opts.logo + '?url')};`,
          // the app may import the same module: an edit would then also propagate through this entry, and without an
          // accepting boundary here Vite would full-reload the app's tabs; zukan:reload reloads the catalog
          `if (import.meta.hot) import.meta.hot.accept(${s(opts.logo + '?url')}, () => {});`
        ]
      : []),
    `let app;`,
    `addEventListener('keydown', (e) => {`,
    `  if (app?.searchKey(e)) e.stopImmediatePropagation();`,
    `}, { capture: true });`,
    RELOAD_ON_PRELOAD_ERROR,
    // a preview iframe is recreated when its catalog page reloads; any other page (a tab, an editor's iframe) reloads itself
    `if (import.meta.hot) import.meta.hot.on('zukan:reload', () => {`,
    `  if (!inPreview()) location.reload();`,
    `});`,
    // a section that failed to render stays failed through its component's HMR update, as the failed boundary holds
    // no component to update; loading the page again renders it with the new module
    `if (import.meta.hot) import.meta.hot.on('vite:afterUpdate', () => {`,
    `  if (document.querySelector('[data-zukan-error]')) location.reload();`,
    `});`,
    `Promise.all([${imports.map(([i]) => i).join(', ')}]).then(([${imports.map(([, b]) => b).join(', ')}]) =>`,
    `  app = mount(App, {`,
    `    target: document.body,`,
    `    props: {`,
    `      catalog,`,
    `      uncataloged,`,
    `      listError: error,`,
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
