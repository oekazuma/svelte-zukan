import { existsSync, globSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { normalizePath, searchForWorkspaceRoot } from 'vite';
import type { CatalogGroup, CatalogItem } from '../types.js';

const checkGroupName = (name: string) => {
  if (name === 'preview' || name.startsWith('preview/'))
    throw new Error(
      `svelte-zukan: group name "${name}" is reserved ("preview" and "preview/..." are used by preview URLs)`
    );
};

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/**
 * Whether `file` exists under exactly this name. `existsSync` alone also finds `Button.Zukan.md` for `Button.zukan.md`
 * on macOS and Windows, where catalog files themselves are matched by case
 */
export const existsExactly = (file: string) => existsSync(file) && readdirSync(dirname(file)).includes(basename(file));

/** `rel`, a path relative to `root`, as the directories on disk spell it: macOS and Windows also find it in another case */
const spelledOnDisk = (root: string, rel: string) => {
  // on another drive
  if (isAbsolute(rel)) return rel;
  let dir = root;
  return rel
    .split('/')
    .map((name) => {
      if (name !== '..' && name !== '') {
        const names = readdirSync(dir);
        if (!names.includes(name)) name = names.find((n) => n.toLowerCase() === name.toLowerCase()) ?? name;
      }
      dir = join(dir, name);
      return name;
    })
    .join('/');
};

const readPackage = (dir: string): { name?: string; dependencies?: object; devDependencies?: object } => {
  const file = join(dir, 'package.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch (e) {
    throw new Error(`svelte-zukan: failed to parse ${normalizePath(file)}: ${(e as Error).message}`, { cause: e });
  }
};

export function discoverGroups(root: string, groups?: Record<string, string | string[]>): CatalogGroup[] {
  root = resolve(root);
  if (groups) {
    return Object.entries(groups).map(([name, dirs]) => {
      // an empty name would give IDs such as "/Button"
      if (!name.trim()) throw new Error('svelte-zukan: a group name in `groups` must not be empty');
      checkGroupName(name);
      if (![dirs].flat().length)
        throw new Error(`svelte-zukan: group "${name}" in \`groups\` needs at least one directory`);
      const seen = new Map<string, string>();
      for (const d of [dirs].flat()) {
        const abs = resolve(root, d);
        if (!isDir(abs))
          throw new Error(`svelte-zukan: directory not found for group "${name}": ${normalizePath(abs)}`);
        const written = normalizePath(relative(root, abs));
        const onDisk = spelledOnDisk(root, written);
        // the watcher reports the spelling on disk, which a dir written in another case never matches: no HMR
        if (onDisk !== written)
          throw new Error(
            `svelte-zukan: directory for group "${name}" is written "${written}", but is "${onDisk}" on disk; directories are matched by case`
          );
        const real = realpathSync(abs);
        if (!seen.has(real)) seen.set(real, normalizePath(abs));
      }
      return { name, dirs: [...seen.values()] };
    });
  }

  const pkg = readPackage(root);
  const found: { name: string; dir: string }[] = [{ name: pkg.name ?? basename(root), dir: root }];
  // several names may link to one package, or back to the app itself
  const scanned = new Set([realpathSync(root)]);
  const deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  const ws = searchForWorkspaceRoot(root);
  for (const dep of new Set(deps)) {
    // pnpm links workspace packages in the app's node_modules; npm, yarn and bun in the workspace root's
    const link = [join(root, 'node_modules', dep), join(ws, 'node_modules', dep)].find((l) => existsSync(l));
    if (!link) continue;
    const real = realpathSync(link);
    // installed packages live under node_modules; only workspace links resolve outside of it
    if (real.split(/[/\\]/).includes('node_modules') || scanned.has(real)) continue;
    const { name } = readPackage(real);
    // a workspace link to this library itself: its own catalog files are not the app's
    if (name === 'svelte-zukan') continue;
    scanned.add(real);
    found.push({ name: name ?? basename(real), dir: real });
  }
  return found.flatMap(({ name, dir }) => {
    const src = join(dir, 'src');
    // the reserved names are checked by listCatalog, once the group has a catalog file: a package without one is no group
    return isDir(src) ? [{ name, dirs: [normalizePath(src)] }] : [];
  });
}

// a function, not the pattern '**/node_modules/**': patterns stop matching when the directory's own path holds glob
// characters such as `[y]` or `{a,b}`
const skipNodeModules = (name: string) => basename(name) === 'node_modules';

/**
 * The files under `dir` whose names end with `ext`. `globSync` ignores case on macOS and Windows, where `isCatalogFile`
 * and Linux do not, and also returns directories whose names match, such as `x.zukan.svelte/`
 */
const filesIn = (dir: string, ext: string) =>
  globSync(`**/*${ext}`, { cwd: dir, exclude: skipNodeModules }).filter(
    (f) => f.endsWith(ext) && statSync(join(dir, f), { throwIfNoEntry: false })?.isFile()
  );

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function listCatalog(groups: CatalogGroup[], suffix: string): CatalogItem[] {
  const ext = `.${suffix}.svelte`;
  const items: (CatalogItem & { rel: string; order: number })[] = [];
  const seen = new Map<string, string>();

  groups.forEach(({ name: group, dirs }, order) => {
    for (const dir of dirs) {
      const files = filesIn(dir, ext);
      if (files.length) checkGroupName(group);
      for (const found of files) {
        const file = normalizePath(join(dir, found));
        const segments = normalizePath(found).slice(0, -ext.length).split('/');
        const name = segments[segments.length - 1];
        if (segments.length > 1 && segments[segments.length - 2] === name) segments.pop();
        const rel = segments.join('/');
        const path = `${group}/${rel}`;
        const other = seen.get(path);
        if (other) throw new Error(`svelte-zukan: duplicate catalog ID "${path}":\n  ${other}\n  ${file}`);
        seen.set(path, file);
        items.push({ group, name, dir: segments.slice(0, -1).join('/'), path, file, rel, order });
      }
    }
  });

  return items
    .sort((a, b) => a.order - b.order || collator.compare(a.rel, b.rel) || byCodePoint(a.rel, b.rel))
    .map(({ group, name, dir, path, file }) => ({ group, name, dir, path, file }));
}

/**
 * Whether `rel`, a `.svelte` file relative to the scanned directory `dir`, is a component of the library: SvelteKit's
 * route files (`+page.svelte`), tests, Storybook and Histoire stories (`.stories.svelte`, `.story.svelte`), and `routes/`
 * under a scanned `src` are not.
 */
export function isComponentFile(dir: string, rel: string) {
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  return (
    !base.startsWith('+') &&
    !/\.(test|spec|stories|story)\.svelte$/.test(base) &&
    !rel.split('/').includes('node_modules') &&
    !(dir.endsWith('/src') && rel.startsWith('routes/'))
  );
}

/**
 * The `.svelte` files in the scanned directories that no catalog file sits next to, so a person or an agent can see
 * what is left to catalog. Only component files (`isComponentFile`) are listed.
 */
export function listUncataloged(
  groups: CatalogGroup[],
  suffix: string,
  cataloged: Set<string>
): { group: string; file: string }[] {
  const ext = `.${suffix}.svelte`;
  const out: { group: string; file: string }[] = [];
  for (const { name: group, dirs } of groups) {
    for (const dir of dirs) {
      const found = filesIn(dir, '.svelte')
        .map((f) => normalizePath(f))
        .filter((f) => !f.endsWith(ext) && isComponentFile(dir, f))
        .sort((a, b) => collator.compare(a, b) || byCodePoint(a, b));
      for (const f of found) {
        const file = normalizePath(join(dir, f));
        if (!cataloged.has(file)) out.push({ group, file });
      }
    }
  }
  return out;
}
