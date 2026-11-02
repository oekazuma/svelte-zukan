import { __unstable__loadDesignSystem, compile } from '@tailwindcss/node';
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizePath } from 'vite';
import { describe, expect, it } from 'vitest';
import type { TailwindCategoryId } from '../types.js';
import {
  extractTokens,
  resolveValue,
  rootVariables,
  scanCss,
  sizeOf,
  type DesignSystemLike
} from './tailwind-tokens.js';

const base = import.meta.dirname;

async function load(css: string) {
  const system = (await __unstable__loadDesignSystem(css, { base })) as unknown as DesignSystemLike;
  const compiled = await compile(css, { base, onDependency() {} });
  const defaults = (await __unstable__loadDesignSystem('@import "tailwindcss";', {
    base
  })) as unknown as DesignSystemLike;
  const result = extractTokens(system, (classes) => compiled.build(classes), defaults.theme);
  const token = (id: TailwindCategoryId, cls: string | null) =>
    result.categories.find((c) => c.id === id)?.tokens.find((t) => t.class === cls);
  const classesOf = (cls: string) =>
    result.categories.filter((c) => c.tokens.some((t) => t.class === cls)).map((c) => c.id);
  return { system, result, token, classesOf };
}

describe('extractTokens', () => {
  it('lists a project color once per color category', async () => {
    const { token } = await load('@import "tailwindcss"; @theme { --color-brand-500: #ff3e00; }');
    for (const [id, cls] of [
      ['background-color', 'bg-brand-500'],
      ['text-color', 'text-brand-500'],
      ['border-color', 'border-brand-500']
    ] as const) {
      expect(token(id, cls)).toEqual({ class: cls, cssVariable: '--color-brand-500', value: '#ff3e00' });
    }
  });

  it('resolves @theme inline tokens through :root variables', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n:root { --primary: oklch(0.6 0.2 30); }\n@theme inline { --color-primary: var(--primary); }'
    );
    expect(token('background-color', 'bg-primary')).toEqual({
      class: 'bg-primary',
      cssVariable: '--color-primary',
      value: 'oklch(0.6 0.2 30)'
    });
  });

  it('resolves @theme inline tokens through a rule that also matches other elements', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n:root, [data-theme="light"] { --primary: oklch(0.6 0.2 30); }\n' +
        '@theme inline { --color-primary: var(--primary); }'
    );
    expect(token('background-color', 'bg-primary')?.value).toBe('oklch(0.6 0.2 30)');
  });

  it('resolves @theme inline tokens through a :where(:root) rule', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n:where(:root) { --brand: #ff3e00; }\n@theme inline { --color-primary: var(--brand); }'
    );
    expect(token('background-color', 'bg-primary')?.value).toBe('#ff3e00');
  });

  it('reads the same tokens with important', async () => {
    const plain = await load('@import "tailwindcss";');
    const important = await load('@import "tailwindcss" important;');
    expect(important.result.categories).toEqual(plain.result.categories);
  });

  it('names an @theme inline token after its own variable when another one shares its value and suffix', async () => {
    const { token } = await load('@import "tailwindcss";\n@theme inline { --spacing-xs: 0.75rem; }');
    expect(token('padding', 'p-xs')?.cssVariable).toBe('--spacing-xs');
  });

  it('gives no variable for a value that only an @theme variable of another namespace shares', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n@theme { --radius-2: 2px; --radius-4: 4px; --radius-px: 1px; }'
    );
    expect(token('border-width', 'border-2')?.cssVariable).toBeNull();
    expect(token('border-width', 'border-4')?.cssVariable).toBeNull();
    for (const [id, cls] of [
      ['padding', 'p-px'],
      ['margin', 'm-px'],
      ['width', 'w-px']
    ] as const) {
      expect(token(id, cls)?.cssVariable).toBeNull();
    }
  });

  it('gives no variable for a value that only an @theme inline variable of another namespace shares', async () => {
    const { token } = await load('@import "tailwindcss";\n@theme inline { --radius-2: 2px; --radius-px: 1px; }');
    expect(token('border-width', 'border-2')?.cssVariable).toBeNull();
    expect(token('padding', 'p-px')?.cssVariable).toBeNull();
    expect(token('width', 'w-px')?.cssVariable).toBeNull();
    expect(token('border-radius', 'rounded-2')?.cssVariable).toBe('--radius-2');
  });

  it('names an @theme inline variable of another namespace that the class reads', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n@theme inline { --container-card: 20rem; --border-width-thick: 3px; }'
    );
    expect(token('width', 'w-card')).toEqual({ class: 'w-card', cssVariable: '--container-card', value: '20rem' });
    expect(token('border-width', 'border-thick')?.cssVariable).toBe('--border-width-thick');
  });

  it('resolves a theme variable with an escaped dot', async () => {
    const { result, token } = await load('@import "tailwindcss";\n@theme { --spacing-2\\.5: 10px; }');
    expect(token('padding', 'p-2.5')).toEqual({ class: 'p-2.5', cssVariable: '--spacing-2.5', value: '10px' });
    const padding = result.categories.find((c) => c.id === 'padding')?.tokens.map((t) => t.class) ?? [];
    expect(padding.indexOf('p-2.5')).toBe(padding.indexOf('p-2') + 1);
  });

  it('names an @theme inline alias of another theme variable after the token, and orders it as the project', async () => {
    const { result, token } = await load(
      '@import "tailwindcss";\n@theme inline { --color-primary: var(--color-blue-500); --radius-card: var(--radius-lg);' +
        ' --font-body: var(--font-serif); --color-old-surface: #123456; --color-surface: var(--color-old-surface); }'
    );
    expect(token('background-color', 'bg-primary')?.cssVariable).toBe('--color-primary');
    // the aliased variable ends in the same suffix as the token's own
    expect(token('background-color', 'bg-surface')?.cssVariable).toBe('--color-surface');
    expect(token('border-radius', 'rounded-card')?.cssVariable).toBe('--radius-card');
    expect(token('font-family', 'font-body')?.cssVariable).toBe('--font-body');
    const classes = (id: TailwindCategoryId) =>
      result.categories.find((c) => c.id === id)?.tokens.map((t) => t.class) ?? [];
    expect(classes('background-color').indexOf('bg-primary')).toBeGreaterThan(
      classes('background-color').indexOf('bg-white')
    );
    expect(classes('font-family').at(-1)).toBe('font-body');
    expect(classes('border-radius').indexOf('rounded-card')).toBe(classes('border-radius').indexOf('rounded-lg') + 1);
  });

  it('gives spacing classes no variable and a resolved value', async () => {
    const { token } = await load('@import "tailwindcss";');
    expect(token('padding', 'p-4')).toEqual({ class: 'p-4', cssVariable: null, value: 'calc(0.25rem * 4)' });
  });

  it('keeps text colors and font sizes apart', async () => {
    const { classesOf } = await load('@import "tailwindcss";');
    expect(classesOf('text-red-500')).toEqual(['text-color']);
    expect(classesOf('text-lg')).toEqual(['font-size']);
  });

  it('leaves out side-specific border colors', async () => {
    const { classesOf } = await load('@import "tailwindcss";');
    expect(classesOf('border-red-500')).toEqual(['border-color']);
    expect(classesOf('border-t-red-500')).toEqual([]);
  });

  it("reads shadow values from the rule's own shadow variable", async () => {
    const { token } = await load('@import "tailwindcss";');
    const box = token('box-shadow', 'shadow-lg');
    expect(box?.value).toContain('0 10px 15px');
    expect(box?.value).not.toContain('var(--tw-inset-shadow)');
    const drop = token('drop-shadow', 'drop-shadow-md');
    expect(drop?.value).toContain('drop-shadow(0 3px 3px');
    expect(drop?.value).not.toContain('var(--tw-blur');
  });

  it('names the drop shadow variable that the shadow helper reads', async () => {
    const { token } = await load('@import "tailwindcss";');
    expect(token('drop-shadow', 'drop-shadow-md')?.cssVariable).toBe('--drop-shadow-md');
    const escaped = await load('@import "tailwindcss";\n@theme { --drop-shadow-1\\.5: 0 0 1px red; }');
    expect(escaped.token('drop-shadow', 'drop-shadow-1.5')?.cssVariable).toBe('--drop-shadow-1.5');
    // Tailwind copies a box shadow's value into `--tw-shadow` instead of reading `--shadow-lg`
    expect(token('box-shadow', 'shadow-lg')?.cssVariable).toBeNull();
  });

  it("leaves out Tailwind's reference-only compatibility variables, but keeps the project's @theme reference", async () => {
    const { result, token } = await load(
      '@import "tailwindcss";\n@theme reference { --color-mine: red; }\n:root { --radius: 0.625rem; }\n' +
        '@theme inline { --radius-lg: var(--radius); }'
    );
    for (const key of ['--radius', '--blur', '--shadow', '--shadow-inner', '--drop-shadow', '--max-width-prose']) {
      expect(result.variables).not.toHaveProperty(key);
    }
    expect(result.variables['--color-mine']).toBe('red');
    // Tailwind never declares a reference variable, so there is no variable to copy
    expect(token('background-color', 'bg-mine')).toEqual({ class: 'bg-mine', cssVariable: null, value: 'red' });
    // unless the project declares it on the root itself
    const declared = await load(
      '@import "tailwindcss";\n@theme reference { --color-mine: red; }\n:root { --color-mine: blue; }'
    );
    expect(declared.token('background-color', 'bg-mine')).toEqual({
      class: 'bg-mine',
      cssVariable: '--color-mine',
      value: 'blue'
    });
    expect(token('border-radius', 'rounded-lg')).toEqual({
      class: 'rounded-lg',
      cssVariable: '--radius-lg',
      value: '0.625rem'
    });
    const shadows = result.categories.find((c) => c.id === 'box-shadow')?.tokens.map((t) => t.class);
    const plain = (await load('@import "tailwindcss";')).result.categories.find((c) => c.id === 'box-shadow');
    expect(shadows).toEqual(plain?.tokens.map((t) => t.class));
  });

  it('gives no variable for the values that @config and @plugin load', async () => {
    const dir = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), 'zukan-tailwind-tokens-'))));
    writeFileSync(
      join(dir, 'tw.config.mjs'),
      "export default { theme: { extend: { colors: { brand: '#123456' } } } };"
    );
    writeFileSync(
      join(dir, 'plug.mjs'),
      "export default { handler() {}, config: { theme: { extend: { colors: { plug: '#0a0b0c' } } } } };"
    );
    const { result, token } = await load(
      `@import "tailwindcss";\n@config "${dir}/tw.config.mjs";\n@plugin "${dir}/plug.mjs";`
    );
    expect(token('background-color', 'bg-brand')).toEqual({ class: 'bg-brand', cssVariable: null, value: '#123456' });
    expect(token('background-color', 'bg-plug')).toEqual({ class: 'bg-plug', cssVariable: null, value: '#0a0b0c' });
    expect(result.variables).toMatchObject({ '--color-brand': '#123456', '--color-plug': '#0a0b0c' });
    // the class carries the literal value, so a root declaration of the same name is not what it reads
    const declared = await load(
      `@import "tailwindcss";\n@config "${dir}/tw.config.mjs";\n:root { --color-brand: #abcdef; }`
    );
    expect(declared.token('background-color', 'bg-brand')).toEqual({
      class: 'bg-brand',
      cssVariable: null,
      value: '#123456'
    });
  });

  it.each([
    ['', ''],
    [' prefix(tw)', 'tw:']
  ])(
    'names the variable of a @plugin value that reads a root variable of its own name, as daisyUI does%s',
    async (prefix, cls) => {
      const dir = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), 'zukan-tailwind-tokens-'))));
      // daisyUI 5's shape: `theme.extend` maps each name to `var()` of its own theme variable, and `addBase` declares
      // the values of the default theme on `:where(:root)`
      writeFileSync(
        join(dir, 'daisy.mjs'),
        `import plugin from ${JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('tailwindcss/plugin')).href)};
export default plugin.withOptions(
  () => ({ addBase }) => addBase({
    ':where(:root),:root:has(input.theme-controller[value=light]:checked),[data-theme=light]': {
      'color-scheme': 'light', '--color-base-100': 'oklch(100% 0 0)', '--radius-box': '0.5rem'
    },
    '@media (prefers-color-scheme: dark)': { ':root:not([data-theme])': { '--color-base-100': 'oklch(25% 0 0)' } }
  }),
  () => ({ theme: { extend: {
    colors: { 'base-100': 'var(--color-base-100)', primary: 'var(--color-primary)' },
    borderRadius: { box: 'var(--radius-box)' }
  } } })
);`
      );
      const { token } = await load(`@import "tailwindcss"${prefix};\n@plugin "${dir}/daisy.mjs";`);
      // a prefix renames the theme's keys, not the variables the plugin's values read and declares
      expect(token('background-color', `${cls}bg-base-100`)).toEqual({
        class: `${cls}bg-base-100`,
        cssVariable: '--color-base-100',
        value: 'oklch(100% 0 0)'
      });
      expect(token('border-radius', `${cls}rounded-box`)).toEqual({
        class: `${cls}rounded-box`,
        cssVariable: '--radius-box',
        value: '0.5rem'
      });
      // nothing declares it, so there is still nothing to copy
      expect(token('background-color', `${cls}bg-primary`)).toEqual({
        class: `${cls}bg-primary`,
        cssVariable: null,
        value: 'var(--color-primary)'
      });
    }
  );

  it('reads the last declaration of the property', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n@theme { --color-brand: #123; }\n@utility bg-brand { background-color: hotpink; }'
    );
    expect(token('background-color', 'bg-brand')).toEqual({
      class: 'bg-brand',
      cssVariable: '--color-brand',
      value: '#123'
    });
  });

  it('resolves @theme inline tokens through the :root variables that win the cascade layers', async () => {
    const { token } = await load(
      '@import "tailwindcss";\n:root { --brand: red; }\n@layer base { :root { --brand: blue; --accent: green; } }\n' +
        '@layer components { :root { --accent: purple; } }\n@layer base { :root { --accent: orange; } }\n' +
        '@theme inline { --color-brand: var(--brand); --color-accent: var(--accent); }'
    );
    expect(token('background-color', 'bg-brand')).toEqual({
      class: 'bg-brand',
      cssVariable: '--color-brand',
      value: 'red'
    });
    expect(token('background-color', 'bg-accent')).toEqual({
      class: 'bg-accent',
      cssVariable: '--color-accent',
      value: 'purple'
    });
  });

  it('shows fallbacks instead of unknown variables', async () => {
    const { token } = await load('@import "tailwindcss";');
    const box = token('box-shadow', 'shadow-md')?.value;
    expect(box).toContain('rgb(0 0 0 / 0.1)');
    expect(box).not.toContain('var(--tw-shadow-color');
    expect(token('drop-shadow', 'drop-shadow-md')?.value).not.toContain('var(');
  });

  it('shows none for a token with an empty value', async () => {
    const { result, token } = await load('@import "tailwindcss";');
    expect(token('drop-shadow', 'drop-shadow-none')?.value).toBe('none');
    for (const { tokens } of result.categories) for (const t of tokens) expect(t.value.trim()).not.toBe('');
  });

  it('collapses line breaks and indentation in values', async () => {
    const { result, token } = await load('@import "tailwindcss";');
    const family = token('font-family', 'font-mono');
    expect(family?.value).toContain('"Courier New"');
    for (const value of [family?.value, ...Object.values(result.variables)]) expect(value).not.toMatch(/\n|\s{2}/);
  });

  it('lists breakpoints and the spacing base without a class', async () => {
    const { result, token } = await load('@import "tailwindcss";');
    expect(token('breakpoints', null)).toEqual({ class: null, cssVariable: '--breakpoint-sm', value: '40rem' });
    expect(result.categories.find((c) => c.id === 'spacing')?.tokens[0]).toEqual({
      class: null,
      cssVariable: '--spacing',
      value: '0.25rem'
    });
  });

  describe('order', () => {
    it('lists keyword colors after the theme colors', async () => {
      const { result } = await load('@import "tailwindcss";');
      for (const [id, stem] of [
        ['background-color', 'bg'],
        ['text-color', 'text'],
        ['border-color', 'border']
      ] as const) {
        const tokens = result.categories.find((c) => c.id === id)?.tokens ?? [];
        expect(tokens[0].class).toBe(`${stem}-red-50`);
        expect(tokens.slice(-3).map((t) => t.class)).toEqual([
          `${stem}-current`,
          `${stem}-inherit`,
          `${stem}-transparent`
        ]);
      }
    });

    const classes = (result: Awaited<ReturnType<typeof load>>['result'], id: TailwindCategoryId) =>
      result.categories.find((c) => c.id === id)?.tokens.map((t) => t.class ?? t.cssVariable) ?? [];

    it("follows the theme's scale, not the alphabet", async () => {
      const { result } = await load('@import "tailwindcss";');
      expect(classes(result, 'font-size').slice(0, 6)).toEqual([
        'text-xs',
        'text-sm',
        'text-base',
        'text-lg',
        'text-xl',
        'text-2xl'
      ]);
      expect(classes(result, 'font-weight').slice(0, 3)).toEqual(['font-thin', 'font-extralight', 'font-light']);
      expect(classes(result, 'letter-spacing')[0]).toBe('tracking-tighter');
      expect(classes(result, 'border-radius')).toEqual(
        ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'].map((size) => `rounded-${size}`)
      );
      expect(classes(result, 'border-width').slice(0, 3)).toEqual(['border-0', 'border', 'border-2']);
      expect(classes(result, 'box-shadow').slice(0, 7)).toEqual([
        'shadow-none',
        'shadow',
        'shadow-2xs',
        'shadow-xs',
        'shadow-sm',
        'shadow-md',
        'shadow-lg'
      ]);
      expect(classes(result, 'drop-shadow')).toEqual(
        ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((size) => `drop-shadow-${size}`)
      );
      expect(classes(result, 'breakpoints')).toEqual(
        ['sm', 'md', 'lg', 'xl', '2xl'].map((size) => `--breakpoint-${size}`)
      );
    });

    it('lists project colors in their @theme order', async () => {
      const { result } = await load('@import "tailwindcss"; @theme { --color-zeta: red; --color-alpha: blue; }');
      const colors = classes(result, 'background-color');
      expect(colors.indexOf('bg-zeta')).toBe(colors.indexOf('bg-alpha') - 1);
      expect(colors.slice(colors.indexOf('bg-red-50'), colors.indexOf('bg-red-50') + 3)).toEqual([
        'bg-red-50',
        'bg-red-100',
        'bg-red-200'
      ]);
    });

    it('orders sizes by their value, with project tokens among the defaults', async () => {
      const { result } = await load(
        '@import "tailwindcss"; @theme { --spacing-18: 4.5rem; --text-2xs: 0.625rem; --breakpoint-xs: 20rem; }'
      );
      const padding = classes(result, 'padding');
      expect(padding.slice(0, 5)).toEqual(['p-0', 'p-px', 'p-0.5', 'p-1', 'p-1.5']);
      expect(padding.slice(padding.indexOf('p-16'), padding.indexOf('p-16') + 3)).toEqual(['p-16', 'p-18', 'p-20']);
      expect(classes(result, 'spacing').slice(0, 3)).toEqual(['--spacing', 'p-0', 'p-px']);
      expect(classes(result, 'font-size')[0]).toBe('text-2xs');
      expect(classes(result, 'breakpoints')[0]).toBe('--breakpoint-xs');
      // a unitless line height is a multiple of the 16px base, and ties keep the theme order
      const leading = classes(result, 'line-height');
      expect(leading.slice(0, 3)).toEqual(['leading-0', 'leading-px', 'leading-0.5']);
      expect(leading.indexOf('leading-none')).toBe(leading.indexOf('leading-4') + 1);
      expect(leading.filter((c) => /^leading-([5-8]|tight|snug|normal|relaxed|loose)$/.test(c ?? ''))).toEqual([
        'leading-5',
        'leading-tight',
        'leading-snug',
        'leading-6',
        'leading-normal',
        'leading-relaxed',
        'leading-7',
        'leading-8',
        'leading-loose'
      ]);
      // values that need the frame to compute come after the others, in class-list order
      const width = classes(result, 'width');
      expect(width.indexOf('w-auto')).toBeGreaterThan(width.indexOf('w-96'));
      expect(width.indexOf('w-auto')).toBeGreaterThan(width.indexOf('w-7xl'));
      expect(width.indexOf('w-px')).toBe(width.indexOf('w-0') + 1);
    });

    it('orders radii computed with calc() sums among the defaults', async () => {
      const { result } = await load(
        '@import "tailwindcss";\n:root { --radius: 0.625rem; }\n@theme inline { --radius-sm: calc(var(--radius) - 4px);' +
          ' --radius-md: calc(var(--radius) - 2px); --radius-lg: var(--radius); --radius-xl: calc(var(--radius) + 4px); }'
      );
      expect(classes(result, 'border-radius')).toEqual(
        ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'].map((size) => `rounded-${size}`)
      );
    });

    it('orders a unitless project opacity among the percentages', async () => {
      const { result } = await load('@import "tailwindcss"; @theme { --opacity-disabled: 0.4; }');
      const opacity = classes(result, 'opacity');
      expect(opacity[0]).toBe('opacity-0');
      expect(opacity.slice(opacity.indexOf('opacity-40'), opacity.indexOf('opacity-40') + 3)).toEqual([
        'opacity-40',
        'opacity-disabled',
        'opacity-45'
      ]);
    });
  });

  it('drops empty categories', async () => {
    const { result } = await load('@theme { --*: initial; --color-only: red; }');
    const ids = result.categories.map((c) => c.id);
    expect(ids).toContain('background-color');
    for (const id of ['font-size', 'font-weight', 'font-family', 'letter-spacing', 'breakpoints'] as const) {
      expect(ids).not.toContain(id);
    }
  });

  it('prefixes classes and variables', async () => {
    const { result, token } = await load('@import "tailwindcss" prefix(tw);');
    expect(result.prefix).toBe('tw');
    expect(token('background-color', 'tw:bg-red-500')).toEqual({
      class: 'tw:bg-red-500',
      cssVariable: '--tw-color-red-500',
      value: expect.stringMatching(/^(oklch|#)/)
    });
    expect(token('padding', 'tw:p-4')?.value).toBe('calc(0.25rem * 4)');
    expect(token('breakpoints', null)).toEqual({ class: null, cssVariable: '--tw-breakpoint-sm', value: '40rem' });
    expect(result.categories.find((c) => c.id === 'spacing')?.tokens[0].cssVariable).toBe('--tw-spacing');
    expect(result.css).toContain('.tw\\:bg-red-500 {');
    expect(result.css).not.toMatch(/^\s*\.bg-red-500 \{/m);
    expect(result.variables).not.toHaveProperty('--tw-blur');
  });

  it('shows the values Tailwind writes for theme values that use its CSS functions', async () => {
    const theme = `
      --color-brand: oklch(0.6 0.2 250);
      --color-brand-soft: --alpha(var(--color-brand) / 50%);
      --spacing-gutter: --spacing(6);
      --spacing-wide: calc(--spacing(2) + 1px);
      --radius-card: theme(--radius-lg);
      --radius-pill: --theme(--radius-xl);`;
    const { result, token } = await load(`@import "tailwindcss";\n@theme {${theme}\n}`);
    expect(token('padding', 'p-gutter')).toEqual({
      class: 'p-gutter',
      cssVariable: '--spacing-gutter',
      value: 'calc(0.25rem * 6)'
    });
    expect(token('padding', 'p-wide')?.value).toBe('calc(calc(0.25rem * 2) + 1px)');
    expect(token('border-radius', 'rounded-card')?.value).toBe('0.5rem');
    expect(token('border-radius', 'rounded-pill')?.value).toBe('0.75rem');
    expect(token('background-color', 'bg-brand-soft')?.value).toBe(
      'color-mix(in srgb, oklch(0.6 0.2 250) 50%, transparent)'
    );
    expect(result.variables).toMatchObject({
      '--spacing-gutter': 'calc(var(--spacing) * 6)',
      '--radius-card': '0.5rem',
      '--color-brand-soft': 'color-mix(in srgb, oklch(0.6 0.2 250) 50%, transparent)'
    });
    const padding = result.categories.find((c) => c.id === 'padding')!.tokens.map((t) => t.class);
    expect(padding.indexOf('p-gutter')).toBeLessThan(padding.indexOf('p-7'));
    expect(padding.indexOf('p-gutter')).toBeGreaterThan(padding.indexOf('p-5'));

    // a project's own `:root` declaration is what the class reads, but the theme's value stays in Full config
    const overridden = await load(`@import "tailwindcss";\n@theme {${theme}\n}\n:root { --radius-card: 1px; }`);
    expect(overridden.token('border-radius', 'rounded-card')?.value).toBe('1px');
    expect(overridden.result.variables['--radius-card']).toBe('0.5rem');

    // `static` writes every variable, so the values are the same
    const fixed = await load(`@import "tailwindcss";\n@theme static {${theme}\n}`);
    expect(fixed.result.variables['--spacing-gutter']).toBe('calc(var(--spacing) * 6)');
    expect(fixed.token('padding', 'p-gutter')?.value).toBe('calc(0.25rem * 6)');
  });

  it('keeps an @theme inline value with a CSS function out of the variables Tailwind writes', async () => {
    const { result, token } = await load('@import "tailwindcss";\n@theme inline { --spacing-gutter: --spacing(6); }');
    expect(token('padding', 'p-gutter')).toEqual({
      class: 'p-gutter',
      cssVariable: null,
      value: 'calc(0.25rem * 6)'
    });
    expect(result.variables['--spacing-gutter']).toBe('--spacing(6)');
  });
});

describe('sizeOf', () => {
  it('computes lengths and calc() expressions at a 16px root', () => {
    expect(sizeOf('0 0 #0000', 'box-shadow')).toBe(0);
    expect(sizeOf('none', 'filter')).toBe(0);
    expect(sizeOf('1px', 'padding')).toBe(1);
    expect(sizeOf('-0.05em', 'letter-spacing')).toBeCloseTo(-0.8);
    expect(sizeOf('calc(0.25rem * 4)', 'padding')).toBe(16);
    expect(sizeOf('calc(infinity * 1px)', 'border-radius')).toBe(Infinity);
    expect(sizeOf('calc(0.625rem - 4px)', 'border-radius')).toBe(6);
    expect(sizeOf('calc(1rem + 2px * 3 - -4px / 2)', 'width')).toBe(24);
    expect(sizeOf('1.5', 'line-height')).toBe(24);
    expect(sizeOf('700', 'font-weight')).toBe(700);
  });

  it('gives up on values that need a browser', () => {
    for (const value of [
      '100%',
      '100vw',
      'auto',
      'calc(1 / 2 * 100%)',
      'calc(var(--x) * 2)',
      '0 1px 2px red',
      'calc(1rem -4px)',
      'calc(1rem-4px)',
      'calc(1rem - 50%)'
    ]) {
      expect(sizeOf(value, 'width')).toBeNull();
    }
  });
});

describe('scanCss', () => {
  it('scans real Tailwind output', async () => {
    const { system } = await load('@import "tailwindcss";');
    const rules = scanCss(system.candidatesToCss(['shadow-lg'])[0] ?? '');
    expect(rules).toHaveLength(1);
    expect(rules[0].selector).toBe('.shadow-lg');
    expect(rules[0].atRules).toEqual([]);
    expect(rules[0].declarations.map(([p]) => p)).toContain('box-shadow');
  });

  it('keeps at-rule ancestry and skips strings and comments', () => {
    const rules = scanCss(
      '/* { */@layer a{@media (x){.a{content:"};";background:url(data:x;y)}}}@import "z";.b{--c:1;--d:2}'
    );
    expect(rules).toEqual([
      {
        selector: '.a',
        atRules: ['@layer a', '@media (x)'],
        declarations: [
          ['content', '"};"'],
          ['background', 'url(data:x;y)']
        ]
      },
      {
        selector: '.b',
        atRules: [],
        declarations: [
          ['--c', '1'],
          ['--d', '2']
        ]
      }
    ]);
  });
});

describe('rootVariables', () => {
  it('reads :root variables from real compile() output', async () => {
    const css = '@import "tailwindcss"; :root { --primary: red; }';
    const compiler = await compile(css, { base, onDependency() {} });
    const used = rootVariables(compiler.build(['bg-red-500']));
    expect(used['--primary']).toBe('red');
    expect(used).toHaveProperty('--color-red-500');
    // build() accumulates candidates, so the empty build needs a fresh compiler
    const none = rootVariables((await compile(css, { base, onDependency() {} })).build([]));
    expect(none['--primary']).toBe('red');
    expect(none).not.toHaveProperty('--color-red-500');
  });

  it('reads :root variables only from unconditional rules', () => {
    expect(
      rootVariables(
        ':root{--a:1}\n@layer base{:root,:host{--b:2}}\n@media (x){:root{--c:3}}\n.dark{--d:4}\nhtml{--e:5}'
      )
    ).toEqual({ '--a': '1', '--b': '2', '--e': '5' });
  });

  it('keeps the variable of the rule that wins the cascade layers', () => {
    // the statement orders the layers, whatever order their blocks come in
    expect(rootVariables('@layer a, b;\n@layer b{:root{--x:1}}\n@layer a{:root{--x:2}}')).toEqual({ '--x': '1' });
    // a layer is ordered where it first appears
    expect(rootVariables('@layer b{:root{--x:1}}\n@layer a, b;\n@layer a{:root{--x:2}}')).toEqual({ '--x': '2' });
    expect(rootVariables(':root{--x:1}\n@layer a{:root{--x:2}}')).toEqual({ '--x': '1' });
    expect(rootVariables('@layer a{:root{--x:1}}\n@layer a{:root{--x:2}}')).toEqual({ '--x': '2' });
    // a layer's own rules beat its sublayers, and a sublayer is ordered with its parent
    expect(rootVariables('@layer a{:root{--x:1}@layer y{:root{--x:2}}}')).toEqual({ '--x': '1' });
    expect(rootVariables('@layer a.y{:root{--x:1}}\n@layer b{:root{--x:2}}\n@layer a{:root{--x:3}}')).toEqual({
      '--x': '2'
    });
    expect(rootVariables('@layer a{@layer y, z;}\n@layer a.z{:root{--x:1}}\n@layer a.y{:root{--x:2}}')).toEqual({
      '--x': '1'
    });
    // each anonymous layer is a layer of its own, after those before it
    expect(rootVariables('@layer{:root{--x:1}}\n@layer a{:root{--x:2}}\n@layer{:root{--x:3}}')).toEqual({ '--x': '3' });
    expect(rootVariables('@layer a{@layer{:root{--x:1}}@layer b{:root{--x:2}}@layer{:root{--x:3}}}')).toEqual({
      '--x': '3'
    });
    // a layer declared in a condition takes no place in the base order
    expect(
      rootVariables('@media print{@layer b;}\n@layer a, b;\n@layer b{:root{--x:1}}\n@layer a{:root{--x:2}}')
    ).toEqual({ '--x': '1' });
    // an `@import` with a layer declares it where it stands (Tailwind keeps an `@import url()` as written)
    expect(
      rootVariables(
        '@import url(x.css) layer(foo);\n@layer bar, foo;\n@layer foo{:root{--x:1}}\n@layer bar{:root{--x:2}}'
      )
    ).toEqual({ '--x': '2' });
    expect(
      rootVariables(
        '@import url(x.css) layer(foo) print;\n@layer bar, foo;\n@layer foo{:root{--x:1}}\n@layer bar{:root{--x:2}}'
      )
    ).toEqual({ '--x': '1' });
  });

  it('reads variables from a root selector inside :where() or :is()', () => {
    expect(rootVariables(':where(:root),[data-theme=light] { --color-base-100: oklch(100% 0 0); }')).toEqual({
      '--color-base-100': 'oklch(100% 0 0)'
    });
    expect(rootVariables(':is(html){--a:1}\n:root:not([data-theme]){--b:2}\n:where(.x){--c:3}')).toEqual({
      '--a': '1'
    });
    expect(rootVariables(':is(.dark, :where(:root), .light) .card{--a:1}\n:where(:root, .x){--b:2}')).toEqual({
      '--b': '2'
    });
  });

  it('reads variables from a rule whose selector list includes the root', () => {
    expect(rootVariables(':root,[data-theme="light"]{--a:1}\n.x,.y{--c:3}')).toEqual({ '--a': '1' });
    // names are unescaped, as `theme.entries()` gives them
    expect(rootVariables(':root{--d\\.e:4;--f\\2d g:5;--h\\2e 5:6}')).toEqual({
      '--d.e': '4',
      '--f-g': '5',
      '--h.5': '6'
    });
  });
});

describe('resolveValue', () => {
  it('resolves var() chains and survives cycles', () => {
    expect(resolveValue('var(--a)', { '--a': 'var(--b)', '--b': 'red' })).toBe('red');
    expect(resolveValue('calc(var(--s) * 4)', { '--s': '0.25rem' })).toBe('calc(0.25rem * 4)');
    expect(resolveValue('var(--x)', { '--x': 'var(--x)' })).toBe('var(--x)');
  });

  it('takes the fallback of an unknown variable', () => {
    expect(resolveValue('0 1px var(--u, rgb(0 0 0 / 0.1)), 0 2px var(--u, red)', {})).toBe(
      '0 1px rgb(0 0 0 / 0.1), 0 2px red'
    );
    expect(resolveValue('var(--a, var(--b, red))', {})).toBe('red');
    expect(resolveValue('var(--a, var(--b, red))', { '--b': 'blue' })).toBe('blue');
    expect(resolveValue('var(--a, calc(var(--s) * 2))', { '--s': '1px' })).toBe('calc(1px * 2)');
    expect(resolveValue('blur(2px) var(--tw-blur,) var(--tw-x, )', {})).toBe('blur(2px)');
    expect(resolveValue('var(--x, 1px)', { '--x': 'var(--x)' })).toBe('var(--x)');
  });

  it('keeps an unknown variable without a fallback', () => {
    expect(resolveValue('var(--u)', {})).toBe('var(--u)');
    expect(resolveValue('1px var(--u) var(--v, 2px)', {})).toBe('1px var(--u) 2px');
    expect(resolveValue('var(--x)', { '--x': 'var(--x)' })).toBe('var(--x)');
  });
});
