import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { marked } from 'marked';
import { normalizePath, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import type { CatalogGroup, CatalogItem } from '../types.js';
import { discoverGroups, listCatalog, listUncataloged } from './discover.js';
import { catalogJson } from './catalog-json.js';
import { extractSections } from './extract.js';
import { extractProps } from './props.js';
import { renderHtml } from './html.js';
import { detectSvelteKit } from './kit.js';
import { createMatchers } from './matchers.js';
import { appFile, extendFsAllow, isInside, libDir, resolveOptions, type ZukanOptions } from './options.js';
import { AXE, CATALOG, ENTRY, META, generateCatalogModule, generateEntryModule, pathOfMeta } from './virtual.js';

export type { ZukanOptions };

const ENTRY_SRC = '/@id/__x00__' + ENTRY;
/** where the static catalog puts its files: apart from the app's, so that their URLs can be made relative */
const OUT_PREFIX = '_zukan/';
/** the catalog as data, next to index.html: `/__zukan/catalog.json` in dev */
const CATALOG_JSON = 'catalog.json';
/** the types of what the catalog build writes; anything else is served as octet-stream, which browsers refuse for module scripts */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.json': 'application/json'
};

/** Vite adds these to its own responses; the catalog's responses are the same pages */
const setHeaders = (res: ServerResponse, headers: OutgoingHttpHeaders | undefined) => {
  for (const [name, value] of Object.entries(headers ?? {})) if (value !== undefined) res.setHeader(name, value);
};

const printCatalogUrl = (server: ViteDevServer | PreviewServer) => {
  const printUrls = server.printUrls;
  server.printUrls = () => {
    printUrls();
    const local = server.resolvedUrls?.local[0];
    if (local) server.config.logger.info(`  ➜  zukan:   ${local}__zukan/`);
  };
};

export function zukan(options: ZukanOptions = {}): Plugin {
  const { isCatalogFile, isDocFile, docFileOf, componentFileOf } = createMatchers(options.suffix ?? 'zukan');
  /** component file → its props as last served, to tell a props change from any other edit */
  const servedProps = new Map<string, string>();
  let root = '';
  let groups: CatalogGroup[] = [];
  let resolved: ReturnType<typeof resolveOptions>;
  /** whether the user's config builds every environment (`builder`, or `vite build --app`) */
  let appBuilder = false;
  /** where SvelteKit writes version.json into every client environment, the catalog's included */
  let kitAppDir: string | null = null;
  /** `vite dev`: the catalog may then carry absolute paths, to open files in an editor */
  let serving = false;
  /** printed once in buildApp: Vite resolves the config again for every environment */
  let warning: string | null = null;
  /** path → item, from the last listing; dropped when a catalog file is created or deleted */
  let items: Map<string, CatalogItem> | null = null;
  const scanned = () => groups.flatMap((g) => g.dirs);
  const uncataloged = (all: CatalogItem[]) =>
    listUncataloged(groups, resolved.suffix, new Set(all.map((i) => normalizePath(componentFileOf(i.file)))));
  const catalogData = () => {
    const items = relist();
    return catalogJson({
      root,
      title: resolved.title,
      items,
      uncataloged: uncataloged(items),
      docFileOf,
      componentFileOf
    });
  };
  const relist = () => {
    const all = listCatalog(groups, resolved.suffix);
    items = new Map(all.map((i) => [i.path, i]));
    return all;
  };

  return {
    name: 'vite-plugin-svelte-zukan',
    // 'pre' puts this plugin's buildApp (order: 'post') ahead of SvelteKit's adapter `finalise`, which rewrites a shared `experimental.renderBuiltUrl`
    enforce: 'pre',
    config: {
      // after the other plugins, so that a `builder` or a `renderBuiltUrl` they set is seen
      order: 'post',
      async handler(config, { command }) {
        serving = command === 'serve';
        kitAppDir = null;
        items = null;
        root = normalizePath(resolve(config.root ?? process.cwd()));
        resolved = resolveOptions(root, options);
        groups = discoverGroups(root, options.groups);
        // the wrapper's directory, for CSS and assets imported next to it; the logo is one file (the bundled one is inside libDir)
        const extra = [
          ...(resolved.wrapper ? [dirname(resolved.wrapper)] : []),
          ...(options.logo && resolved.logo ? [resolved.logo] : [])
        ];
        const allow = extendFsAllow(root, [...scanned(), libDir, ...extra], config.server?.fs?.allow);
        // mutated rather than returned: returned arrays are concatenated to the user's `allow`
        if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
        // `config.build.ssr` is the server half of an SSR build (`vite build --ssr`)
        if (command !== 'build' || !resolved.build || config.build?.ssr) return;
        // set here, not in configResolved: a define added there does not reach the build
        const kit = await detectSvelteKit(config.plugins ?? []);
        kitAppDir = kit ? ((kit.api?.options as { appDir?: string } | undefined)?.appDir ?? '_app') : null;
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
      // `cssCodeSplit`: index.html is written without Vite's HTML transform, which is the only thing that links merged CSS
      // `cssTarget`: lowered `light-dark()` follows prefers-color-scheme, not the theme the catalog sets on each preview
      // `chunkSizeWarningLimit`: axe-core (about 650 kB) is one chunk, loaded only when an accessibility check runs
      Object.assign(config.build, {
        ssr: false,
        lib: false,
        emptyOutDir: false,
        cssCodeSplit: true,
        cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'],
        chunkSizeWarningLimit: 1000
      });
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
        rmSync(join(resolved.build, CATALOG_JSON), { force: true });
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
        writeFileSync(join(resolved.build, CATALOG_JSON), JSON.stringify(catalogData(), null, 2) + '\n');
        if (kitAppDir) {
          const kitDir = join(resolved.build, kitAppDir);
          rmSync(join(kitDir, 'version.json'), { force: true });
          if (existsSync(kitDir) && readdirSync(kitDir).length === 0) rmSync(kitDir, { recursive: true });
        }
      }
    },
    resolveId(id) {
      if (id === ENTRY || id === CATALOG || id === AXE || id.startsWith(META)) return '\0' + id;
    },
    load(id) {
      if (id.startsWith('\0' + META)) {
        const raw = id.slice(META.length + 1);
        const path = pathOfMeta(raw);
        // a miss lists again, so that files added after the last listing are found
        const item = path === null ? undefined : (items?.get(path) ?? (relist(), items!.get(path)));
        if (!item) throw new Error(`svelte-zukan: no catalog file for ID "${path ?? raw}"`);
        this.addWatchFile(item.file);
        const docPath = docFileOf(item.file);
        let doc: string | null = null;
        if (existsSync(docPath)) {
          this.addWatchFile(docPath);
          doc = marked.parse(readFileSync(docPath, 'utf-8'), { async: false });
        }
        const sections = extractSections(readFileSync(item.file, 'utf-8'), item.file);
        const component = componentFileOf(item.file);
        let found = null;
        if (existsSync(component)) {
          this.addWatchFile(component);
          found = extractProps(readFileSync(component, 'utf-8'), component);
          servedProps.set(normalizePath(component), JSON.stringify(found));
        }
        const meta = { sections, doc, props: found?.props ?? null, propsType: found?.typeName ?? null };
        return `export default ${JSON.stringify(meta)};\n`;
      }
      if (id === '\0' + CATALOG) {
        const items = relist();
        // relative, like the rest of the static build
        const rel = uncataloged(items).map((u) => ({ group: u.group, file: normalizePath(relative(root, u.file)) }));
        const edit = serving
          ? (file: string) => {
              const component = componentFileOf(file);
              return { file, component: existsSync(component) ? normalizePath(component) : null };
            }
          : undefined;
        return generateCatalogModule(items, rel, edit);
      }
      // read from this package's own dependency, so the catalog's client never imports a CommonJS module
      if (id === '\0' + AXE) {
        const read = (file: string) =>
          readFileSync(createRequire(import.meta.url).resolve(`axe-core/${file}`), 'utf-8');
        // axe's own translation, so its messages follow the catalog's `locale`
        const locale =
          resolved.locale === 'en' ? '' : `\naxe.configure({ locale: ${read(`locales/${resolved.locale}.json`)} });`;
        return `export default ${JSON.stringify(read('axe.min.js') + locale)};\n`;
      }
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
      const { root, base } = server.config;
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
        if (path === `${base}__zukan/${CATALOG_JSON}`) {
          setHeaders(res, server.config.server.headers);
          res.setHeader('content-type', CONTENT_TYPES['.json']);
          return res.end(JSON.stringify(catalogData(), null, 2));
        }
        if (path !== `${base}__zukan/`) return next();
        const icon = readFileSync(appFile('icon.svg'), 'utf-8');
        const html = renderHtml({ title: resolved.title, locale: resolved.locale, entrySrc: ENTRY_SRC, icon });
        server
          .transformIndexHtml(path, html)
          .then((out) => {
            setHeaders(res, server.config.server.headers);
            res.setHeader('content-type', 'text/html');
            res.end(out);
          })
          .catch(next);
      });

      printCatalogUrl(server);
    },
    configurePreviewServer(server) {
      const out = resolved.build;
      if (!out) return;
      const { base } = server.config;
      const prefix = `${base}__zukan/`;
      // called directly (not in a returned hook) to run before SvelteKit's preview middleware
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const url = req.url ?? '';
        const path = url.split(/[?#]/)[0];
        if (path === `${base}__zukan`) {
          res.statusCode = 302;
          res.setHeader('location', `${prefix}${url.slice(path.length)}`);
          return res.end();
        }
        if (!path.startsWith(prefix)) return next();
        let rel: string;
        try {
          rel = decodeURIComponent(path.slice(prefix.length)) || 'index.html';
        } catch {
          return next();
        }
        const file = normalizePath(resolve(out, rel));
        if (!isInside(file, out) || !existsSync(file) || !statSync(file).isFile()) return next();
        setHeaders(res, server.config.preview.headers);
        res.setHeader('content-type', CONTENT_TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
      printCatalogUrl(server);
    },
    hotUpdate({ type, file, modules, timestamp }) {
      const { moduleGraph } = this.environment;
      // the metadata of an entry depends on its catalog file and its .md, which the component's module does not track
      const metas = () => [...moduleGraph.idToModuleMap.values()].filter((m) => m.id?.startsWith('\0' + META));
      let targets: Iterable<(typeof modules)[number]>;
      if (isDocFile(file)) {
        targets = metas();
      } else if (type === 'update' && isCatalogFile(file)) {
        targets = [...modules, ...metas()];
      } else if (isCatalogFile(file) && scanned().some((dir) => isInside(normalizePath(file), dir))) {
        // created or deleted: the list is rebuilt when the module is loaded again, and Vite does not
        // invalidate the file's own module on add or unlink, so a re-created file would keep its old module;
        // the lookup map would still serve a deleted file
        items = null;
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = [...modules, ...metas(), ...(list ? [list] : [])];
      } else if (
        type !== 'update' &&
        file.endsWith('.svelte') &&
        scanned().some((dir) => isInside(normalizePath(file), dir))
      ) {
        // a component created or deleted: only the list of files without a catalog file changes, and the app's own
        // handling of the file goes on
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        if (!list || this.environment.config.consumer !== 'client') return;
        moduleGraph.invalidateModule(list, new Set(), timestamp, true);
        this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
        return;
      } else if (type === 'update' && servedProps.has(normalizePath(file))) {
        // the component's own HMR updates the previews; only a change to its props changes the detail page
        const props = JSON.stringify(extractProps(readFileSync(file, 'utf-8'), file));
        if (props === servedProps.get(normalizePath(file)) || this.environment.config.consumer !== 'client') return;
        servedProps.set(normalizePath(file), props);
        for (const mod of metas()) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
        this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
        return;
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      // not `full-reload`: that would also reload the app's tabs on the same dev server
      this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
      return [];
    }
  };
}
