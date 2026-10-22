/** what the search dialog knows about an entry; `doc` and the prop descriptions are plain text */
export type SearchItem = {
  path: string;
  name: string;
  group: string;
  sections: string[];
  doc: string;
  props: { name: string; description: string }[];
};

export type SearchKind = 'component' | 'section' | 'prop' | 'description';

/** `label` is the matched section or prop name; `snippet` is text around a match in a description */
export type SearchHit = { item: SearchItem; kind: SearchKind; label?: string; snippet?: string };

const AROUND = 30;

function snippet(text: string, at: number, length: number) {
  const start = Math.max(0, at - AROUND);
  const end = Math.min(text.length, at + length + AROUND);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}

/**
 * Case-insensitive substring search. Results come in tiers (name prefix, ID, section, prop name,
 * prop description, description), each tier in catalog order; `groups` null means every group.
 */
export function search(items: SearchItem[], query: string, groups: Set<string> | null, limit = 20): SearchHit[] {
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
  return tiers.flat().slice(0, limit);
}
