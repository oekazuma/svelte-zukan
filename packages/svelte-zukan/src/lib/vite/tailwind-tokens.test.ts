import { __unstable__loadDesignSystem, compile } from '@tailwindcss/node';
import { describe, expect, it } from 'vitest';
import type { TailwindCategoryId } from '../types.js';
import { extractTokens, resolveValue, rootVariables, scanCss, type DesignSystemLike } from './tailwind-tokens.js';

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
});

describe('resolveValue', () => {
  it('resolves var() chains and survives cycles', () => {
    expect(resolveValue('var(--a)', { '--a': 'var(--b)', '--b': 'red' })).toBe('red');
    expect(resolveValue('calc(var(--s) * 4)', { '--s': '0.25rem' })).toBe('calc(0.25rem * 4)');
    expect(resolveValue('var(--x)', { '--x': 'var(--x)' })).toBe('var(--x)');
    expect(resolveValue('var(--u, 1px)', {})).toBe('var(--u, 1px)');
  });
});
