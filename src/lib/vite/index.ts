import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { normalizePath, type Plugin } from 'vite';
import type { CatalogGroup } from '../types.js';
import { discoverGroups, listCatalog } from './discover.js';
import { transformZukan } from './extract.js';
import { renderHtml } from './html.js';
import { SVELTE_STYLE_ID, createMatchers } from './matchers.js';
import { appFile, extendFsAllow, isInside, libDir, resolveOptions, type ZukanOptions } from './options.js';
import { CATALOG, ENTRY, generateCatalogModule, generateEntryModule } from './virtual.js';

export type { ZukanOptions };

const ENTRY_SRC = '/@id/__x00__' + ENTRY;

export function zukan(options: ZukanOptions = {}): Plugin {
  const { catalogId, isCatalogId, isCatalogFile, isDocFile, docFileOf, catalogFileOf } = createMatchers(
    options.suffix ?? 'zukan'
  );
  let groups: CatalogGroup[] = [];
  let resolved: ReturnType<typeof resolveOptions>;
  const scanned = () => groups.flatMap((g) => g.dirs);

  return {
    name: 'vite-plugin-svelte-zukan',
    enforce: 'pre',
    config(config) {
      const root = normalizePath(resolve(config.root ?? process.cwd()));
      groups = discoverGroups(root, options.groups);
      const allow = extendFsAllow(root, [...scanned(), libDir], config.server?.fs?.allow);
      // mutated rather than returned: returned arrays are concatenated to the user's `allow`
      if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
    },
    configResolved(config) {
      resolved = resolveOptions(config.root, options);
    },
    resolveId(id) {
      if (id === ENTRY || id === CATALOG) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + CATALOG) return generateCatalogModule(listCatalog(groups, resolved.suffix));
      if (id === '\0' + ENTRY) return generateEntryModule({ appFile: appFile('App.svelte'), ...resolved });
    },
    configureServer(server) {
      const { root, base, logger } = server.config;
      const outside = scanned().filter((dir) => !isInside(dir, normalizePath(root)));
      if (outside.length) server.watcher.add(outside);

      // called directly (not in a returned hook) to run before SvelteKit's middleware
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const path = url.split(/[?#]/)[0];
        if (path === `${base}__zukan`) {
          res.statusCode = 302;
          res.setHeader('location', `${path}/${url.slice(path.length)}`);
          return res.end();
        }
        if (path !== `${base}__zukan/`) return next();
        const icon = readFileSync(appFile('icon.svg'), 'utf-8');
        const html = renderHtml({ title: resolved.title, locale: resolved.locale, entrySrc: ENTRY_SRC, icon });
        server
          .transformIndexHtml(path, html)
          .then((out) => {
            res.setHeader('content-type', 'text/html');
            res.end(out);
          })
          .catch(next);
      });

      const printUrls = server.printUrls;
      server.printUrls = () => {
        printUrls();
        const local = server.resolvedUrls?.local[0];
        if (local) logger.info(`  ➜  zukan:   ${local}__zukan/`);
      };
    },
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
      } else if (isCatalogFile(file) && scanned().some((dir) => isInside(normalizePath(file), dir))) {
        // created or deleted: the list is rebuilt when the module is loaded again
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = list ? [list] : [];
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      // not `full-reload`: that would also reload the app's tabs on the same dev server
      this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
      return [];
    }
  };
}
