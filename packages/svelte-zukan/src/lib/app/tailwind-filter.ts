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
