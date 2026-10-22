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
  const start = Math.max(0, at - AROUND);
  const end = Math.min(text.length, at + length + AROUND);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Case-insensitive substring search. Results come in tiers (name prefix, ID, section, prop name,
 * prop description, description), each tier in catalog order; `groups` null means every group.
 * A Tailwind CSS category title, class or variable joins the first tier when it starts with the query and the
 * second when it contains it, after the components.
 */
export function search(
  items: SearchItem[],
  query: string,
  groups: Set<string> | null,
  limit = 20,
  tailwind: TailwindSearchItem[] = []
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
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
      const at = description.toLowerCase().indexOf(q);
      if (at !== -1)
        tiers[4].push({ item, kind: 'prop', label: prop.name, snippet: snippet(description, at, q.length) });
    }
    const doc = item.doc.replace(/\s+/g, ' ');
    const at = doc.toLowerCase().indexOf(q);
    if (at !== -1) tiers[5].push({ item, kind: 'description', snippet: snippet(doc, at, q.length) });
  }
  const tier = (text: string) => (text.toLowerCase().startsWith(q) ? tiers[0] : tiers[1]);
  for (const item of tailwind) {
    if (item.title.toLowerCase().includes(q)) tier(item.title).push({ item, kind: 'tailwind' });
    for (const token of item.tokens) {
      const label = [token.class, token.cssVariable].find((s) => s?.toLowerCase().includes(q));
      if (label) tier(label).push({ item, kind: 'tailwind', label, value: token.value });
    }
  }
  return tiers.flat().slice(0, limit);
}
