import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { normalizePath } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractProps } from './props.js';

const ts = (script: string, rest = '') => `<script lang="ts">\n${script}\n</script>\n${rest}`;

describe('extractProps', () => {
  it('reads a type literal: types, defaults, required, bindable and JSDoc', () => {
    const found = extractProps(
      ts(`  let {
    label,
    /** ignored: the type's comment wins */
    size = 'md',
    value = $bindable(0),
    open = $bindable(),
    ...rest
  }: {
    /** the visible text */
    label: string;
    /** one of the \`sizes\`
     * @default 'md'
     */
    size?: 'sm' | 'md' | 'lg';
    value?: number;
    open?: boolean;
    onclick?(event: MouseEvent): void;
  } = $props();`),
      'A.svelte'
    );
    expect(found).toEqual({
      typeName: null,
      files: [],
      props: [
        {
          name: 'label',
          type: 'string',
          default: null,
          required: true,
          bindable: false,
          description: 'the visible text'
        },
        {
          name: 'size',
          type: "'sm' | 'md' | 'lg'",
          default: "'md'",
          required: false,
          bindable: false,
          description: 'one of the <code>sizes</code>'
        },
        { name: 'value', type: 'number', default: '0', required: false, bindable: true, description: null },
        { name: 'open', type: 'boolean', default: null, required: false, bindable: true, description: null },
        {
          name: 'onclick',
          type: 'onclick?(event: MouseEvent): void',
          default: null,
          required: false,
          bindable: false,
          description: null
        }
      ]
    });
  });

  it('shows raw HTML in JSDoc as text and resolves {@link} tags', () => {
    const description = (comment: string) =>
      extractProps(ts(`  let { a }: {\n    /** ${comment} */\n    a: string;\n  } = $props();`), 'A.svelte')!.props[0]
        .description;
    expect(description('a <div> & <img src=x onerror=alert(1)> **b**')).toBe(
      'a &lt;div&gt; &amp; &lt;img src=x onerror=alert(1)&gt; <strong>b</strong>'
    );
    // marked leaves the text after `<pre>` unescaped, as it would be inside a raw HTML block
    expect(description('<pre><img src=x onerror=alert(1) **x**</pre>')).toBe(
      '&lt;pre&gt;&lt;img src=x onerror=alert(1) <strong>x</strong>&lt;/pre&gt;'
    );
    expect(description('see {@link Foo}, {@link Foo.bar the bar}, {@linkcode Baz|baz} and {@linkplain Qux}')).toBe(
      'see <code>Foo</code>, the bar, <code>baz</code> and Qux'
    );
    expect(description('{@link https://example.com/docs MDN} or {@link https://example.com}')).toBe(
      '<a href="https://example.com/docs">MDN</a> or <a href="https://example.com">https://example.com</a>'
    );
    expect(description('{@link javascript://%0aalert(1) click} {@link file:///etc/passwd}')).toBe(
      'click <code>file:///etc/passwd</code>'
    );
    expect(description('**Deprecated**: use b')).toBe('<strong>Deprecated</strong>: use b');
    expect(description('* text @deprecated')).toBe('text @deprecated');
    expect(description('* @deprecated')).toBe(null);
    expect(description('*Optional* label')).toBe('<em>Optional</em> label');
  });

  it('follows a type alias, an interface and what it extends, declared in the component', () => {
    const found = extractProps(
      ts(`  interface Base { id: string }
  interface Extra extends Base { /** shown */ hint?: string }
  type Props = Extra & { count: number };
  let { id, count = 1, hint }: Props = $props();`),
      'B.svelte'
    );
    expect(found?.props.map((p) => [p.name, p.type, p.default, p.required, p.description])).toEqual([
      ['hint', 'string', null, false, 'shown'],
      ['id', 'string', null, true, null],
      ['count', 'number', '1', false, null]
    ]);
    expect(found?.typeName).toBeNull();
  });

  it("lists a name declared twice once: the interface's own member, or the first side of an intersection", () => {
    const narrowed = extractProps(
      ts(`  interface Base { /** any look */ variant?: string; id: string }
  interface Props extends Base { variant?: 'a' | 'b' }
  let { variant = 'a', id }: Props = $props();`),
      'N.svelte'
    );
    expect(narrowed?.props.map((p) => [p.name, p.type, p.default])).toEqual([
      ['variant', "'a' | 'b'", "'a'"],
      ['id', 'string', null]
    ]);
    const both = extractProps(
      ts(`  type A = { size?: number };
  type B = { size?: 'sm'; tone?: string };
  let props: A & B = $props();`),
      'O.svelte'
    );
    expect(both?.props.map((p) => [p.name, p.type])).toEqual([
      ['size', 'number'],
      ['tone', 'string']
    ]);
  });

  it('names a type it can not see and lists what is destructured', () => {
    const found = extractProps(
      ts(`  import type { ButtonProps } from './types';
  let { variant = 'primary', disabled }: ButtonProps = $props();`),
      'C.svelte'
    );
    expect(found).toMatchObject({
      typeName: 'ButtonProps',
      props: [
        { name: 'variant', type: null, default: "'primary'", required: false, bindable: false, description: null },
        { name: 'disabled', type: null, default: null, required: false, bindable: false, description: null }
      ]
    });
  });

  it('reads a parenthesized type, and names a union it can not list', () => {
    expect(extractProps(ts('  let { a }: ({ a: number }) = $props();'), 'P.svelte')?.props[0].type).toBe('number');
    const union = extractProps(
      ts(`  type Props = { href: string } | { onclick: () => void };
  let { href, onclick }: Props = $props();`),
      'U.svelte'
    );
    expect(union?.typeName).toBe('{ href: string } | { onclick: () => void }');
    expect(union?.props.map((p) => [p.name, p.type])).toEqual([
      ['href', null],
      ['onclick', null]
    ]);
    expect(extractProps(ts('  let { a }: Foo.Props = $props();'), 'Q.svelte')?.typeName).toBe('Foo.Props');
  });

  it('is not misled by a <style> written in the script', () => {
    const source = ts(
      "  // <style> is below\n  const css = '<style>';\n  let { a }: { a: number } = $props();",
      '<style lang="scss">\n  $x: 1;\n</style>'
    );
    expect(extractProps(source, 'S.svelte')?.props[0].type).toBe('number');
  });

  it('collapses whitespace outside strings only and drops line comments', () => {
    const found = extractProps(
      ts(`  let { a = 'x   y', b = \`x
    y\`, onpick, size = // fallback
    'md' }: {
    a?: 'x   y' | "p  q";
    b?: string;
    onpick: (
      // the picked item
      item: string
    ) => void;
    size?: string;
  } = $props();`),
      'W.svelte'
    );
    expect(found?.props.map((p) => [p.name, p.type, p.default])).toEqual([
      ['a', `'x   y' | "p  q"`, "'x   y'"],
      ['b', 'string', '`x\n    y`'],
      ['onpick', '( item: string ) => void', null],
      ['size', 'string', "'md'"]
    ]);
  });

  it('merges the declarations of an interface declared twice', () => {
    const found = extractProps(
      ts(`  interface Props { a: string }
  interface Props { b: number }
  let { a, b }: Props = $props();`),
      'M.svelte'
    );
    expect(found?.props.map((p) => [p.name, p.type])).toEqual([
      ['a', 'string'],
      ['b', 'number']
    ]);
    // a later declaration narrowing what the first one extends wins, as in TypeScript
    const narrowed = extractProps(
      ts(`  interface Base { variant: string }
  interface Props extends Base { a: string }
  interface Props { variant: 'x' | 'y' }
  let { a, variant }: Props = $props();`),
      'M.svelte'
    );
    expect(narrowed?.props.map((p) => [p.name, p.type])).toEqual([
      ['a', 'string'],
      ['variant', "'x' | 'y'"]
    ]);
  });

  it('skips a computed key of the destructuring', () => {
    const found = extractProps(
      ts(`  const key = 'x';
  let { [key]: x, a, ...rest }: { x: string; a: number } = $props();`),
      'K.svelte'
    );
    expect(found?.props.map((p) => p.name)).toEqual(['x', 'a']);
  });

  it('reads untyped props and a module script declaration', () => {
    expect(extractProps('<script>\n  let { a = 1, b } = $props();\n</script>', 'D.svelte')?.props).toEqual([
      { name: 'a', type: null, default: '1', required: false, bindable: false, description: null },
      { name: 'b', type: null, default: null, required: false, bindable: false, description: null }
    ]);
    const mod = '<script module lang="ts">\n  export type Props = { x: number };\n</script>\n';
    expect(extractProps(mod + ts('  let { x }: Props = $props();'), 'E.svelte')?.props[0].type).toBe('number');
  });

  it('returns null without $props or when the file does not parse', () => {
    expect(extractProps(ts('  let a = 1;'), 'F.svelte')).toBeNull();
    expect(extractProps('<p>static</p>', 'G.svelte')).toBeNull();
    expect(extractProps('<script lang="ts">\n  let {', 'H.svelte')).toBeNull();
  });

  it('handles CRLF and a preprocessed <style>', () => {
    const source = ts(
      '  let { a }: {\r\n    /** one\r\n     * two */\r\n    a: number;\r\n  } = $props();',
      '<style lang="scss">\n  $x: 1;\n  .a { b: $x; }\n</style>'
    );
    expect(extractProps(source, 'I.svelte')?.props[0]).toMatchObject({
      name: 'a',
      type: 'number',
      description: 'one\ntwo'
    });
  });

  it('handles a byte order mark', () => {
    const found = extractProps('\uFEFF' + ts("  let { label = 'hi' }: { label?: string } = $props();"), 'BOM.svelte');
    expect(found?.props.map((p) => [p.type, p.default])).toEqual([['string', "'hi'"]]);
  });

  it('does not take a <style> in an attribute for a style block', () => {
    const source = ts('  let { a }: { a: number } = $props();', '<p data-x="<style>">x</p>\n<style>p{}</style>');
    expect(extractProps(source, 'Y.svelte')?.props[0].type).toBe('number');
  });
});

describe('extractProps with imported types', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = normalizePath(realpathSync(mkdtempSync(join(tmpdir(), 'zukan-props-'))));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));
  const write = (rel: string, content: string) => {
    mkdirSync(dirname(join(tmp, rel)), { recursive: true });
    writeFileSync(join(tmp, rel), content);
    return `${tmp}/${rel}`;
  };
  const component = (script: string) => write('lib/Button.svelte', ts(script));
  const read = (file: string) => extractProps(readFileSync(file, 'utf8'), file);

  it('follows a type imported from a relative .ts file, under an alias, with its JSDoc', () => {
    const types = write(
      'lib/types.ts',
      "import type { Base } from './base';\nexport interface ButtonProps extends Base {\n  /** the look */\n  variant?: 'primary' | 'ghost';\n}\n"
    );
    const base = write('lib/base.ts', 'export type Base = { id: string };\n');
    const file = component(
      "  import type { ButtonProps as P } from './types.js';\n  let { variant = 'primary', id }: P = $props();"
    );
    const found = read(file)!;
    expect(found.props.map((p) => [p.name, p.type, p.default, p.required, p.description])).toEqual([
      ['variant', "'primary' | 'ghost'", "'primary'", false, 'the look'],
      ['id', 'string', null, true, null]
    ]);
    expect(found.typeName).toBeNull();
    expect(found.files.sort()).toEqual([base, types].sort());
  });

  it("reads another component's <script module> with a byte order mark", () => {
    write(
      'lib/Field.svelte',
      "\uFEFF<script module lang=\"ts\">\n  export type FieldProps = { size: 'a' | 'b' };\n</script>\n"
    );
    const file = component(
      "  import type { FieldProps } from './Field.svelte';\n  let { size }: FieldProps = $props();"
    );
    expect(read(file)!.props[0].type).toBe("'a' | 'b'");
  });

  it("reads another component's <script module> and an index.ts", () => {
    write('lib/Field.svelte', '<script module lang="ts">\n  export type FieldProps = { label: string };\n</script>\n');
    write('lib/shared/index.ts', 'export type Extra = { hint?: string };\n');
    const file = component(
      "  import type { FieldProps } from './Field.svelte';\n  import type { Extra } from './shared';\n  let { label, hint }: FieldProps & Extra = $props();"
    );
    expect(read(file)!.props.map((p) => [p.name, p.type])).toEqual([
      ['label', 'string'],
      ['hint', 'string']
    ]);
  });

  it('names what it can not read: a package type, a missing file, a broken file', () => {
    const broken = write('lib/broken.ts', 'export type Broken = {');
    const file = component(
      "  import type { HTMLButtonAttributes } from 'svelte/elements';\n  import type { Gone } from './gone';\n  import type { Broken } from './broken';\n  let { a }: HTMLButtonAttributes & Gone & Broken = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('HTMLButtonAttributes, Gone, Broken');
    expect(found.props.map((p) => p.name)).toEqual(['a']);
    // fixing the broken file or creating the missing one refreshes the props
    expect(found.files.sort()).toEqual(
      [broken, ...['gone.ts', 'gone.d.ts', 'gone/index.ts', 'gone/index.d.ts'].map((f) => `${tmp}/lib/${f}`)].sort()
    );
  });

  it('reads a .ts file with </script> in a comment or a string', () => {
    write('lib/types.ts', "/** wraps in `</script>` */\nexport type Props = { a: string; b?: '</SCRIPT>' };\n");
    const file = component("  import type { Props } from './types';\n  let { a, b }: Props = $props();");
    expect(read(file)!.props.map((p) => [p.name, p.type])).toEqual([
      ['a', 'string'],
      ['b', "'</SCRIPT>'"]
    ]);
  });

  it('reads the .svelte.d.ts that svelte-package writes, and a .svelte.ts module', () => {
    write(
      'node_modules/my-ui/package.json',
      JSON.stringify({ exports: { '.': { types: './dist/index.d.ts', svelte: './dist/index.js' } } })
    );
    write(
      'node_modules/my-ui/dist/index.d.ts',
      "export { default as Button, type ButtonProps } from './Button.svelte';\nexport { default as Section } from './Section.svelte';\n"
    );
    write(
      'node_modules/my-ui/dist/Button.svelte',
      "<script>\n  let { variant = 'primary', label } = $props();\n</script>\n"
    );
    write(
      'node_modules/my-ui/dist/Button.svelte.d.ts',
      `export type ButtonProps = {
    /** the look */
    variant?: 'primary' | 'secondary';
    label: string;
};
declare const Button: import("svelte").Component<ButtonProps, {}, "">;
type Button = ReturnType<typeof Button>;
export default Button;
`
    );
    write('node_modules/my-ui/dist/Section.svelte', '<script>\n  let { title, children } = $props();\n</script>\n');
    // as svelte-package writes `packages/svelte-zukan/dist/Section.svelte.d.ts`
    write(
      'node_modules/my-ui/dist/Section.svelte.d.ts',
      `import { type Snippet } from 'svelte';
type $$ComponentProps = {
    title: string;
    children?: Snippet;
};
declare const Section: import("svelte").Component<$$ComponentProps, {}, "">;
type Section = ReturnType<typeof Section>;
export default Section;
`
    );
    const stateful = write('lib/stateful.svelte.ts', 'export interface Props { /** st */ s: string }\n');
    const file = component(
      "  import type { ComponentProps } from 'svelte';\n  import type { ButtonProps, Section } from 'my-ui';\n  import type { Props } from './stateful.svelte';\n  let { variant, label, s, title, children }: ButtonProps & Props & ComponentProps<typeof Section> = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('ButtonProps, ComponentProps<typeof Section>');
    expect(found.props.map((p) => [p.name, p.type, p.description])).toEqual([
      ['s', 'string', 'st'],
      ['variant', "'primary' | 'secondary'", 'the look'],
      ['label', 'string', null],
      ['title', 'string', null],
      ['children', 'Snippet', null]
    ]);
    expect(found.files).toEqual([stateful]);
  });

  it('reads the .d.ts of a .js subpath of a package without exports', () => {
    write('node_modules/noexp/package.json', JSON.stringify({ types: 'dist/index.d.ts' }));
    write('node_modules/noexp/dist/types.d.ts', 'export interface NProps { /** n */ n?: number }\n');
    const file = component("  import type { NProps } from 'noexp/dist/types.js';\n  let { n }: NProps = $props();");
    expect(read(file)!.props.map((p) => [p.name, p.type, p.description])).toEqual([['n', 'number', 'n']]);
  });

  it('follows a type exported under another name', () => {
    write(
      'lib/types.ts',
      "type Inner = {\n  /** the text */\n  label: string;\n};\nexport { Inner as Props };\nimport type { Base } from './base';\nexport type { Base as Extra };\n"
    );
    write('lib/base.ts', 'export type Base = { tone?: string };\n');
    const file = component(
      "  import type { Props, Extra } from './types';\n  let { label, tone }: Props & Extra = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBeNull();
    expect(found.props.map((p) => [p.name, p.type, p.description])).toEqual([
      ['label', 'string', 'the text'],
      ['tone', 'string', null]
    ]);
  });

  it('reads an index.d.ts of a folder', () => {
    write('lib/types/index.d.ts', 'export interface Props { size?: number }\n');
    const file = component("  import type { Props } from './types';\n  let { size }: Props = $props();");
    const found = read(file)!;
    expect(found.props.map((p) => [p.name, p.type])).toEqual([['size', 'number']]);
    // creating a file that comes first refreshes the props too
    expect(found.files.sort()).toEqual(
      ['types.ts', 'types.d.ts', 'types/index.ts', 'types/index.d.ts'].map((f) => `${tmp}/lib/${f}`).sort()
    );
  });

  it('types the destructured props of a package type, and only those', () => {
    write('node_modules/ui/package.json', JSON.stringify({ exports: { './elements': { types: './elements.d.ts' } } }));
    write(
      'node_modules/ui/elements.d.ts',
      `export interface DOMAttributes<T extends EventTarget> {
  children?: import('svelte').Snippet;
  onclick?: (e: MouseEvent & { currentTarget: T }) => void;
}
export interface HTMLAttributes<T extends EventTarget> extends DOMAttributes<T> {
  class?: string | undefined | null;
  title?: string | undefined | null;
}
export interface HTMLButtonAttributes extends HTMLAttributes<HTMLButtonElement> {
  /** blocks the button */
  disabled?: boolean | undefined | null;
}
`
    );
    const file = component(
      "  import type { HTMLButtonAttributes } from 'ui/elements';\n  let {\n    label,\n    /** the label */\n    children,\n    /** ignored: the package's comment wins */\n    disabled = false,\n    class: className,\n    ...rest\n  }: HTMLButtonAttributes & { label: string } = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('HTMLButtonAttributes');
    expect(found.props).toEqual([
      { name: 'label', type: 'string', default: null, required: true, bindable: false, description: null },
      {
        name: 'disabled',
        type: 'boolean | undefined | null',
        default: 'false',
        required: false,
        bindable: false,
        description: 'blocks the button'
      },
      {
        name: 'class',
        type: 'string | undefined | null',
        default: null,
        required: false,
        bindable: false,
        description: null
      },
      { name: 'children', type: 'Snippet', default: null, required: false, bindable: false, description: 'the label' }
    ]);
    // a package does not change while the dev server runs
    expect(found.files).toEqual([]);
  });

  it('reads a workspace package afresh and reports its files, like the project files', () => {
    write(
      'packages/ui/package.json',
      JSON.stringify({ name: '@acme/ui', exports: { '.': { types: './src/index.ts' } } })
    );
    const types = write('packages/ui/src/index.ts', 'export type UiProps = { size?: number };\n');
    mkdirSync(join(tmp, 'node_modules/@acme'), { recursive: true });
    // a junction, as pnpm links a workspace package on Windows
    symlinkSync(join(tmp, 'packages/ui'), join(tmp, 'node_modules/@acme/ui'), 'junction');
    const file = component("  import type { UiProps } from '@acme/ui';\n  let { size }: UiProps = $props();");
    expect(read(file)!.props.map((p) => [p.name, p.type])).toEqual([['size', 'number']]);
    writeFileSync(types, 'export type UiProps = { size?: string };\n');
    const found = read(file)!;
    expect(found.props.map((p) => [p.name, p.type])).toEqual([['size', 'string']]);
    expect(found.files).toEqual([types]);
  });

  it('reads the types entry of a package root and leaves a package without types untyped', () => {
    write('node_modules/plain/package.json', JSON.stringify({ types: './index.d.ts' }));
    write('node_modules/plain/index.d.ts', 'export type Props = { size?: number; color?: string };\n');
    write('node_modules/js-only/package.json', JSON.stringify({ exports: { '.': './index.js' } }));
    const file = component(
      "  import type { Props } from 'plain';\n  import type { Other } from 'js-only';\n  let {\n    size,\n    /** the space between */\n    gap\n  }: Props & Other = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('Props, Other');
    expect(found.props.map((p) => [p.name, p.type, p.description])).toEqual([
      ['size', 'number', null],
      ['gap', null, 'the space between']
    ]);
  });

  it('reads the declaration file next to a JavaScript entry of exports, as TypeScript does', () => {
    write('node_modules/conds/package.json', JSON.stringify({ exports: { '.': { import: './dist/index.mjs' } } }));
    write('node_modules/conds/dist/index.d.mts', 'export type CondsProps = { open?: boolean };\n');
    write('node_modules/single/package.json', JSON.stringify({ exports: './index.js', types: './other.d.ts' }));
    write('node_modules/single/index.d.ts', 'export type SingleProps = { count?: number };\n');
    const file = component(
      "  import type { CondsProps } from 'conds';\n  import type { SingleProps } from 'single';\n  let { open, count }: CondsProps & SingleProps = $props();"
    );
    expect(read(file)!.props.map((p) => [p.name, p.type])).toEqual([
      ['open', 'boolean'],
      ['count', 'number']
    ]);
  });

  it('resolves a pattern in exports and an .mjs re-export of a declaration file', () => {
    write(
      'node_modules/kit/package.json',
      JSON.stringify({
        exports: { './*': { types: './dist/*.d.ts' }, './forms/*.js': { types: './dist/forms/*/index.d.mts' } }
      })
    );
    write('node_modules/kit/dist/card.d.ts', 'export type CardProps = { padded?: boolean };\n');
    write('node_modules/kit/dist/forms/field/index.d.mts', "export type { FieldProps } from './props.mjs';\n");
    write('node_modules/kit/dist/forms/field/props.d.mts', 'export type FieldProps = { label?: string };\n');
    const file = component(
      "  import type { CardProps } from 'kit/card';\n  import type { FieldProps } from 'kit/forms/field.js';\n  let { padded, label }: CardProps & FieldProps = $props();"
    );
    expect(read(file)!.props.map((p) => [p.name, p.type])).toEqual([
      ['padded', 'boolean'],
      ['label', 'string']
    ]);
  });

  it('follows the re-exports of a barrel', () => {
    const button = write('lib/button.ts', 'export type ButtonProps = { label: string };\n');
    const extra = write('lib/extra.ts', 'export type Extra = { hint?: string };\n');
    const inner = write('lib/inner.ts', 'export type Inner = { size: number };\n');
    const index = write(
      'lib/types/index.ts',
      "export type { ButtonProps } from '../button';\nexport * from '../extra';\nexport type { Inner as Sized } from '../inner';\n"
    );
    const file = component(
      "  import type { ButtonProps, Extra, Sized } from './types';\n  let { label, hint, size }: ButtonProps & Extra & Sized = $props();"
    );
    const found = read(file)!;
    expect(found.props.map((p) => [p.name, p.type])).toEqual([
      ['label', 'string'],
      ['hint', 'string'],
      ['size', 'number']
    ]);
    expect(found.typeName).toBeNull();
    expect(found.files.sort()).toEqual(
      [button, extra, inner, index, `${tmp}/lib/types.ts`, `${tmp}/lib/types.d.ts`].sort()
    );
  });

  it('takes through `export *` only a name the file exports, not one it imports for itself', () => {
    write('lib/private.ts', 'export type Props = { wrong: string };\n');
    write('lib/first.ts', "import type { Props } from './private';\nexport type First = Props & { first: boolean };\n");
    write('lib/second.ts', 'export type Props = { right: string };\n');
    write('lib/types/index.ts', "export * from '../first';\nexport * from '../second';\n");
    const file = component("  import type { Props } from './types';\n  let { right }: Props = $props();");
    expect(read(file)!.props.map((p) => p.name)).toEqual(['right']);
  });

  it('reads @types/<name> for a package without types of its own, installed or not', () => {
    write('node_modules/untyped/package.json', JSON.stringify({ main: './index.js' }));
    write('node_modules/@types/untyped/package.json', JSON.stringify({ types: './index.d.ts' }));
    write('node_modules/@types/untyped/index.d.ts', 'export type UProps = { u?: number };\n');
    write('node_modules/@types/scope__lib/package.json', '{}');
    write('node_modules/@types/scope__lib/index.d.ts', 'export type SProps = { s?: string };\n');
    const file = component(
      "  import type { UProps } from 'untyped';\n  import type { SProps } from '@scope/lib';\n  let { u, s }: UProps & SProps = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('UProps, SProps');
    expect(found.props.map((p) => [p.name, p.type])).toEqual([
      ['u', 'number'],
      ['s', 'string']
    ]);
    expect(found.files).toEqual([]);
  });

  it('reads the .d.ts next to main, and a folder subpath of a package without exports', () => {
    write('node_modules/mainonly/package.json', JSON.stringify({ main: 'lib/index.js' }));
    write('node_modules/mainonly/lib/index.d.ts', 'export type MProps = { m?: number };\n');
    write('node_modules/folders/package.json', '{}');
    write('node_modules/folders/sub/index.d.ts', 'export type FProps = { f?: boolean };\n');
    const file = component(
      "  import type { MProps } from 'mainonly';\n  import type { FProps } from 'folders/sub';\n  let { m, f }: MProps & FProps = $props();"
    );
    expect(read(file)!.props.map((p) => [p.name, p.type])).toEqual([
      ['m', 'number'],
      ['f', 'boolean']
    ]);
  });

  it('reads an interface exported as the default', () => {
    write('lib/props.ts', 'export default interface Props {\n  /** d */\n  d: string;\n}\n');
    const file = component("  import type Props from './props';\n  let { d }: Props = $props();");
    const found = read(file)!;
    expect(found.typeName).toBeNull();
    expect(found.props.map((p) => [p.name, p.type, p.description])).toEqual([['d', 'string', 'd']]);
  });

  it('reads a type through a namespace import', () => {
    write('lib/types.ts', 'export type Props = { n: number };\n');
    write('node_modules/ns/package.json', JSON.stringify({ types: './index.d.ts' }));
    write('node_modules/ns/index.d.ts', 'export type Attrs = { title?: string };\n');
    const file = component(
      "  import type * as T from './types';\n  import type * as E from 'ns';\n  interface Props extends T.Props { k: string }\n  let { k, n, title }: Props & E.Attrs = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('E.Attrs');
    expect(found.props.map((p) => [p.name, p.type])).toEqual([
      ['k', 'string'],
      ['n', 'number'],
      ['title', 'string']
    ]);
  });

  it('expands Omit and Pick over a type it reads, and names them over a package type', () => {
    write('lib/types.ts', 'export type Base = { a: string; b?: number; c: boolean };\n');
    const file = component(
      "  import type { Base } from './types';\n  interface Props extends Omit<Base, 'a' | 'c'> {}\n  let { a, b, c, x }: Props & Omit<Base, 'a'> & Pick<{ x: 1; y: 2 }, 'x'> = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBeNull();
    expect(found.props.map((p) => [p.name, p.type, p.required])).toEqual([
      ['b', 'number', false],
      ['c', 'boolean', true],
      ['x', '1', true],
      ['a', null, false]
    ]);
    write('node_modules/ui/package.json', JSON.stringify({ types: './index.d.ts' }));
    write('node_modules/ui/index.d.ts', 'export interface Attrs { title?: string; type?: string }\n');
    const pkg = component(
      "  import type { Attrs } from 'ui';\n  let { title, label }: Omit<Attrs, 'type'> & { label: string } = $props();"
    );
    const named = read(pkg)!;
    expect(named.typeName).toBe("Omit<Attrs, 'type'>");
    expect(named.props.map((p) => [p.name, p.type])).toEqual([
      ['label', 'string'],
      ['title', null]
    ]);
  });

  it('reads ComponentProps<typeof X> of a source component', () => {
    const field = write(
      'lib/Field.svelte',
      ts("  let { label, size = 'md' }: { /** l */ label: string; size?: 'sm' | 'md' } = $props();")
    );
    const file = component(
      "  import type { ComponentProps } from 'svelte';\n  import Field from './Field.svelte';\n  let { label, size }: ComponentProps<typeof Field> = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBeNull();
    expect(found.props.map((p) => [p.name, p.type, p.description])).toEqual([
      ['label', 'string', 'l'],
      ['size', "'sm' | 'md'", null]
    ]);
    expect(found.files).toContain(field);
  });

  it('stops at types that refer to each other', () => {
    write('lib/a.ts', "import type { B } from './b';\nexport type A = B & { a: number };\n");
    write('lib/b.ts', "import type { A } from './a';\nexport type B = A & { b: number };\n");
    const file = component("  import type { A } from './a';\n  let { a, b }: A = $props();");
    expect(
      read(file)!
        .props.map((p) => p.name)
        .sort()
    ).toEqual(['a', 'b']);
  });
});
