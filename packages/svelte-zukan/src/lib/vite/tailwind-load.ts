import { createHash } from 'node:crypto';
import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizePath } from 'vite';
import type { TailwindSource } from '../types.js';
import { extractTokens, rootVariables, type DesignSystemLike } from './tailwind-tokens.js';

/** `@tailwindcss/node`'s resolver shape; `base` is a directory */
export type Resolver = (id: string, base: string) => Promise<string | false | undefined>;

const MIN_VERSION = '4.1.0';
// the extensions `@tailwindcss/node` tries for a `@plugin` or `@config` id
const JS_EXTENSIONS = ['.js', '.json', '.node', '.ts'];

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
// `@reference` is a different at-rule, so it never matches
const importIds = (css: string, url = true) =>
  [...stripComments(css).matchAll(url ? /@import\s+(?:url\(\s*)?(['"])(.+?)\1/g : /@import\s+(['"])(.+?)\1/g)].map(
    (m) => m[2]
  );
const isTailwindId = (id: string) => id === 'tailwindcss' || id.startsWith('tailwindcss/');
// like Tailwind's resolver, which tries the id as written, then with each extension
const resolveFallback = (base: string, id: string, extensions = ['.css']) => {
  const file = path.resolve(base, id);
  return existsSync(file) ? file : (extensions.map((ext) => file + ext).find((f) => existsSync(f)) ?? file);
};
const importsTailwind = (css: string) => importIds(css).some(isTailwindId);
export const isCandidate = (css: string) => importsTailwind(css) || /@theme\b/.test(stripComments(css));

function cssFiles(dirs: string[]): string[] {
  const found = new Set<string>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of globSync('**/*.css', { cwd: dir, exclude: ['**/node_modules/**'] })) {
      found.add(normalizePath(path.join(dir, file)));
    }
  }
  return [...found].sort();
}

function readCandidates(dirs: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of cssFiles(dirs)) {
    let css: string;
    try {
      css = readFileSync(file, 'utf8');
    } catch {
      // the glob also returns dangling symlinks and directories named `*.css`
      continue;
    }
    if (isCandidate(css)) out.set(file, css);
  }
  return out;
}

/** the CSS files that `@import "tailwindcss"` or declare `@theme`, minus those another of them imports */
export async function findTailwindEntries(dirs: string[], resolveCss: Resolver): Promise<string[]> {
  const candidates = readCandidates(dirs);
  // Vite's resolver answers with real paths, while the glob keeps a symlinked root or `groups` directory as given
  const real = (file: string) => {
    try {
      return normalizePath(realpathSync(file));
    } catch {
      return normalizePath(file);
    }
  };
  // a file reached through two scanned paths (a directory and a symlink to it) is one file, listed once
  const byReal = new Map<string, string>();
  for (const file of candidates.keys()) if (!byReal.has(real(file))) byReal.set(real(file), file);
  const partials = new Set<string>();
  // a plain CSS file between them (`app.css` -> `base.css` -> `theme.css`) still makes the last one a partial
  const follow = async (file: string, css: string, from: string, seen: Set<string>) => {
    const base = path.dirname(file);
    // Tailwind inlines `@import "x"` only, never `@import url(x)`
    for (const id of importIds(css, false)) {
      if (isTailwindId(id)) continue;
      const resolved = real((await resolveCss(id, base).catch(() => undefined)) || resolveFallback(base, id));
      const target = byReal.get(resolved);
      if (target) {
        if (target !== from) partials.add(target);
      } else if (!seen.has(resolved) && resolved.endsWith('.css') && !resolved.includes('/node_modules/')) {
        seen.add(resolved);
        let plain: string;
        try {
          plain = readFileSync(resolved, 'utf8');
        } catch {
          continue;
        }
        await follow(resolved, plain, from, seen);
      }
    }
  };
  for (const file of byReal.values()) await follow(file, candidates.get(file)!, file, new Set());
  return [...byReal.values()].filter((file) => !partials.has(file));
}

/**
 * The packages export no `./package.json`, so look for the directory by hand. Only the `node_modules` of `from` and
 * its ancestors count: NODE_PATH and the global folders would find a Tailwind the app does not build with.
 */
export function findPackage(name: string, from: string): string | null {
  for (let dir = path.resolve(from); ; dir = path.dirname(dir)) {
    const manifest = path.join(dir, 'node_modules', name, 'package.json');
    if (existsSync(manifest)) return realpathSync(path.dirname(manifest));
    if (path.dirname(dir) === dir) return null;
  }
}

const NODE_HOSTS = ['@tailwindcss/vite', '@tailwindcss/postcss', '@tailwindcss/cli'];

function findNodeDir(dir: string): string | null {
  const direct = findPackage('@tailwindcss/node', dir);
  if (direct) return direct;
  // pnpm does not hoist it: it sits next to the plugin that uses it
  for (const host of NODE_HOSTS) {
    const hostDir = findPackage(host, dir);
    const nested = hostDir && findPackage('@tailwindcss/node', hostDir);
    if (nested) return nested;
  }
  return null;
}

const major = (version: string) => Number(version.split('.')[0]);

/**
 * The project's own `@tailwindcss/node` and the `tailwindcss` it depends on, looked up from each directory in turn.
 * Null when there is none, or Tailwind is older than v4.
 */
export function resolveTailwindNode(from: string[]): { node: string; tailwind: string; version: string } | null {
  for (const dir of from) {
    const nodeDir = findNodeDir(dir);
    const tailwindDir = nodeDir && findPackage('tailwindcss', nodeDir);
    if (!nodeDir || !tailwindDir) continue;
    try {
      const { version } = JSON.parse(readFileSync(path.join(tailwindDir, 'package.json'), 'utf8')) as {
        version: string;
      };
      if (!(major(version) >= 4)) continue;
      return {
        node: createRequire(path.join(nodeDir, 'package.json')).resolve('@tailwindcss/node'),
        tailwind: createRequire(path.join(tailwindDir, 'package.json')).resolve('tailwindcss'),
        version
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** the entry-module check: no resolver, so a partial counts as an entry too */
export function hasTailwind(dirs: string[], root: string): boolean {
  return [...readCandidates(dirs).keys()].some((file) => resolveTailwindNode([path.dirname(file), root]));
}

function tooOld(version: string): boolean {
  const [a, b, c] = version.split(/[.-]/).map(Number);
  const [x, y, z] = MIN_VERSION.split('.').map(Number);
  return a === x && (b < y || (b === y && c < z));
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Absolute paths in `message` (POSIX, drive-letter or `file:` form), relative to `root`. Quoted paths and the root
 * itself match through spaces, which the generic pass cannot tell from the end of a path.
 */
function relativize(message: string, root: string): string {
  const relative = (absolute: string) => {
    const lib = /^[A-Za-z]:/.test(absolute) ? path.win32 : path.posix;
    const rel = lib.relative(root, absolute);
    // another drive, or a Windows path seen from POSIX: keep the file name only
    return lib.isAbsolute(rel) ? lib.basename(absolute) : normalizePath(rel) || '.';
  };
  const withTrailing = (match: string) => {
    const trailing = /[.,;)\]]*$/.exec(match)![0];
    return relative(match.slice(0, match.length - trailing.length)) + trailing;
  };
  const roots = [...new Set([root, normalizePath(root)])].map(escapeRegExp).join('|');
  const start = String.raw`(?<![\w.:/\\-])`;
  const rest = String.raw`[^\s'"\`<>|?*:]*`;
  return message
    .replace(/file:\/\/\/?[^\s'"`<>]*/g, (url) => {
      try {
        return fileURLToPath(url);
      } catch {
        return url;
      }
    })
    .replace(
      /(['"`])((?:[A-Za-z]:[\\/]|\/)[^'"`\r\n]*)\1/g,
      (_, quote: string, quoted: string) => quote + relative(quoted) + quote
    )
    .replace(new RegExp(`${start}(?:${roots})${rest}`, 'g'), withTrailing)
    .replace(new RegExp(`${start}(?:[A-Za-z]:[\\\\/]|/)${rest}`, 'g'), withTrailing);
}

type Api = Record<string, unknown>;
// tailwindcss is CommonJS: a dynamic import has only `default`
const api = (mod: Api): Api => ({ ...((mod.default as Api | undefined) ?? {}), ...mod });
const importModule = async (file: string) => api((await import(/* @vite-ignore */ pathToFileURL(file).href)) as Api);

const hasFunctions = (target: unknown, names: string[]) =>
  names.every((name) => typeof (target as Api | undefined)?.[name] === 'function');

export async function loadTailwind(
  root: string,
  dirs: string[],
  resolvers: { css?: Resolver; js?: Resolver } = {}
): Promise<{ sources: TailwindSource[]; watch: string[] }> {
  const sources: TailwindSource[] = [];
  const watch = new Set<string>();
  const onDependency = (file: string) => void watch.add(normalizePath(file));

  for (const entry of await findTailwindEntries(dirs, resolvers.css ?? (async () => undefined))) {
    const found = resolveTailwindNode([path.dirname(entry), root]);
    if (!found) continue;
    const file = normalizePath(path.relative(root, entry));
    const failed: TailwindSource = {
      id: createHash('sha256').update(file).digest('hex').slice(0, 12),
      file,
      version: found.version,
      prefix: null,
      categories: [],
      variables: {},
      css: ''
    };
    onDependency(entry);
    try {
      sources.push(await loadEntry(entry, found, failed, resolvers, onDependency));
    } catch (e) {
      sources.push({ ...failed, error: relativize(e instanceof Error ? e.message : String(e), root) });
    }
  }
  return { sources, watch: [...watch] };
}

/** `css` and every stylesheet Tailwind inlines into it, except its own; one it cannot resolve fails the compile later */
async function inlined(
  css: string,
  base: string,
  resolve: (id: string, base: string) => Promise<string | false>,
  seen = new Set<string>()
): Promise<string[]> {
  const out = [css];
  for (const id of importIds(css, false)) {
    if (isTailwindId(id)) continue;
    const file = await resolve(id, base);
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let text: string;
    try {
      text = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    out.push(...(await inlined(text, path.dirname(file), resolve, seen)));
  }
  return out;
}

async function loadEntry(
  entry: string,
  found: { node: string; tailwind: string; version: string },
  empty: TailwindSource,
  resolvers: { css?: Resolver; js?: Resolver },
  onDependency: (file: string) => void
): Promise<TailwindSource> {
  const { version } = found;
  if (tooOld(version))
    throw new Error(`Tailwind CSS ${version} is older than ${MIN_VERSION}, the first version svelte-zukan supports`);

  const node = await importModule(found.node);
  const { compile, loadModule } = node as {
    compile: (css: string, options: object) => Promise<{ build(classes: string[]): string }>;
    loadModule: (
      id: string,
      base: string,
      onDependency: (file: string) => void,
      resolve?: Resolver
    ) => Promise<unknown>;
  };
  const loadDesignSystem = (await importModule(found.tailwind)).__unstable__loadDesignSystem as (
    css: string,
    options: object
  ) => Promise<DesignSystemLike>;
  const unsupported = `Tailwind CSS ${version} does not expose the design-system API svelte-zukan uses`;
  if (!hasFunctions(node, ['compile', 'loadModule']) || typeof loadDesignSystem !== 'function') {
    throw new Error(unsupported);
  }

  let resolveFile: ((base: string, id: string) => string | false) | undefined;
  const resolveStylesheet = async (id: string, from: string) => {
    const file = await resolvers.css?.(id, from);
    if (file) return file;
    // loaded here, from the project's copy: it is not a dependency of svelte-zukan
    resolveFile ??= (
      createRequire(found.node)('enhanced-resolve') as { create: { sync(options: object): typeof resolveFile } }
    ).create.sync({ extensions: ['.css'], mainFields: ['style'], conditionNames: ['style'] });
    try {
      return resolveFile!(from, id);
    } catch {
      return false;
    }
  };

  const base = path.dirname(entry);
  const source = readFileSync(entry, 'utf8');
  // Tailwind inlines every `@import` without deduplicating, so a second `tailwindcss` would double the preflight
  const tree = await inlined(source, base, resolveStylesheet);
  const css = tree.some((text) => importIds(text, false).some(isTailwindId))
    ? source
    : `@import "tailwindcss";\n${source}`;
  // an entry that imports only some of Tailwind's files, such as `tailwindcss/theme.css`, has tokens but no utility
  // layer, so its sample would style nothing
  const hasUtilities =
    css !== source ||
    tree.some(
      (text) =>
        importIds(text, false).some((id) => /^tailwindcss(\/(index|utilities)(\.css)?)?$/.test(id)) ||
        /@tailwind\s+utilities\b/.test(stripComments(text))
    );
  const sample = hasUtilities ? css : `${css}\n@import "tailwindcss/utilities.css" layer(utilities);`;

  const loadStylesheet = async (id: string, from: string) => {
    const file = await resolveStylesheet(id, from);
    if (!file) throw new Error(`Could not resolve '${id}' from '${from}'`);
    onDependency(file);
    return { path: file, base: path.dirname(file), content: await readFile(file, 'utf8') };
  };
  const load = async (id: string, from: string) => {
    try {
      const loaded = await loadModule(id, from, onDependency, resolvers.js);
      // `loadModule` reports the files of a relative id only, so an alias (`$lib/plugin.ts`) would not be watched
      const file = (loaded as { path?: unknown } | null)?.path;
      if (typeof file === 'string') onDependency(file);
      return loaded;
    } catch (e) {
      // and only once the import has succeeded, so a plugin that throws would not be watched either
      const file =
        (await resolvers.js?.(id, from).catch(() => undefined)) ||
        (id.startsWith('.') || path.isAbsolute(id) ? resolveFallback(from, id, JS_EXTENSIONS) : null);
      if (file) onDependency(file);
      throw e;
    }
  };

  const system = await loadDesignSystem(css, { base, loadStylesheet, loadModule: load });
  if (
    !hasFunctions(system.theme, ['entries']) ||
    !('prefix' in (system.theme ?? {})) ||
    !hasFunctions(system, ['getClassList', 'candidatesToCss'])
  ) {
    throw new Error(unsupported);
  }

  const compiled = await compile(sample, {
    base,
    onDependency,
    customCssResolver: resolvers.css,
    customJsResolver: resolvers.js
  });
  const defaults = await loadDesignSystem('@import "tailwindcss";', { base, loadStylesheet, loadModule: load });
  const { prefix, categories, variables, classes } = extractTokens(
    system,
    rootVariables(compiled.build([])),
    defaults.theme
  );
  return { ...empty, prefix, categories, variables, css: compiled.build(classes) };
}
