import type { CatalogItem } from '../types.js';

export const ENTRY = 'virtual:svelte-zukan/entry';
export const CATALOG = 'virtual:svelte-zukan/catalog';
export const META = 'virtual:svelte-zukan/meta/';

/** hex of the UTF-8 ID: the dev server's decodeURI leaves it alone, and it never ends like a file extension */
export const metaId = (path: string) => META + Buffer.from(path, 'utf8').toString('hex');
export const pathOfMeta = (hex: string) =>
  /^(?:[0-9a-f]{2})*$/.test(hex) ? Buffer.from(hex, 'hex').toString('utf8') : null;

export function generateCatalogModule(items: CatalogItem[]): string {
  // `file` is left out so that absolute paths do not end up in the static build
  const entries = items.map(
    ({ file, ...item }) =>
      `  { ...${JSON.stringify(item)}, load: () => import(${JSON.stringify(file)}), meta: () => import(${JSON.stringify(metaId(item.path))}) }`
  );
  return `export const catalog = [\n${entries.join(',\n')}\n];\n`;
}

export function generateEntryModule(opts: {
  appFile: string;
  logo: string | null;
  wrapper: string | null;
  title: string;
  locale: 'en' | 'ja';
  /** dirs relative to the Vite root, shown when the catalog is empty */
  searched: { group: string; dirs: string[] }[];
}): string {
  const s = JSON.stringify;
  // the listener comes first and the app and the list are imported lazily,
  // so that the tab recovers from an error in the list (e.g. a duplicate ID) on the next reload event
  return [
    `import { mount } from 'svelte';`,
    ...(opts.logo ? [`import logo from ${s(opts.logo + '?url')};`] : []),
    // a preview iframe is recreated when its catalog page reloads; any other page (a tab, an editor's iframe) reloads itself
    `if (import.meta.hot) import.meta.hot.on('zukan:reload', () => {`,
    `  let preview = false;`,
    `  try { preview = window !== parent && parent.location.pathname === location.pathname; } catch {}`,
    `  if (!preview) location.reload();`,
    `});`,
    `Promise.all([import(${s(opts.appFile)}), import(${s(CATALOG)})]).then(([{ default: App }, { catalog }]) =>`,
    `  mount(App, {`,
    `    target: document.body,`,
    `    props: {`,
    `      catalog,`,
    `      logo: ${opts.logo ? 'logo' : 'null'},`,
    `      wrapper: ${opts.wrapper ? `() => import(${s(opts.wrapper)})` : 'null'},`,
    `      title: ${s(opts.title)},`,
    `      locale: ${s(opts.locale)},`,
    `      searched: ${s(opts.searched)}`,
    `    }`,
    `  })`,
    `);`,
    ''
  ].join('\n');
}
