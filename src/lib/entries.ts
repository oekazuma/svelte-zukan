import type { Entry, Groups } from './types';

const SUFFIX = '.zukan.svelte';

export function buildEntries(groups: Groups): Entry[] {
  const entries: Entry[] = [];
  for (const [group, files] of Object.entries(groups)) {
    if (group === 'preview') {
      throw new Error("The group name 'preview' is reserved");
    }
    const seen = new Map<string, string>();
    const groupEntries: Entry[] = [];
    for (const [file, load] of Object.entries(files)) {
      const name = file.slice(file.lastIndexOf('/') + 1).slice(0, -SUFFIX.length);
      const other = seen.get(name);
      if (other) {
        throw new Error(`Duplicate zukan name '${name}' in group '${group}': ${other} and ${file}`);
      }
      seen.set(name, file);
      groupEntries.push({
        group,
        name,
        path: `${group}/${name}`,
        load: load as Entry['load']
      });
    }
    entries.push(...groupEntries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)));
  }
  return entries;
}

export function zukanEntries(groups: Groups): { path: string }[] {
  const paths = buildEntries(groups).map((e) => e.path);
  return [{ path: '' }, ...paths.map((path) => ({ path })), ...paths.map((path) => ({ path: `preview/${path}` }))];
}

export function resolveBase(pathname: string, path: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return path && trimmed.endsWith(`/${path}`) ? trimmed.slice(0, -(path.length + 1)) : trimmed;
}
