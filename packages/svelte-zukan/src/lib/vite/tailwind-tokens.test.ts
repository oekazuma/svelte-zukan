import { __unstable__loadDesignSystem, compile } from '@tailwindcss/node';
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
  const built = (await compile(css, { base, onDependency() {} })).build([]);
  const result = extractTokens(system, rootVariables(built));
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

  it('reads the same tokens with important', async () => {
    const plain = await load('@import "tailwindcss";');
    const important = await load('@import "tailwindcss" important;');
    expect(important.result.categories).toEqual(plain.result.categories);
  });

  it('names an @theme inline token after its own variable when another one shares its value and suffix', async () => {
    const { token } = await load('@import "tailwindcss";\n@theme inline { --spacing-xs: 0.75rem; }');
    expect(token('padding', 'p-xs')?.cssVariable).toBe('--spacing-xs');
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
    expect(result.classes).toContain('tw:bg-red-500');
    expect(result.classes).not.toContain('bg-red-500');
  });
});

describe('sizeOf', () => {
  it('computes lengths and calc() products at a 16px root', () => {
    expect(sizeOf('0 0 #0000', 'box-shadow')).toBe(0);
    expect(sizeOf('none', 'filter')).toBe(0);
    expect(sizeOf('1px', 'padding')).toBe(1);
    expect(sizeOf('-0.05em', 'letter-spacing')).toBeCloseTo(-0.8);
    expect(sizeOf('calc(0.25rem * 4)', 'padding')).toBe(16);
    expect(sizeOf('calc(infinity * 1px)', 'border-radius')).toBe(Infinity);
    expect(sizeOf('1.5', 'line-height')).toBe(24);
    expect(sizeOf('700', 'font-weight')).toBe(700);
  });

  it('gives up on values that need a browser', () => {
    for (const value of ['100%', '100vw', 'auto', 'calc(1 / 2 * 100%)', 'calc(var(--x) * 2)', '0 1px 2px red']) {
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

  it('reads variables from a rule whose selector list includes the root', () => {
    expect(rootVariables(':root,[data-theme="light"]{--a:1}\n:where(:root){--b:2}\n.x,.y{--c:3}')).toEqual({
      '--a': '1',
      '--b': '2'
    });
    // names are unescaped, as `theme.entries()` gives them
    expect(rootVariables(':root{--d\\.e:4}')).toEqual({ '--d.e': '4' });
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
