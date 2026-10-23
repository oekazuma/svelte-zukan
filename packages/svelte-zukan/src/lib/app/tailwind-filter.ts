import type { TailwindToken } from '../types.js';

const includes = (q: string, ...fields: (string | null)[]) => fields.some((s) => s?.toLowerCase().includes(q));

/** the Tailwind page's filter, shared with the `list_tailwind_tokens` tool: a class, a CSS variable or a value contains the query */
export function filterTokens(tokens: TailwindToken[], query: string): TailwindToken[] {
  const q = query.trim().toLowerCase();
  return q ? tokens.filter((t) => includes(q, t.class, t.cssVariable, t.value)) : tokens;
}

export function filterVariables(variables: Record<string, string>, query: string): [string, string][] {
  const q = query.trim().toLowerCase();
  return Object.entries(variables).filter(([name, value]) => includes(q, name, value));
}

/** Tailwind's theme namespaces, in the order of its own `theme.css` */
const NAMESPACES = [
  'color',
  'font',
  'text',
  'font-weight',
  'tracking',
  'leading',
  'breakpoint',
  'container',
  'spacing',
  'radius',
  'shadow',
  'inset-shadow',
  'drop-shadow',
  'text-shadow',
  'blur',
  'perspective',
  'aspect',
  'ease',
  'animate',
  'default'
];
// the longest first, so `--font-weight-bold` is not taken by `font` nor `--text-shadow-sm` by `text`
const MATCH_ORDER = [...NAMESPACES].sort((a, b) => b.length - a.length);

/** the Full config's groups, in namespace order with Other (`title: null`) last; empty groups are left out */
export function groupVariables(
  variables: [string, string][],
  prefix: string | null
): { title: string | null; variables: [string, string][] }[] {
  const start = prefix ? `--${prefix}-` : '--';
  const groups = new Map<string | null, [string, string][]>();
  for (const entry of variables) {
    const name = entry[0].startsWith(start) ? entry[0].slice(start.length) : null;
    const namespace = (name && MATCH_ORDER.find((ns) => name === ns || name.startsWith(`${ns}-`))) ?? null;
    const group = groups.get(namespace);
    if (group) group.push(entry);
    else groups.set(namespace, [entry]);
  }
  return [...NAMESPACES, null].flatMap((namespace) => {
    const found = groups.get(namespace);
    if (!found) return [];
    const title = namespace === null ? null : namespace === 'spacing' ? `${start}spacing` : `${start}${namespace}-*`;
    return [{ title, variables: found }];
  });
}

/**
 * a value to draw as a swatch. A substitution (`var()`, Tailwind's `--theme()`) or a CSS-wide keyword parses as any
 * property's value, but is no colour of its own. Browser only: it asks `CSS.supports`
 */
export const isColor = (value: string) =>
  !/\b(?:var|env|attr)\(|--[\w-]*\(|^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(value) &&
  CSS.supports('color', value);
