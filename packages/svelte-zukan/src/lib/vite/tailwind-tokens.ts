import type { TailwindCategory, TailwindCategoryId, TailwindToken } from '../types.js';

/** the members of Tailwind's unstable design system that svelte-zukan uses */
export type DesignSystemLike = {
  /** `options & 1` marks an `@theme inline` variable, `options & 2` one that Tailwind never declares in the CSS */
  theme: { prefix: string | null; entries(): Iterable<[string, { value: string; options?: unknown }]> };
  getClassList(): [string, ...unknown[]][];
  candidatesToCss(classes: string[]): (string | null)[];
};

/** `atRules` are the preludes of the at-rules around the rule, outermost first */
export type CssRule = { selector: string; atRules: string[]; declarations: [property: string, value: string][] };

// Tailwind serializes multi-line values (font stacks, shadows) with line breaks and indentation.
const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

// `theme.entries()` names `--spacing-2\.5` as `--spacing-2.5`; a hex escape ends at an optional whitespace
const unescape = (name: string) =>
  name.replace(/\\([0-9a-f]{1,6})\s?|\\(.)/gi, (_, hex?: string, char?: string) => {
    if (hex === undefined) return char!;
    const code = parseInt(hex, 16);
    return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? '\ufffd' : String.fromCodePoint(code);
  });

function stringEnd(css: string, start: number): number {
  for (let i = start + 1; i < css.length; i++) {
    if (css[i] === '\\') i++;
    else if (css[i] === css[start]) return i + 1;
  }
  return css.length;
}

type Layer = { name: string; places: number[] };

/**
 * Brace matching over serialized CSS, enough for Tailwind's own output. Declarations directly inside an at-rule
 * (`@property`, `@font-face`) belong to no rule. `ranks` gets each rule's cascade layer rank: per layer level, the place
 * where that layer first appears, ending in Infinity for the layer's own rules.
 */
export function scanCss(css: string, ranks?: Map<CssRule, number[]>): CssRule[] {
  const rules: CssRule[] = [];
  const stack: { prelude: string; rule: CssRule | null; layer?: Layer }[] = [];
  const order: string[] = [];
  let anonymous = 0;
  let buf = '';
  let parens = 0;

  const declaration = () => {
    const text = buf.trim();
    buf = '';
    const colon = text.indexOf(':');
    const rule = stack.at(-1)?.rule;
    if (!rule || colon <= 0) return;
    // `@import "tailwindcss" important` marks every declaration
    const value = collapse(text.slice(colon + 1)).replace(/\s*!\s*important$/i, '');
    rule.declarations.push([text.slice(0, colon).trim(), value]);
  };

  // a layer first declared under `@media` or `@supports` takes no place in the base order, which ignores conditions
  const declareLayer = (name: string): Layer => {
    const conditional = stack.some((f) => f.prelude.startsWith('@') && !f.layer);
    let path = stack.findLast((f) => f.layer)?.layer?.name;
    const places: number[] = [];
    // an anonymous layer is a new one every time
    for (const part of name ? name.split('.') : [`\0${anonymous++}`]) {
      path = path === undefined ? part.trim() : `${path}.${part.trim()}`;
      if (!conditional && !order.includes(path)) order.push(path);
      places.push(order.indexOf(path));
    }
    return { name: path!, places };
  };
  const layerName = (prelude: string) => prelude.slice(6).trim();

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
      const statement = buf.trim().replace(/\s+/g, ' ');
      if (/^@layer\s/.test(statement)) for (const name of layerName(statement).split(',')) declareLayer(name.trim());
      // the stylesheet an unconditional `@import … layer(x)` loads is not here, but it declares the layer
      const imported = /^@import (?:url\([^)]*\)|"[^"]*"|'[^']*') layer(?:\(([^)]*)\))?$/.exec(statement);
      if (imported) declareLayer(imported[1]?.trim() ?? '');
      declaration();
    } else if (c === '{') {
      const prelude = buf.trim().replace(/\s+/g, ' ');
      buf = '';
      if (prelude.startsWith('@')) {
        const layer = /^@layer(\s|$)/.test(prelude) ? declareLayer(layerName(prelude)) : undefined;
        stack.push({ prelude, rule: null, layer });
      } else {
        const rule: CssRule = {
          selector: prelude,
          atRules: stack.filter((f) => !f.rule).map((f) => f.prelude),
          declarations: []
        };
        rules.push(rule);
        ranks?.set(rule, [...stack.flatMap((f) => f.layer?.places ?? []), Infinity]);
        stack.push({ prelude, rule });
      }
    } else {
      declaration();
      stack.pop();
    }
  }
  return rules;
}

/** the selectors of a list, split at its top-level commas only */
function selectorList(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '\\') i++;
    else if (c === '"' || c === "'") i = stringEnd(list, i) - 1;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out;
}

/** the selectors of a list, with a selector that is all `:where(…)` or `:is(…)` (daisyUI's `:where(:root)`) unwrapped */
const unwrapped = (list: string): string[] =>
  selectorList(list).flatMap((s) => {
    const open = /^:(?:where|is)\(/.exec(s)?.[0].length;
    return open && closeParen(s, open - 1) === s.length - 1 ? unwrapped(s.slice(open, -1)) : [s];
  });

/**
 * custom properties declared unconditionally on the root: by a rule whose selector list includes `:root`, `:host` or
 * `html`, alone or in `:where()` / `:is()` (daisyUI's `:where(:root)`), at the top level or inside `@layer`. Of several
 * declarations, the one the cascade layers put last wins (`!important` aside).
 */
export function rootVariables(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const ranks = new Map<CssRule, number[]>();
  const stored: Record<string, number[]> = {};
  // a later layer wins, and a layer's own rules beat its sublayers as unlayered rules beat every layer
  const outranks = (a: number[], b: number[]) => {
    const i = a.findIndex((n, j) => n !== b[j]);
    return i < 0 || a[i] > b[i];
  };
  for (const rule of scanCss(css, ranks)) {
    if (!unwrapped(rule.selector).some((s) => s === ':root' || s === ':host' || s === 'html')) continue;
    if (!rule.atRules.every((a) => /^@layer(\s|$)/.test(a))) continue;
    const rank = ranks.get(rule)!;
    for (const [property, value] of rule.declarations) {
      if (!property.startsWith('--')) continue;
      const name = unescape(property);
      if (Object.hasOwn(stored, name) && !outranks(rank, stored[name])) continue;
      out[name] = value;
      stored[name] = rank;
    }
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
  return unescape((comma < 0 ? inner : inner.slice(0, comma)).trim());
}

/**
 * replaces `var(--x)` with the known value, recursively. An unknown variable (or a cycle) takes its fallback when it has
 * one, so `var(--tw-shadow-color, rgb(0 0 0 / 0.1))` reads as the color; without a fallback it stays as written.
 */
export function resolveValue(value: string, known: Record<string, string>, seen: string[] = []): string {
  let out = '';
  let from = 0;
  let fell = false;
  for (;;) {
    const at = value.indexOf('var(', from);
    const close = at < 0 ? -1 : closeParen(value, at + 3);
    if (close < 0) {
      out += value.slice(from);
      // an empty fallback (`var(--tw-blur,)`) leaves a doubled space behind
      return fell ? out.replace(/\s+/g, ' ').trim() : out;
    }
    const inner = value.slice(at + 4, close);
    const name = varName(inner);
    const comma = inner.indexOf(',');
    let text = value.slice(at, close + 1);
    if (Object.hasOwn(known, name) && !seen.includes(name)) {
      text = resolveValue(known[name], known, [...seen, name]);
    } else if (comma >= 0) {
      text = resolveValue(inner.slice(comma + 1).trim(), known, seen);
      fell = true;
    }
    out += value.slice(from, at) + text;
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
  /** the theme namespace of the class's own variable, `<namespace>-<suffix>` */
  namespace?: string;
  /** the other theme namespaces the utility reads, in Tailwind's order */
  alsoReads?: string[];
}[] = [
  {
    id: 'background-color',
    title: 'Background Color',
    stem: 'bg',
    property: 'background-color',
    kind: 'color',
    namespace: 'color',
    alsoReads: ['background-color']
  },
  {
    id: 'text-color',
    title: 'Text Color',
    stem: 'text',
    property: 'color',
    kind: 'text-color',
    namespace: 'color',
    alsoReads: ['text-color']
  },
  {
    id: 'border-color',
    title: 'Border Color',
    stem: 'border',
    property: 'border-color',
    kind: 'border-color',
    namespace: 'color',
    alsoReads: ['border-color']
  },
  {
    id: 'padding',
    title: 'Padding',
    stem: 'p',
    property: 'padding',
    kind: 'padding',
    namespace: 'spacing',
    alsoReads: ['padding']
  },
  {
    id: 'margin',
    title: 'Margin',
    stem: 'm',
    property: 'margin',
    kind: 'margin',
    namespace: 'spacing',
    alsoReads: ['margin']
  },
  { id: 'font-size', title: 'Font Size', stem: 'text', property: 'font-size', kind: 'text', namespace: 'text' },
  {
    id: 'font-weight',
    title: 'Font Weight',
    stem: 'font',
    property: 'font-weight',
    kind: 'text',
    namespace: 'font-weight'
  },
  { id: 'font-family', title: 'Font Family', stem: 'font', property: 'font-family', kind: 'text', namespace: 'font' },
  {
    id: 'letter-spacing',
    title: 'Letter Spacing',
    stem: 'tracking',
    property: 'letter-spacing',
    kind: 'text',
    namespace: 'tracking'
  },
  {
    id: 'line-height',
    title: 'Line Height',
    stem: 'leading',
    property: 'line-height',
    kind: 'text',
    namespace: 'leading',
    alsoReads: ['spacing']
  },
  {
    id: 'drop-shadow',
    title: 'Drop Shadow',
    stem: 'drop-shadow',
    property: 'filter',
    kind: 'box',
    namespace: 'drop-shadow'
  },
  {
    id: 'border-radius',
    title: 'Border Radius',
    stem: 'rounded',
    property: 'border-radius',
    kind: 'box',
    namespace: 'radius'
  },
  {
    id: 'border-width',
    title: 'Border Width',
    stem: 'border',
    property: 'border-width',
    kind: 'border',
    alsoReads: ['border-width']
  },
  {
    id: 'width',
    title: 'Width',
    stem: 'w',
    property: 'width',
    kind: 'width',
    namespace: 'spacing',
    alsoReads: ['width', 'container']
  },
  {
    id: 'height',
    title: 'Height',
    stem: 'h',
    property: 'height',
    kind: 'height',
    namespace: 'spacing',
    alsoReads: ['height']
  },
  {
    id: 'box-shadow',
    title: 'Box Shadow',
    stem: 'shadow',
    property: 'box-shadow',
    kind: 'box',
    namespace: 'shadow'
  },
  { id: 'opacity', title: 'Opacity', stem: 'opacity', property: 'opacity', kind: 'box', alsoReads: ['opacity'] },
  { id: 'breakpoints', title: 'Breakpoints', stem: 'breakpoint', property: '', kind: 'value' },
  { id: 'z-index', title: 'Z-index', stem: 'z', property: 'z-index', kind: 'value', alsoReads: ['z-index'] },
  { id: 'spacing', title: 'Spacing', stem: 'p', property: 'padding', kind: 'width' }
];

const UNIT_PX: Record<string, number> = { '': 1, px: 1, rem: 16, em: 16 };

/** a single length or number in px, or null when it needs a browser (`%`, `vw`, `auto`, `clamp()`) */
function operand(text: string): number | null {
  if (/^[+-]?infinity$/i.test(text)) return text.startsWith('-') ? -Infinity : Infinity;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z]*)$/i.exec(text);
  return m && Object.hasOwn(UNIT_PX, m[2].toLowerCase()) ? Number(m[1]) * UNIT_PX[m[2].toLowerCase()] : null;
}

/**
 * The value in px at a 16px root, for ordering: a number or length, or a flat `calc()` of them, as Tailwind's resolved
 * scales (`calc(0.25rem * 4)`) and shadcn's radii (`calc(0.625rem - 4px)`) are. A unitless line height is a multiple of
 * the font size.
 */
export function sizeOf(value: string, property: string): number | null {
  // `none` and `shadow-none`'s `0 0 #0000`
  if (/^(none|0(px)?( 0(px)?)* #0000)$/.test(value)) return 0;
  if (property === 'line-height' && /^[+-]?[\d.]+$/.test(value)) return Number(value) * 16;
  // the default scale is in percent, a project's opacity often a plain number
  if (property === 'opacity' && /^[+-]?[\d.]+%$/.test(value)) return parseFloat(value) / 100;
  const calc = /^calc\((.+)\)$/.exec(value);
  const parts = (calc?.[1] ?? value).trim().split(/\s+/);
  if (!calc && parts.length > 1) return null;
  // CSS requires spaces around a binary `+` or `-`, so splitting on whitespace keeps `-4px` one signed operand
  let sum = 0;
  let term = operand(parts[0]);
  for (let i = 1; term !== null && i < parts.length; i += 2) {
    const next = operand(parts[i + 1] ?? '');
    if (next === null || !/^[-+*/]$/.test(parts[i])) return null;
    if (parts[i] === '*') term *= next;
    else if (parts[i] === '/') term /= next;
    else [sum, term] = [sum + term, parts[i] === '+' ? next : -next];
  }
  return term === null ? null : sum + term;
}

/** `index` is the token's place in the theme, -1 outside it; `size` is from `sizeOf` */
type Ordered = { index: number; size: number | null; token: TailwindToken };

/**
 * Small to large, then the values that need a browser to compare. Ties keep the theme's order, and tokens outside the
 * theme (`p-4`, `shadow`) come first among their equals, in class-list order (the sort is stable).
 */
function bySize(tokens: Ordered[]): TailwindToken[] {
  const known = (o: Ordered) => (o.size === null ? 1 : 0);
  // `Infinity - Infinity` is NaN, which counts as a tie here
  return tokens
    .sort((a, b) => known(a) - known(b) || (a.size ?? 0) - (b.size ?? 0) || a.index - b.index)
    .map((o) => o.token);
}

// The shadow declarations are chains of `--tw-*` helpers; the rule's own helper holds the readable value.
const SHADOW_VALUE: Record<string, string> = { 'box-shadow': '--tw-shadow', filter: '--tw-drop-shadow' };

const escapeClass = (name: string) => name.replace(/[^\w-]/g, '\\$&');

/** `defaults` is the theme of a design system loaded from `@import "tailwindcss"` alone */
export function extractTokens(
  system: DesignSystemLike,
  known: Record<string, string>,
  defaults: DesignSystemLike['theme']
): { prefix: string | null; categories: TailwindCategory[]; variables: Record<string, string>; classes: string[] } {
  const prefix = system.theme.prefix;
  // a prefixed design system accepts only `tw:p-4`, while its class list and the stems stay unprefixed
  const classPrefix = prefix ? `${prefix}:` : '';
  const variablePrefix = prefix ? `--${prefix}-` : '--';
  const entries = [...system.theme.entries()];
  // Tailwind's compatibility variables (`--radius`, `--shadow`) are `@theme default inline reference`: never emitted,
  // so a project's own `:root { --radius: … }` is what the page shows. A `@config` file's values have the same options,
  // so only the entries a bare Tailwind registers with them, with the same value, are left out.
  const compat = (options: unknown) => typeof options === 'number' && (options & 6) === 6;
  const builtIn = new Set(
    [...defaults.entries()].flatMap(([key, { value, options }]) =>
      compat(options) ? [`${key}:${collapse(value)}`] : []
    )
  );
  const variables = Object.fromEntries(
    entries.flatMap(([key, { value, options }]) =>
      compat(options) && builtIn.has(`--${key.slice(variablePrefix.length)}:${collapse(value)}`)
        ? []
        : [[key, collapse(value)]]
    )
  );
  // an `options` of another shape (the API is unstable) reads as not inline
  const inline = new Set(
    entries.flatMap(([key, { options }]) => (typeof options === 'number' && options & 1 ? [key] : []))
  );
  // `@theme reference` and what `@config` and `@plugin` load: listed with the theme, but Tailwind declares none of
  // them. A non-inline one is read as `var(--x, fallback)`, so the project's own root declaration makes it real; an
  // inline one (`@config`, `@plugin`) puts its literal value into the class, which reads the variable only when that
  // value is `var()` of the variable itself, as daisyUI's `base-100: var(--color-base-100)` is. A prefix renames the
  // theme's key (`--tw-color-base-100`) but not the variable the value reads, so that root name is the one shown.
  const rootName = new Map<string, string>();
  for (const [key, { value, options }] of entries) {
    if (typeof options !== 'number' || (options & 3) !== 3) continue;
    const read = soleVar(collapse(value));
    if (read && Object.hasOwn(known, read) && variablePrefix + read.slice(2) === key) rootName.set(key, read);
  }
  const reference = new Set(
    entries.flatMap(([key, { options }]) =>
      typeof options === 'number' && options & 2 && !rootName.has(key) && (options & 1 || !Object.hasOwn(known, key))
        ? [key]
        : []
    )
  );
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

  const token = (name: string, own: string | null, others: string[], value: string, shown = value): TailwindToken => {
    const variable = soleVar(value);
    let cssVariable: string | null = variable && Object.hasOwn(variables, variable) ? variable : null;
    // an `@theme inline` token puts its value into the class, so the class reads the variable it aliases
    // (`--color-primary: var(--color-blue-500)` gives `bg-primary` the value `var(--color-blue-500)`): name its own
    if (variable && own && variable !== own && Object.hasOwn(variables, own)) cssVariable = own;
    // another namespace can hold the same value under the same suffix (`--text-xs` and `--spacing-xs`)
    if (!cssVariable && own && variables[own] === value) cssVariable = own;
    // a drop shadow's helper reads its variable (`drop-shadow(var(--drop-shadow-md))`), a box shadow's copies the value
    if (
      !cssVariable &&
      own &&
      Object.hasOwn(variables, own) &&
      [...shown.matchAll(/var\(([^,)]+)/g)].some((m) => varName(m[1]) === own)
    )
      cssVariable = own;
    // only an inline variable of a namespace the utility reads can be the source of a literal value; elsewhere an equal
    // value is a coincidence (`border-2` is `2px` like `--radius-2`)
    cssVariable ??= others.find((key) => inline.has(key) && variables[key] === value) ?? null;
    if (cssVariable && reference.has(cssVariable)) cssVariable = null;
    else if (cssVariable) cssVariable = rootName.get(cssVariable) ?? cssVariable;
    // `drop-shadow-none` sets `--tw-drop-shadow` to nothing, which a blank cell would not explain
    return { class: classPrefix + name, cssVariable, value: resolveValue(shown, values) || 'none' };
  };

  const themeIndex = new Map(entries.map(([key], i) => [key, i]));
  const byCategory = new Map<TailwindCategoryId, TailwindToken[]>();
  for (const { id, stem, property, namespace, alsoReads = [], kind } of stems) {
    const tokens: Ordered[] = [];
    for (const name of names) {
      if (!matches(name, stem)) continue;
      const rule = declarations.get(name);
      // a `@utility` of the same name adds its declarations before the theme's, and the last one applies
      const value = rule?.findLast(([p]) => p === property)?.[1];
      const shown = rule?.findLast(([p]) => p === SHADOW_VALUE[property])?.[1];
      if (value === undefined) continue;
      const suffix = name.slice(stem.length + 1);
      const own = namespace && suffix ? `${variablePrefix}${namespace}-${suffix}` : null;
      const others = suffix ? alsoReads.map((ns) => `${variablePrefix}${ns}-${suffix}`) : [];
      const t = token(name, own, others, value, shown);
      // `getClassList()` sorts names alphabetically, so `text-2xl` precedes `text-xs`. The theme lists a scale in its own
      // order. A variable that does not end in the class suffix (`p-1` reads `--spacing`) says nothing about the position.
      const key = t.cssVariable?.endsWith(`-${suffix}`) ? t.cssVariable : (own ?? '');
      // a palette is in the theme's order, not in the order of any number in its values
      const size = kind.endsWith('color') ? null : sizeOf(t.value, property);
      tokens.push({ index: themeIndex.get(key) ?? -1, size, token: t });
    }
    const sorted = bySize(tokens);
    // `current`, `inherit` and `transparent` are no theme colors: they go after the palette
    const keyword = (t: TailwindToken) => /^(currentcolor|inherit|transparent)$/i.test(t.value);
    byCategory.set(
      id,
      kind.endsWith('color') ? [...sorted.filter((t) => !keyword(t)), ...sorted.filter(keyword)] : sorted
    );
  }

  const named = (key: string): TailwindToken => ({
    class: null,
    cssVariable: key,
    value: resolveValue(variables[key], values)
  });
  byCategory.set(
    'breakpoints',
    bySize(
      Object.keys(variables)
        .filter((key) => key.startsWith(`${variablePrefix}breakpoint-`))
        .map((key, index) => {
          const token = named(key);
          return { index, size: sizeOf(token.value, 'width'), token };
        })
    )
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
