import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { normalizePath, searchForWorkspaceRoot } from 'vite';
import type { CatalogGroup, CatalogItem } from '../types.js';
import { createMatchers } from './matchers.js';

export type { CatalogGroup, CatalogItem };

const checkGroupName = (name: string) => {
  if (name === 'preview' || name.startsWith('preview/'))
    throw new Error(
      `svelte-zukan: group name "${name}" is reserved ("preview" and "preview/..." are used by preview URLs)`
    );
};

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

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
      checkGroupName(name);
      const seen = new Map<string, string>();
      for (const d of [dirs].flat()) {
        const abs = resolve(root, d);
        if (!isDir(abs))
          throw new Error(`svelte-zukan: directory not found for group "${name}": ${normalizePath(abs)}`);
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
    if (!isDir(src)) return [];
    checkGroupName(name);
    return [{ name, dirs: [normalizePath(src)] }];
  });
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const byCodePoint = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function listCatalog(groups: CatalogGroup[], suffix: string): CatalogItem[] {
  const { isCatalogFile } = createMatchers(suffix);
  const ext = `.${suffix}.svelte`;
  const items: (CatalogItem & { rel: string; order: number })[] = [];
  const seen = new Map<string, string>();

  groups.forEach(({ name: group, dirs }, order) => {
    checkGroupName(group);
    for (const dir of dirs) {
      for (const found of globSync(`**/*${ext}`, { cwd: dir, exclude: ['**/node_modules/**'] })) {
        const file = normalizePath(join(dir, found));
        if (!isCatalogFile(file)) continue;
        const segments = normalizePath(found).slice(0, -ext.length).split('/');
        const name = segments[segments.length - 1];
        // `Button/Button` is written as `Button`
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
