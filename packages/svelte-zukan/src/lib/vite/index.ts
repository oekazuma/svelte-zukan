import { existsSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { dirname, extname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { marked } from 'marked';
import {
  createIdResolver,
  normalizePath,
  type Environment,
  type FSWatcher,
  type Plugin,
  type PreviewServer,
  type ResolvedConfig,
  type ViteDevServer
} from 'vite';
import type { CatalogGroup, CatalogItem, TailwindSource } from '../types.js';
import { discoverGroups, isComponentFile, listCatalog, listUncataloged } from './discover.js';
import { catalogJson } from './catalog-json.js';
import { extractSections } from './extract.js';
import { extractProps } from './props.js';
import { renderHtml } from './html.js';
import { detectSvelteKit } from './kit.js';
import { createMatchers } from './matchers.js';
import { appFile, extendFsAllow, isInside, libDir, resolveOptions, type ZukanOptions } from './options.js';
import { hasTailwind, isCandidate, loadTailwind, type Resolver } from './tailwind-load.js';
import {
  AXE,
  CATALOG,
  ENTRY,
  META,
  TAILWIND,
  TAILWIND_SOURCE,
  generateCatalogModule,
  generateEntryModule,
  generateTailwindModule,
  pathOfMeta
} from './virtual.js';

export type { ZukanOptions };

const ENTRY_SRC = '/@id/__x00__' + ENTRY;
/** where the static catalog puts its files: apart from the app's, so that their URLs can be made relative */
const OUT_PREFIX = '_zukan/';
/** the catalog as data, next to index.html: `/__zukan/catalog.json` in dev */
const CATALOG_JSON = 'catalog.json';
/** Node resolves symlinks, so a workspace link to this package does not count */
const installed = libDir.split('/').includes('node_modules');
/** the types of what the catalog build writes; anything else is served as octet-stream, which browsers refuse for module scripts */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.map': 'application/json'
};

/** Vite adds these to its own responses; the catalog's responses are the same pages */
const setHeaders = (res: ServerResponse, headers: OutgoingHttpHeaders | undefined) => {
  for (const [name, value] of Object.entries(headers ?? {})) if (value !== undefined) res.setHeader(name, value);
};

/**
 * Vite's resolver, wrapped like `@tailwindcss/vite` wraps it for `@tailwindcss/node`: aliases first, a relative result
 * made absolute, and only results that `accept` takes. Built from the environment's config on the first call.
 */
function viteResolver(
  env: () => Environment,
  options: (config: ResolvedConfig) => Parameters<typeof createIdResolver>[1],
  accept: (file: string) => boolean
): Resolver {
  let resolveId: ReturnType<typeof createIdResolver> | undefined;
  return async (id, base) => {
    const environment = env();
    resolveId ??= createIdResolver(environment.config, options(environment.config));
    const importer = join(base, '__placeholder__.ts');
    for (const aliasOnly of [true, false]) {
      let file = await resolveId(environment, id, importer, aliasOnly);
      if (!file || file === id) continue;
      if (file.startsWith('.')) file = resolve(base, file);
      if (accept(file) && isAbsolute(file)) return file;
    }
  };
}

const printCatalogUrl = (server: ViteDevServer | PreviewServer) => {
  const printUrls = server.printUrls;
  server.printUrls = () => {
    printUrls();
    // Vite prints the base as configured: SvelteKit's `paths.base` has no trailing slash
    const local = server.resolvedUrls?.local[0]?.replace(/\/?$/, '/');
    if (local) server.config.logger.info(`  ➜  zukan:   ${local}__zukan/`);
  };
};

export function zukan(options: ZukanOptions = {}): Plugin {
  const { isCatalogFile, isDocFile, docFileOf, componentFileOf } = createMatchers(options.suffix ?? 'zukan');
  /** component file → its props as last served, to tell a props change from any other edit */
  const servedProps = new Map<string, string>();
  /** a file a component's props type is imported from → the components that read it */
  const propsDeps = new Map<string, Set<string>>();
  const readProps = (component: string) => {
    for (const [dep, readers] of propsDeps) if (readers.delete(component) && !readers.size) propsDeps.delete(dep);
    // deleted or renamed since it was served; an edit of a file it imported its type from still arrives
    if (!existsSync(component)) {
      servedProps.delete(component);
      return null;
    }
    const found = extractProps(readFileSync(component, 'utf-8'), component);
    servedProps.set(component, JSON.stringify(found));
    for (const dep of found?.files ?? []) {
      if (!propsDeps.has(dep)) propsDeps.set(dep, new Set());
      propsDeps.get(dep)!.add(component);
    }
    // not `addWatchFile`: like Tailwind's dependencies, the file would become an import of the meta module, and an
    // edit of it would end in `full-reload`; the root is watched already
    const outside = (found?.files ?? []).filter((file) => !isInside(file, root));
    if (outside.length) watcher?.add(outside);
    return found;
  };
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
  // the watcher reports a file of a dir reached through a symlink (a `groups` dir under a `node_modules` link) by its
  // real path, and Vite's watcher ignores node_modules
  let realDirs: [real: string, dir: string][] = [];
  /** a path the watcher reports, as the scanned dir it lies in names it */
  const configuredPath = (file: string) => {
    for (const [real, dir] of realDirs) if (real !== dir && isInside(file, real)) return dir + file.slice(real.length);
    return file;
  };
  // the root's `src` too: a SvelteKit app keeps `src/app.css` while its groups often point at `src/lib`
  const cssDirs = () => [...new Set([...scanned(), ...(existsSync(`${root}/src`) ? [`${root}/src`] : [])])];
  /** generated on the first demand and cached until a watched file changes */
  let tailwind: Promise<{ sources: TailwindSource[]; watch: string[] }> | null = null;
  /** the files the last generation read */
  let tailwindWatch = new Set<string>();
  /** the sources as the catalog page last received them, to tell a change of the data from any other edit */
  let served: string | null = null;
  // Tailwind's dependencies are added to the dev server's watcher, not with `addWatchFile`: that would make each one an
  // import of the Tailwind modules, whose chain up to the entry accepts no update, so Vite would answer with `full-reload`
  let watcher: FSWatcher | null = null;
  /** the dev server's publicDir, '' without one or in the build */
  let publicDir = '';
  const generateTailwind = async (env: () => Environment) => {
    const css = viteResolver(
      env,
      (config) => ({
        ...config.resolve,
        extensions: ['.css'],
        mainFields: ['style'],
        conditions: ['style', 'development|production'],
        tryIndex: false,
        preferRelative: true
      }),
      (file) => file.endsWith('.css')
    );
    const js = viteResolver(
      env,
      (config) => config.resolve,
      (file) => !file.endsWith('.css')
    );
    const data = await loadTailwind(root, cssDirs(), { css, js });
    // Vite does not watch node_modules; a reinstall restarts the dev server anyway
    const watch = data.watch.filter((file) => !file.includes('/node_modules/'));
    tailwindWatch = new Set(watch);
    // the root is watched already
    const outside = watch.filter((file) => !isInside(file, root));
    if (outside.length) watcher?.add(outside);
    return { sources: data.sources, watch };
  };
  const tailwindData = (env: () => Environment) => {
    if (!tailwind) {
      const pending = generateTailwind(env);
      tailwind = pending;
      // a failed generation is not kept: the next demand tries again
      pending.catch(() => {
        if (tailwind === pending) tailwind = null;
      });
    }
    return tailwind;
  };
  const uncataloged = (all: CatalogItem[]) =>
    listUncataloged(groups, resolved.suffix, new Set(all.map((i) => normalizePath(componentFileOf(i.file)))));
  const catalogData = async (env: () => Environment) => {
    const items = relist();
    const { sources } = await tailwindData(env);
    return catalogJson({
      root,
      title: resolved.title,
      items,
      uncataloged: uncataloged(items),
      docFileOf,
      componentFileOf,
      tailwind: sources
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
        tailwind = null;
        tailwindWatch = new Set();
        served = null;
        root = normalizePath(resolve(config.root ?? process.cwd()));
        resolved = resolveOptions(root, options);
        groups = discoverGroups(root, options.groups);
        realDirs = scanned().map((dir) => [normalizePath(realpathSync(dir)), dir]);
        // the wrapper's directory, for CSS and assets imported next to it; the logo is one file (the bundled one is inside libDir)
        const extra = [
          ...(resolved.wrapper ? [dirname(resolved.wrapper)] : []),
          ...(options.logo && resolved.logo ? [resolved.logo] : [])
        ];
        const allow = extendFsAllow(root, [...scanned(), libDir, ...extra], config.server?.fs?.allow);
        // mutated rather than returned: returned arrays are concatenated to the user's `allow`
        if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
        // catalog files import `svelte-zukan` only behind the virtual modules, where the dep scan does not look: an
        // installed copy would be found on the first visit, re-optimized, and the page reloaded mid-load. A linked or
        // aliased copy (a workspace package, this repository's own app) is not prebundled and must stay that way
        const deps = config.optimizeDeps;
        if (installed && ![...(deps?.include ?? []), ...(deps?.exclude ?? [])].includes('svelte-zukan'))
          ((config.optimizeDeps ??= {}).include ??= []).push('svelte-zukan');
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
        // the app copies publicDir (SvelteKit's kit.files.assets) before the catalog is written
        const publicDir = config.publicDir === false ? null : dirOf(config.publicDir ?? 'public');
        if (publicDir && isInside(out, publicDir))
          throw new Error(
            `svelte-zukan: build.outDir of the catalog (${out}) must not be inside the app's publicDir (${publicDir}), which is copied before the catalog is written`
          );
        // adapters usually empty `build/`, but their outDir can not be read from here
        warning =
          kit && overlaps(dirOf('build'))
            ? `svelte-zukan: build.outDir of the catalog (${out}) overlaps ${dirOf('build')}, which SvelteKit adapters usually empty after the catalog is written; set another one with \`build: { outDir }\``
            : null;
        appBuilder = !!config.builder;

        // relative, so that the catalog also works under a subpath; `base` can not be set per environment
        const renderBuiltUrl = config.experimental?.renderBuiltUrl;
        (config.experimental ??= {}).renderBuiltUrl = (filename, ctx) => {
          if (filename.startsWith(OUT_PREFIX)) return { relative: true };
          // a Web Worker keeps the app's file name (`worker` options and Vite's worker bundles are shared by all
          // environments); generateBundle moves it under OUT_PREFIX
          if (ctx.type === 'asset' && ctx.hostType === 'js' && ctx.hostId.startsWith(OUT_PREFIX)) {
            const url = posix.relative(posix.dirname(ctx.hostId), OUT_PREFIX + filename);
            return { runtime: `new URL(${JSON.stringify('./' + url)}, import.meta.url).href` };
          }
          return renderBuiltUrl?.(filename, ctx);
        };

        return {
          // without it, a plain `vite build` sets up only the app's environment
          builder: {},
          environments: {
            zukan: {
              consumer: 'client',
              // replacements SvelteKit makes only in its client build, used by `$app/*`
              ...(kit && {
                define: {
                  // the page SvelteKit renders sets the payload; `$app/env/public` reads `env` from it on import.
                  // In dev it reads the global directly, which configureServer's HTML sets
                  __SVELTEKIT_PAYLOAD__: '({ env: {} })',
                  __SVELTEKIT_HAS_SERVER_LOAD__: 'false',
                  __SVELTEKIT_HAS_UNIVERSAL_LOAD__: 'false',
                  __SVELTEKIT_MANIFEST_ASSETS__: '[]',
                  __SVELTEKIT_MANIFEST_IMMUTABLE__: '[]',
                  __SVELTEKIT_MANIFEST_PRERENDERED__: '[]',
                  __SVELTEKIT_MANIFEST_ROUTES__: '[]'
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
    generateBundle: {
      // after Vite's worker plugin and SvelteKit, which emit files named for the app: workers are moved where
      // `renderBuiltUrl` points, and SvelteKit's version.json is not the catalog's
      order: 'post',
      handler(_, bundle) {
        if (this.environment.name !== 'zukan') return;
        const { base } = this.environment.config;
        const moved = Object.keys(bundle).filter((f) => bundle[f].type === 'asset' && !f.startsWith(OUT_PREFIX));
        for (const fileName of moved) {
          const file = bundle[fileName];
          delete bundle[fileName];
          if (file.type !== 'asset') continue;
          if (fileName === `${kitAppDir}/version.json`) continue;
          let { source } = file;
          // a worker names the assets it loads from the app's base, where the catalog has none; next to it, they move
          // with it (a worker resolves a relative URL against its own script)
          if (fileName.endsWith('.js') && !base.startsWith('.')) {
            let code = typeof source === 'string' ? source : new TextDecoder().decode(source);
            for (const other of moved) {
              const url = posix.relative(posix.dirname(fileName), other);
              code = code.replaceAll(base + other, url.startsWith('.') ? url : `./${url}`);
            }
            source = code;
          }
          this.emitFile({ type: 'asset', fileName: OUT_PREFIX + fileName, source });
        }
      }
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
          theme: resolved.theme,
          entrySrc: './' + entry.fileName,
          icon
        });
        writeFileSync(join(resolved.build, 'index.html'), html);
        const data = await catalogData(() => env);
        for (const source of data.tailwind ?? [])
          if (source.error)
            builder.config.logger.warn(`svelte-zukan: Tailwind CSS entry ${source.file}: ${source.error}`);
        writeFileSync(join(resolved.build, CATALOG_JSON), JSON.stringify(data, null, 2) + '\n');
      }
    },
    resolveId(id) {
      if ([ENTRY, CATALOG, AXE, TAILWIND].includes(id) || id.startsWith(META) || id.startsWith(TAILWIND_SOURCE))
        return '\0' + id;
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
        let sections: ReturnType<typeof extractSections> = [];
        let error: string | undefined;
        try {
          sections = extractSections(readFileSync(item.file, 'utf-8'), item.file);
        } catch (e) {
          // on the dev server a throw is a transform error, which Vite shows in an overlay on every tab, the app's too,
          // and which stays there after the fix, since that reloads only the catalog
          if (!serving) throw e;
          error = (e instanceof Error ? e.message : String(e)).replaceAll(root + '/', '');
        }
        const component = componentFileOf(item.file);
        let found = null;
        // not `addWatchFile`: the component would become an import of the meta module, and deleting it would end in
        // `full-reload`; `hotUpdate` compares its props itself, and the scanned directories are watched
        if (existsSync(component)) found = readProps(normalizePath(component));
        const meta = {
          sections,
          doc,
          props: found?.props ?? null,
          propsType: found?.typeName ?? null,
          ...(error !== undefined && { error })
        };
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
      if (id === '\0' + TAILWIND || id.startsWith('\0' + TAILWIND_SOURCE)) {
        return tailwindData(() => this.environment).then(({ sources }) => {
          if (id === '\0' + TAILWIND) {
            served = JSON.stringify(sources);
            return generateTailwindModule(sources);
          }
          const sourceId = id.slice(TAILWIND_SOURCE.length + 1);
          const source = sources.find((s) => s.id === sourceId);
          if (!source) throw new Error(`svelte-zukan: no Tailwind CSS entry for ID "${sourceId}"`);
          return `export default ${JSON.stringify(source)};\n`;
        });
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
        // by its file path, a logo in publicDir would be served under /public/, which Vite warns about on every request
        const { logo } = resolved;
        const inPublic = logo && publicDir && isInside(logo, publicDir);
        return generateEntryModule({
          appFile: appFile('App.svelte'),
          ...resolved,
          logo: inPublic ? '/' + normalizePath(relative(publicDir, logo)) : logo,
          searched,
          tailwind: hasTailwind(cssDirs(), root)
        });
      }
    },
    configureServer(server) {
      const { root, base } = server.config;
      watcher = server.watcher;
      publicDir = server.config.publicDir ? normalizePath(server.config.publicDir) : '';
      const realRoot = normalizePath(realpathSync(root));
      const outside = realDirs.map(([real]) => real).filter((dir) => !isInside(dir, realRoot));
      if (outside.length) server.watcher.add(outside);
      // SvelteKit's dev env module destructures `env` from this global on import, and only the page Kit renders sets
      // it; the build's `__SVELTEKIT_PAYLOAD__` define is the same payload. A JSON string, so it is a JS expression
      const kitGlobal = server.config.define?.__SVELTEKIT_GLOBAL_NAME__ as string | undefined;

      // called directly (not in a returned hook) to run before SvelteKit's middleware
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
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
          catalogData(() => server.environments.client)
            .then((data) => res.end(JSON.stringify(data, null, 2)))
            .catch(next);
          return;
        }
        if (path !== `${base}__zukan/`) return next();
        const icon = readFileSync(appFile('icon.svg'), 'utf-8');
        const html = renderHtml({
          title: resolved.title,
          locale: resolved.locale,
          theme: resolved.theme,
          entrySrc: ENTRY_SRC,
          icon,
          script: kitGlobal && `globalThis[${kitGlobal}] = { env: {} };`
        });
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
    hotUpdate({ type, file, modules, timestamp, read }) {
      const { moduleGraph } = this.environment;
      // the metadata of an entry depends on its catalog file and its .md, which the component's module does not track
      const metas = () => [...moduleGraph.idToModuleMap.values()].filter((m) => m.id?.startsWith('\0' + META));
      let targets: Iterable<(typeof modules)[number]>;
      const normalized = configuredPath(normalizePath(file));
      const inScanned = scanned().some((dir) => isInside(normalized, dir));
      // what the app imports too: the chain of imports through the catalog's own modules (the list, and a meta module
      // that watches the file) ends at the entry, which accepts no update, so Vite would answer with `full-reload` on
      // every tab
      const appModules = () =>
        modules.filter((m) => [...m.importers].some((i) => !i.id?.startsWith('\0virtual:svelte-zukan/')));
      const searchedCss = file.endsWith('.css') && cssDirs().some((dir) => isInside(normalized, dir));
      const watchedCss =
        tailwindWatch.has(normalized) || tailwindWatch.has(normalizePath(file)) || (searchedCss && type !== 'update');
      if (watchedCss || (searchedCss && type === 'update')) {
        // the other environments see the same file: one regeneration is enough
        if (this.environment.config.consumer !== 'client') return;
        const env = this.environment;
        // in the background, so that the app's own handling of the file (e.g. `@tailwindcss/vite`'s CSS update) is
        // neither delayed nor shown a failure of ours
        const regenerate = () => {
          tailwind = null;
          if (!moduleGraph.getModuleById('\0' + TAILWIND)) return;
          tailwindData(() => env)
            .then(({ sources }) => {
              const json = JSON.stringify(sources);
              if (json === served) return;
              served = json;
              for (const mod of moduleGraph.idToModuleMap.values())
                if (mod.id === '\0' + TAILWIND || mod.id?.startsWith('\0' + TAILWIND_SOURCE))
                  moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
              env.hot.send({ type: 'custom', event: 'zukan:reload' });
            })
            .catch((e) =>
              env.logger.warn(
                `svelte-zukan: could not read the Tailwind CSS entries: ${e instanceof Error ? e.message : e}`
              )
            );
        };
        if (watchedCss) regenerate();
        // a plain CSS file edited into an entry (`@theme` added) is not watched yet; `read()` waits for the editor to
        // finish writing, where reading the file at once could find it empty
        else
          Promise.resolve()
            .then(read)
            .then((css) => isCandidate(css) && regenerate())
            .catch(() => {});
        // undefined, never []
        return;
      }
      if (isDocFile(file) && inScanned) {
        targets = metas();
      } else if (type === 'update' && isCatalogFile(file) && inScanned) {
        targets = [...modules, ...metas()];
      } else if (isCatalogFile(file) && inScanned) {
        // created or deleted: the list is rebuilt when the module is loaded again, and Vite does not
        // invalidate the file's own module on add or unlink, so a re-created file would keep its old module;
        // the lookup map would still serve a deleted file
        items = null;
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = [...modules, ...metas(), ...(list ? [list] : [])];
      } else if (normalized === resolved.logo) {
        targets = modules;
      } else if (
        type !== 'update' &&
        file.endsWith('.svelte') &&
        scanned().some((dir) => isInside(normalized, dir) && isComponentFile(dir, normalized.slice(dir.length + 1)))
      ) {
        // a component created or deleted: the list of files without a catalog file changes, and so do the props of a
        // catalog file next to it; the app's own handling of the file goes on
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        if (!list || this.environment.config.consumer !== 'client') return;
        for (const mod of [list, ...metas()]) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
        this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
        return;
      } else if (servedProps.has(normalized) || propsDeps.has(normalized)) {
        // the component's own HMR updates the previews; only a change to its props changes the detail page. A props
        // type file counts when it is created or deleted too: the component may import one that is not there yet
        if (this.environment.config.consumer !== 'client') return;
        const changed = file.endsWith('.svelte') && servedProps.has(normalized) ? [normalized] : [];
        const affected = new Set([...changed, ...(propsDeps.get(normalized) ?? [])]);
        const before = [...affected].map((c) => servedProps.get(c));
        if ([...affected].every((c, i) => JSON.stringify(readProps(c)) === before[i])) return;
        for (const mod of metas()) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
        this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
        return;
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      // not `full-reload`: that would also reload the app's tabs on the same dev server
      this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
      return appModules();
    }
  };
}
