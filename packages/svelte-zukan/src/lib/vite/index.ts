import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { marked } from 'marked';
import { normalizePath, type Plugin } from 'vite';
import type { CatalogGroup } from '../types.js';
import { discoverGroups, listCatalog } from './discover.js';
import { extractSections, transformZukan } from './extract.js';
import { renderHtml } from './html.js';
import { detectSvelteKit } from './kit.js';
import { SVELTE_STYLE_ID, createMatchers } from './matchers.js';
import { appFile, extendFsAllow, isInside, libDir, resolveOptions, type ZukanOptions } from './options.js';
import { CATALOG, ENTRY, META, generateCatalogModule, generateEntryModule } from './virtual.js';

export type { ZukanOptions };

const ENTRY_SRC = '/@id/__x00__' + ENTRY;
/** where the static catalog puts its files: apart from the app's, so that their URLs can be made relative */
const OUT_PREFIX = '_zukan/';

export function zukan(options: ZukanOptions = {}): Plugin {
  const { catalogId, isCatalogId, isCatalogFile, isDocFile, docFileOf, catalogFileOf } = createMatchers(
    options.suffix ?? 'zukan'
  );
  let root = '';
  let groups: CatalogGroup[] = [];
  let resolved: ReturnType<typeof resolveOptions>;
  /** whether the user's config builds every environment (`builder`, or `vite build --app`) */
  let appBuilder = false;
  /** printed once in buildApp: Vite resolves the config again for every environment */
  let warning: string | null = null;
  const scanned = () => groups.flatMap((g) => g.dirs);

  return {
    name: 'vite-plugin-svelte-zukan',
    // 'pre' puts this plugin's buildApp (order: 'post') ahead of SvelteKit's adapter `finalise`, which rewrites a shared `experimental.renderBuiltUrl`
    enforce: 'pre',
    config: {
      // after the other plugins, so that a `builder` or a `renderBuiltUrl` they set is seen
      order: 'post',
      async handler(config, { command }) {
        root = normalizePath(resolve(config.root ?? process.cwd()));
        resolved = resolveOptions(root, options);
        groups = discoverGroups(root, options.groups);
        // the bundled logo is inside libDir
        const files = [resolved.wrapper, options.logo ? resolved.logo : null].filter((f) => f !== null);
        const allow = extendFsAllow(root, [...scanned(), libDir, ...files.map(dirname)], config.server?.fs?.allow);
        // mutated rather than returned: returned arrays are concatenated to the user's `allow`
        if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
        // `config.build.ssr` is the server half of an SSR build (`vite build --ssr`)
        if (command !== 'build' || !resolved.build || config.build?.ssr) return;
        // set here, not in configResolved: a define added there does not reach the build
        const kit = await detectSvelteKit(config.plugins ?? []);
        const out = resolved.build;
        const overlaps = (dir: string) => isInside(out, dir) || isInside(dir, out);
        const dirOf = (rel: string) => normalizePath(resolve(root, rel));
        // the catalog writes and removes index.html and _zukan/ in its outDir; the app's and Kit's outDirs are rewritten on every build
        if (isInside(root, out))
          throw new Error(
            `svelte-zukan: build.outDir of the catalog (${out}) must not be the Vite root (${root}) or contain it`
          );
        for (const [what, dir] of [
          ["the app's build.outDir", dirOf(config.build?.outDir ?? 'dist')],
          ...(kit ? [["SvelteKit's kit.outDir", dirOf(kit.api?.options?.outDir ?? '.svelte-kit')]] : [])
        ])
          if (overlaps(dir))
            throw new Error(`svelte-zukan: build.outDir of the catalog (${out}) must not overlap ${what} (${dir})`);
        // adapters usually empty `build/`, but their outDir can not be read from here
        warning =
          kit && overlaps(dirOf('build'))
            ? `svelte-zukan: build.outDir of the catalog (${out}) overlaps ${dirOf('build')}, which SvelteKit adapters usually empty after the catalog is written; set another one with \`build: { outDir }\``
            : null;
        appBuilder = !!config.builder;

        // relative, so that the catalog also works under a subpath; `base` can not be set per environment
        const renderBuiltUrl = config.experimental?.renderBuiltUrl;
        (config.experimental ??= {}).renderBuiltUrl = (filename, ctx) =>
          filename.startsWith(OUT_PREFIX) ? { relative: true } : renderBuiltUrl?.(filename, ctx);

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
                copyPublicDir: false,
                // only the JS entry, with fixed names: SvelteKit shares `base` and its naming rules with every environment
                rolldownOptions: {
                  input: { zukan: ENTRY },
                  output: {
                    entryFileNames: `${OUT_PREFIX}[name]-[hash].js`,
                    chunkFileNames: `${OUT_PREFIX}[name]-[hash].js`,
                    assetFileNames: `${OUT_PREFIX}[name]-[hash][extname]`
                  }
                }
              }
            }
          }
        };
      }
    },
    configEnvironment(name, config) {
      if (name !== 'zukan' || !config.build) return;
      // the environment starts from the app's top-level `build`; mutated, since a returned value would be merged into it
      // `emptyOutDir: false` also because Kit sets it for the whole build; buildApp removes only the catalog's own files
      Object.assign(config.build, { ssr: false, lib: false, emptyOutDir: false });
      config.build.rolldownOptions = { ...config.build.rolldownOptions, input: { zukan: ENTRY } };
    },
    buildApp: {
      // after the other hooks (e.g. SvelteKit's build), so that Vite's fallback below can be reproduced
      order: 'post',
      async handler(builder) {
        const env = builder.environments.zukan;
        if (!env || !resolved.build) return;
        if (warning) builder.config.logger.warn(warning);
        // Vite builds the app only when no hook built an environment, and this hook is about to build one
        const others = Object.values(builder.environments).filter((e) => e !== env);
        if (others.every((e) => !e.isBuilt)) {
          // without `builder`, `vite build` builds only the client (the catalog is not built with `--ssr`)
          const app = appBuilder ? others : [builder.environments.client!];
          for (const e of app) await builder.build(e);
        }
        if (builder.config.build.watch) {
          builder.config.logger.warn('svelte-zukan: the catalog is not built in watch mode');
          return;
        }

        // only what this plugin writes: the outDir may be shared with other files
        rmSync(join(resolved.build, OUT_PREFIX), { recursive: true, force: true });
        rmSync(join(resolved.build, 'index.html'), { force: true });
        const out = await builder.build(env);
        const entry = (Array.isArray(out) ? out : [out])
          .flatMap((o) => ('output' in o ? o.output : []))
          .find((c) => c.type === 'chunk' && c.name === 'zukan');
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
        const kitDir = join(resolved.build, '_app');
        rmSync(join(kitDir, 'version.json'), { force: true });
        if (existsSync(kitDir) && readdirSync(kitDir).length === 0) rmSync(kitDir, { recursive: true });
      }
    },
    resolveId(id) {
      if (id === ENTRY || id === CATALOG || id.startsWith(META)) return '\0' + id;
    },
    load(id) {
      if (id.startsWith('\0' + META)) {
        const raw = id.slice(META.length + 1);
        // the dev server may already have decoded part of the id (e.g. `%20`)
        let path = raw;
        try {
          path = decodeURIComponent(raw);
        } catch {
          // keep the raw id
        }
        // listed again on every load, so that files added after the start are found
        const item = listCatalog(groups, resolved.suffix).find((i) => i.path === path);
        if (!item) throw new Error(`svelte-zukan: no catalog file for ID "${path}"`);
        this.addWatchFile(item.file);
        const docPath = docFileOf(item.file);
        let doc: string | null = null;
        if (existsSync(docPath)) {
          this.addWatchFile(docPath);
          doc = marked.parse(readFileSync(docPath, 'utf-8'), { async: false });
        }
        const sections = extractSections(readFileSync(item.file, 'utf-8'), item.file);
        return `export default ${JSON.stringify({ sections, doc })};\n`;
      }
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
        // created or deleted: the list is rebuilt when the module is loaded again, and Vite does not
        // invalidate the file's own module on add or unlink, so a re-created file would keep its old transform
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = list ? [...modules, list] : modules;
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      // not `full-reload`: that would also reload the app's tabs on the same dev server
      this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
      return [];
    }
  };
}
