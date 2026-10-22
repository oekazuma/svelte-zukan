import type { TailwindCategory, TailwindCategoryId, TailwindToken } from '../types.js';

/** the members of Tailwind's unstable design system that svelte-zukan uses */
export type DesignSystemLike = {
  theme: { prefix: string | null; entries(): Iterable<[string, { value: string }]> };
  getClassList(): [string, ...unknown[]][];
  candidatesToCss(classes: string[]): (string | null)[];
};

/** `atRules` are the preludes of the at-rules around the rule, outermost first */
export type CssRule = { selector: string; atRules: string[]; declarations: [property: string, value: string][] };

// Tailwind serializes multi-line values (font stacks, shadows) with line breaks and indentation.
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

function stringEnd(css: string, start: number): number {
  for (let i = start + 1; i < css.length; i++) {
    if (css[i] === '\\') i++;
    else if (css[i] === css[start]) return i + 1;
  }
  return css.length;
}

/**
 * Brace matching over serialized CSS, enough for Tailwind's own output. Declarations directly inside an at-rule
 * (`@property`, `@font-face`) belong to no rule.
 */
export function scanCss(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const stack: { prelude: string; rule: CssRule | null }[] = [];
  let buf = '';
  let parens = 0;

  const declaration = () => {
    const text = buf.trim();
    buf = '';
    const colon = text.indexOf(':');
    const rule = stack.at(-1)?.rule;
    if (rule && colon > 0) rule.declarations.push([text.slice(0, colon).trim(), collapse(text.slice(colon + 1))]);
  };

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const end = stringEnd(css, i);
      buf += css.slice(i, end);
      i = end - 1;
    } else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1;
    } else if (c === '(') {
      parens++;
      buf += c;
    } else if (c === ')') {
      parens = Math.max(0, parens - 1);
      buf += c;
    } else if (parens > 0 || (c !== '{' && c !== '}' && c !== ';')) {
      buf += c;
    } else if (c === ';') {
      declaration();
    } else if (c === '{') {
      const prelude = buf.trim().replace(/\s+/g, ' ');
      buf = '';
      if (prelude.startsWith('@')) {
        stack.push({ prelude, rule: null });
      } else {
        const rule: CssRule = {
          selector: prelude,
          atRules: stack.filter((f) => !f.rule).map((f) => f.prelude),
          declarations: []
        };
        rules.push(rule);
        stack.push({ prelude, rule });
      }
    } else {
      declaration();
      stack.pop();
    }
  }
  return rules;
}

/** custom properties declared unconditionally: on `:root`, `:host` or `html`, at the top level or inside `@layer` */
export function rootVariables(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of scanCss(css)) {
    const selectors = rule.selector.split(',').map((s) => s.trim());
    if (!selectors.every((s) => s === ':root' || s === ':host' || s === 'html')) continue;
    if (!rule.atRules.every((a) => /^@layer(\s|$)/.test(a))) continue;
    for (const [property, value] of rule.declarations) if (property.startsWith('--')) out[property] = value;
  }
  return out;
}

/** index of the `)` that closes the `(` at `open`, or -1 */
function closeParen(value: string, open: number): number {
  let depth = 0;
  for (let i = open; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

function varName(inner: string): string {
  const comma = inner.indexOf(',');
  return (comma < 0 ? inner : inner.slice(0, comma)).trim();
}

/** replaces `var(--x)` with the known value, recursively; unknown variables and cycles stay as written */
export function resolveValue(value: string, known: Record<string, string>, seen: string[] = []): string {
  let out = '';
  let from = 0;
  for (;;) {
    const at = value.indexOf('var(', from);
    const close = at < 0 ? -1 : closeParen(value, at + 3);
    if (close < 0) return out + value.slice(from);
    const name = varName(value.slice(at + 4, close));
    const replace = Object.hasOwn(known, name) && !seen.includes(name);
    out +=
      value.slice(from, at) +
      (replace ? resolveValue(known[name], known, [...seen, name]) : value.slice(at, close + 1));
    from = close + 1;
  }
}

/** the variable of a value that is exactly one `var(--x)` or `var(--x, …)` */
function soleVar(value: string): string | null {
  if (!value.startsWith('var(') || closeParen(value, 3) !== value.length - 1) return null;
  return varName(value.slice(4, -1));
}

type Kind =
  | 'color'
  | 'text-color'
  | 'border-color'
  | 'padding'
  | 'margin'
  | 'text'
  | 'box'
  | 'border'
  | 'width'
  | 'height'
  | 'value';

export const CATEGORIES: readonly {
  id: TailwindCategoryId;
  title: string;
  stem: string;
  property: string;
  kind: Kind;
  /** theme namespace of tokens that carry no variable of their own (the shadow classes) */
  namespace?: string;
}[] = [
  { id: 'background-color', title: 'Background Color', stem: 'bg', property: 'background-color', kind: 'color' },
  { id: 'text-color', title: 'Text Color', stem: 'text', property: 'color', kind: 'text-color' },
  { id: 'border-color', title: 'Border Color', stem: 'border', property: 'border-color', kind: 'border-color' },
  { id: 'padding', title: 'Padding', stem: 'p', property: 'padding', kind: 'padding' },
  { id: 'margin', title: 'Margin', stem: 'm', property: 'margin', kind: 'margin' },
  { id: 'font-size', title: 'Font Size', stem: 'text', property: 'font-size', kind: 'text' },
  { id: 'font-weight', title: 'Font Weight', stem: 'font', property: 'font-weight', kind: 'text' },
  { id: 'font-family', title: 'Font Family', stem: 'font', property: 'font-family', kind: 'text' },
  { id: 'letter-spacing', title: 'Letter Spacing', stem: 'tracking', property: 'letter-spacing', kind: 'text' },
  { id: 'line-height', title: 'Line Height', stem: 'leading', property: 'line-height', kind: 'text' },
  {
    id: 'drop-shadow',
    title: 'Drop Shadow',
    stem: 'drop-shadow',
    property: 'filter',
    kind: 'box',
    namespace: 'drop-shadow'
  },
  { id: 'border-radius', title: 'Border Radius', stem: 'rounded', property: 'border-radius', kind: 'box' },
  { id: 'border-width', title: 'Border Width', stem: 'border', property: 'border-width', kind: 'border' },
  { id: 'width', title: 'Width', stem: 'w', property: 'width', kind: 'width' },
  { id: 'height', title: 'Height', stem: 'h', property: 'height', kind: 'height' },
  {
    id: 'box-shadow',
    title: 'Box Shadow',
    stem: 'shadow',
    property: 'box-shadow',
    kind: 'box',
    namespace: 'shadow'
  },
  { id: 'opacity', title: 'Opacity', stem: 'opacity', property: 'opacity', kind: 'box' },
  { id: 'breakpoints', title: 'Breakpoints', stem: 'breakpoint', property: '', kind: 'value' },
  { id: 'z-index', title: 'Z-index', stem: 'z', property: 'z-index', kind: 'value' },
  { id: 'spacing', title: 'Spacing', stem: 'p', property: 'padding', kind: 'padding' }
];

// The shadow declarations are chains of `--tw-*` helpers; the rule's own helper holds the readable value.
const SHADOW_VALUE: Record<string, string> = { 'box-shadow': '--tw-shadow', filter: '--tw-drop-shadow' };

const escapeClass = (name: string) => name.replace(/[^\w-]/g, '\\$&');

export function extractTokens(
  system: DesignSystemLike,
  known: Record<string, string>
): { prefix: string | null; categories: TailwindCategory[]; variables: Record<string, string>; classes: string[] } {
  const prefix = system.theme.prefix;
  // a prefixed design system accepts only `tw:p-4`, while its class list and the stems stay unprefixed
  const classPrefix = prefix ? `${prefix}:` : '';
  const variablePrefix = prefix ? `--${prefix}-` : '--';
  const variables = Object.fromEntries([...system.theme.entries()].map(([key, { value }]) => [key, collapse(value)]));
  const values = { ...variables, ...known };
  const matches = (name: string, stem: string) => name === stem || name.startsWith(`${stem}-`);

  const stems = CATEGORIES.filter((c) => c.property);
  const names = system
    .getClassList()
    .map(([name]) => name)
    .filter((name) => stems.some((c) => matches(name, c.stem)));
  const css = system.candidatesToCss(names.map((name) => classPrefix + name));
  const declarations = new Map<string, [string, string][]>();
  names.forEach((name, i) => {
    const selector = `.${escapeClass(classPrefix + name)}`;
    const rule = scanCss(css[i] ?? '').find((r) => r.selector === selector && r.atRules.length === 0);
    if (rule) declarations.set(name, rule.declarations);
  });

  const token = (name: string, stem: string, value: string, shown = value): TailwindToken => {
    const variable = soleVar(value);
    let cssVariable: string | null = variable && Object.hasOwn(variables, variable) ? variable : null;
    // an `@theme inline` token puts its value into the class, so the variable is the one holding that value
    const suffix = name.slice(stem.length + 1);
    if (!cssVariable && suffix) {
      cssVariable =
        Object.keys(variables).find((key) => variables[key] === value && key.endsWith(`-${suffix}`)) ?? null;
    }
    return { class: classPrefix + name, cssVariable, value: resolveValue(shown, values) };
  };

  const themeIndex = new Map(Object.keys(variables).map((key, i) => [key, i]));
  const byCategory = new Map<TailwindCategoryId, TailwindToken[]>();
  for (const { id, stem, property, namespace } of stems) {
    const tokens: [index: number, TailwindToken][] = [];
    for (const name of names) {
      if (!matches(name, stem)) continue;
      const rule = declarations.get(name);
      const value = rule?.find(([p]) => p === property)?.[1];
      const shown = rule?.find(([p]) => p === SHADOW_VALUE[property])?.[1];
      if (value === undefined) continue;
      const t = token(name, stem, value, shown);
      // `getClassList()` sorts names alphabetically, so `text-2xl` precedes `text-xs`. The theme lists a scale in its own
      // order. A variable that does not end in the class suffix (`p-1` reads `--spacing`) says nothing about the position.
      const suffix = name.slice(stem.length + 1);
      const key = t.cssVariable?.endsWith(`-${suffix}`)
        ? t.cssVariable
        : namespace && suffix
          ? `${variablePrefix}${namespace}-${suffix}`
          : '';
      tokens.push([themeIndex.get(key) ?? -1, t]);
    }
    // stable: tokens outside the theme (`p-4`, `rounded-full`, `shadow-none`) stay first, in class-list order
    byCategory.set(
      id,
      tokens.sort((a, b) => a[0] - b[0]).map(([, t]) => t)
    );
  }

  const named = (key: string): TailwindToken => ({
    class: null,
    cssVariable: key,
    value: resolveValue(variables[key], values)
  });
  byCategory.set(
    'breakpoints',
    Object.keys(variables)
      .filter((key) => key.startsWith(`${variablePrefix}breakpoint-`))
      .map(named)
  );
  const base = `${variablePrefix}spacing`;
  byCategory.set('spacing', [
    ...(Object.hasOwn(variables, base) ? [named(base)] : []),
    ...(byCategory.get('padding') ?? [])
  ]);

  const categories = CATEGORIES.map(({ id, title }) => ({ id, title, tokens: byCategory.get(id) ?? [] })).filter(
    (c) => c.tokens.length > 0
  );
  const classes = [...new Set(categories.flatMap((c) => c.tokens.flatMap((t) => (t.class ? [t.class] : []))))];
  return { prefix, categories, variables, classes };
}
