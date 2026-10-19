import type { CatalogItem } from '../types.js';

export const ENTRY = 'virtual:svelte-zukan/entry';
export const CATALOG = 'virtual:svelte-zukan/catalog';
export const META = 'virtual:svelte-zukan/meta/';

export function generateCatalogModule(items: CatalogItem[]): string {
  // `file` is left out so that absolute paths do not end up in the static build
  const entries = items.map(
    ({ file, ...item }) =>
      `  { ...${JSON.stringify(item)}, load: () => import(${JSON.stringify(file)}), meta: () => import(${JSON.stringify(META + encodeURIComponent(item.path))}) }`
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
    // preview iframes are recreated when the catalog page reloads; a preview opened in its own tab is the top window
    `if (import.meta.hot && window === window.top) import.meta.hot.on('zukan:reload', () => location.reload());`,
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
