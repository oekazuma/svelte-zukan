import type { TailwindCategoryId, TailwindToken } from '../types.js';

/** what the search dialog knows about an entry; `doc` and the prop descriptions are plain text */
export type SearchItem = {
  path: string;
  name: string;
  group: string;
  sections: string[];
  doc: string;
  props: { name: string; description: string }[];
};

/** one category of a Tailwind CSS entry, or its Full config; `title` is in the catalog's language */
export type TailwindSearchItem = {
  source: string;
  category: TailwindCategoryId | 'full-config';
  title: string;
  tokens: TailwindToken[];
};

export type SearchKind = 'component' | 'section' | 'prop' | 'description' | 'tailwind';

/**
 * `label` is the matched section or prop name, or the matched class or variable (none for a category title);
 * `snippet` is text around a match in a description; `value` is the matched token's
 */
export type SearchHit =
  | { item: SearchItem; kind: Exclude<SearchKind, 'tailwind'>; label?: string; snippet?: string }
  | { item: TailwindSearchItem; kind: 'tailwind'; label?: string; value?: string };

const AROUND = 30;

function snippet(text: string, at: number, length: number) {
  let start = Math.max(0, at - AROUND);
  let end = Math.min(text.length, at + length + AROUND);
  // a cut inside a word moves to the nearest space towards the match; text without spaces (Japanese) is cut as it is
  if (start > 0 && text[start - 1] !== ' ') {
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < text.length && text[end] !== ' ') {
    const space = text.lastIndexOf(' ', end);
    if (space >= at + length) end = space;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Case-insensitive substring search. Results come in tiers (name prefix, ID, section, prop name,
 * prop description, description), each tier in catalog order; `groups` null means every group.
 * Tailwind CSS category titles, classes and variables come after them, those starting with the query first, and
 * are capped on their own: a theme has hundreds of `text-*` or `--color-*` names that would push every component out.
 */
export function search(
  items: SearchItem[],
  query: string,
  groups: Set<string> | null,
  limit = 20,
  tailwind: TailwindSearchItem[] = [],
  tailwindLimit = 10
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // in the text as written: an index found in the lowercased text moves where lowercasing changes the length (`İ`)
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu');
  const find = (text: string) => {
    const m = pattern.exec(text);
    return m && { at: m.index, length: m[0].length };
  };
  const tiers: SearchHit[][] = [[], [], [], [], [], []];
  for (const item of items) {
    if (groups && !groups.has(item.group)) continue;
    if (item.name.toLowerCase().startsWith(q)) tiers[0].push({ item, kind: 'component' });
    else if (item.path.toLowerCase().includes(q)) tiers[1].push({ item, kind: 'component' });
    for (const title of item.sections) {
      if (title.toLowerCase().includes(q)) tiers[2].push({ item, kind: 'section', label: title });
    }
    for (const prop of item.props) {
      const description = prop.description.replace(/\s+/g, ' ');
      if (prop.name.toLowerCase().includes(q)) {
        tiers[3].push({
          item,
          kind: 'prop',
          label: prop.name,
          snippet: description && snippet(description, 0, AROUND)
        });
        continue;
      }
      const found = find(description);
      if (found)
        tiers[4].push({ item, kind: 'prop', label: prop.name, snippet: snippet(description, found.at, found.length) });
    }
    const doc = item.doc.replace(/\s+/g, ' ');
    const found = find(doc);
    if (found) tiers[5].push({ item, kind: 'description', snippet: snippet(doc, found.at, found.length) });
  }
  const tailwindTiers: SearchHit[][] = [[], []];
  const tier = (text: string) => tailwindTiers[text.toLowerCase().startsWith(q) ? 0 : 1];
  for (const item of tailwind) {
    if (item.title.toLowerCase().includes(q)) tier(item.title).push({ item, kind: 'tailwind' });
    for (const token of item.tokens) {
      const label = [token.class, token.cssVariable].find((s) => s?.toLowerCase().includes(q));
      if (label) tier(label).push({ item, kind: 'tailwind', label, value: token.value });
    }
  }
  return [...tiers.flat().slice(0, limit), ...tailwindTiers.flat().slice(0, tailwindLimit)];
}
