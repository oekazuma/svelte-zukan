import { existsSync, readFileSync } from 'node:fs';
import { marked } from 'marked';
import { normalizePath, type Plugin } from 'vite';
import { transformZukan } from './extract.js';

export type ZukanOptions = {
  /** catalog file suffix: `Foo.<suffix>.svelte` / `Foo.<suffix>.md` (default 'zukan') */
  suffix?: string;
  /** group name -> directories to search (relative to the Vite root) */
  groups?: Record<string, string | string[]>;
  /** .svelte file wrapping every preview (relative to the Vite root) */
  wrapper?: string;
  /** logo image path (relative to the Vite root); false hides it */
  logo?: string | false;
  /** logo alt and <title> (default 'zukan') */
  title?: string;
  /** UI language (default 'en') */
  locale?: 'en' | 'ja';
  /** write the catalog as a static site on `vite build` (default false; outDir defaults to 'zukan-dist') */
  build?: boolean | { outDir?: string };
};

const SVELTE_STYLE_ID = /[?&]svelte&type=style/;

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createMatchers(suffix: string) {
  if (!/^[a-z0-9-]+$/i.test(suffix))
    throw new Error(`svelte-zukan: invalid suffix "${suffix}" (use letters, digits and "-")`);
  const ext = `.${suffix}.svelte`;
  const docExt = `.${suffix}.md`;
  const catalogId = new RegExp(`^[^?#]+\\.${escapeRegExp(suffix)}\\.svelte(?:[?#]|$)`);
  const isCatalogFile = (file: string) => file.endsWith(ext);
  return {
    catalogId,
    isCatalogId: (id: string) => catalogId.test(id) && !id.startsWith('\0') && !SVELTE_STYLE_ID.test(id),
    isCatalogFile,
    isDocFile: (file: string) => file.endsWith(docExt),
    docFileOf: (catalogFile: string) => catalogFile.slice(0, -ext.length) + docExt,
    catalogFileOf: (docFile: string) => docFile.slice(0, -docExt.length) + ext
  };
}

export function zukan(options: ZukanOptions = {}): Plugin {
  const { catalogId, isCatalogId, isCatalogFile, isDocFile, docFileOf, catalogFileOf } = createMatchers(
    options.suffix ?? 'zukan'
  );
  return {
    name: 'vite-plugin-svelte-zukan',
    enforce: 'pre',
    transform: {
      filter: { id: { include: catalogId, exclude: [/^\0/, SVELTE_STYLE_ID] } },
      handler(code, id) {
        if (!isCatalogId(id)) return;
        const filename = id.split(/[?#]/)[0];
        const docPath = docFileOf(filename);
        let doc: string | null = null;
        if (existsSync(docPath)) {
          this.addWatchFile(docPath);
          doc = marked.parse(readFileSync(docPath, 'utf-8'), { async: false });
        }
        return transformZukan(code, filename, doc);
      }
    },
    hotUpdate({ type, file, modules, timestamp }) {
      const { moduleGraph } = this.environment;
      let targets: Iterable<(typeof modules)[number]>;
      if (isDocFile(file)) {
        // the module graph is keyed by normalized paths; the catalog file may not be in it yet
        targets = moduleGraph.getModulesByFile(normalizePath(catalogFileOf(file))) ?? [];
      } else if (type === 'update' && isCatalogFile(file)) {
        targets = modules;
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    }
  };
}
