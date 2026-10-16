import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { marked } from 'marked';
import { normalizePath, type Plugin } from 'vite';
import type { CatalogGroup } from '../types.js';
import { discoverGroups, listCatalog } from './discover.js';
import { transformZukan } from './extract.js';
import { renderHtml } from './html.js';
import { detectSvelteKit } from './kit.js';
import { SVELTE_STYLE_ID, createMatchers } from './matchers.js';
import { appFile, extendFsAllow, isInside, libDir, resolveOptions, type ZukanOptions } from './options.js';
import { CATALOG, ENTRY, generateCatalogModule, generateEntryModule } from './virtual.js';

export type { ZukanOptions };

const ENTRY_SRC = '/@id/__x00__' + ENTRY;

export function zukan(options: ZukanOptions = {}): Plugin {
  const { catalogId, isCatalogId, isCatalogFile, isDocFile, docFileOf, catalogFileOf } = createMatchers(
    options.suffix ?? 'zukan'
  );
  let root = '';
  let groups: CatalogGroup[] = [];
  let resolved: ReturnType<typeof resolveOptions>;
  /** whether the user's config builds every environment (`builder`, or `vite build --app`) */
  let appBuilder = false;
  const scanned = () => groups.flatMap((g) => g.dirs);

  return {
    name: 'vite-plugin-svelte-zukan',
    enforce: 'pre',
    async config(config, { command }) {
      root = normalizePath(resolve(config.root ?? process.cwd()));
      resolved = resolveOptions(root, options);
      groups = discoverGroups(root, options.groups);
      const allow = extendFsAllow(root, [...scanned(), libDir], config.server?.fs?.allow);
      // mutated rather than returned: returned arrays are concatenated to the user's `allow`
      if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
      if (command !== 'build' || !resolved.build) return;
      appBuilder = !!config.builder;

      // set here, not in configResolved: a define added there does not reach the build
      const kit = await detectSvelteKit(config.plugins ?? []);
      return {
        // without it, a plain `vite build` sets up only the app's environment
        builder: {},
        environments: {
          zukan: {
            consumer: 'client',
            // replacements SvelteKit defines only for its client environment, used by `$app/*`
            ...(kit && {
              define: {
                __SVELTEKIT_PAYLOAD__: 'undefined',
                __SVELTEKIT_HAS_SERVER_LOAD__: 'false',
                __SVELTEKIT_HAS_UNIVERSAL_LOAD__: 'false'
              }
            }),
            build: {
              outDir: resolved.build,
              manifest: false,
              // only the JS entry, with fixed names: SvelteKit shares `base` and its naming rules with every environment
              rolldownOptions: {
                input: { zukan: ENTRY },
                output: {
                  entryFileNames: 'assets/[name]-[hash].js',
                  chunkFileNames: 'assets/[name]-[hash].js',
                  assetFileNames: 'assets/[name]-[hash][extname]'
                }
              }
            }
          }
        }
      };
    },
    buildApp: {
      // after the other hooks (e.g. SvelteKit's build), so that Vite's fallback below can be reproduced
      order: 'post',
      async handler(builder) {
        const env = builder.environments.zukan;
        if (!env || !resolved.build) return;
        // Vite builds the app only when no hook built an environment, and this hook is about to build one
        const others = Object.values(builder.environments).filter((e) => e !== env);
        if (others.every((e) => !e.isBuilt)) {
          // without `builder`, `vite build` builds a single environment
          const app = appBuilder ? others : [builder.environments[builder.config.build.ssr ? 'ssr' : 'client']!];
          for (const e of app) await builder.build(e);
        }

        const out = await builder.build(env);
        const entry = (Array.isArray(out) ? out : [out])
          .flatMap((o) => ('output' in o ? o.output : []))
          .find((c) => c.type === 'chunk' && c.isEntry);
        if (!entry) throw new Error('svelte-zukan: the catalog entry was not built');
        const icon = readFileSync(appFile('icon.svg'), 'utf-8');
        const html = renderHtml({
          title: resolved.title,
          locale: resolved.locale,
          entrySrc: './' + entry.fileName,
          icon
        });
        writeFileSync(join(resolved.build, 'index.html'), html);
        // SvelteKit's plugins also write _app/version.json here
        rmSync(join(resolved.build, '_app'), { recursive: true, force: true });
      }
    },
    resolveId(id) {
      if (id === ENTRY || id === CATALOG) return '\0' + id;
    },
    load(id) {
      if (id === '\0' + CATALOG) return generateCatalogModule(listCatalog(groups, resolved.suffix));
      if (id === '\0' + ENTRY) {
        // relative, so that absolute paths do not end up in the static build
        const searched = groups.map((g) => ({
          group: g.name,
          dirs: g.dirs.map((dir) => normalizePath(relative(root, dir)) || '.')
        }));
        return generateEntryModule({ appFile: appFile('App.svelte'), ...resolved, searched });
      }
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
