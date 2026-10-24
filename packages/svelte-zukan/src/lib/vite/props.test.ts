import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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

  it('names a type it can not see and lists what is destructured', () => {
    const found = extractProps(
      ts(`  import type { ButtonProps } from './types';
  let { variant = 'primary', disabled }: ButtonProps = $props();`),
      'C.svelte'
    );
    expect(found).toEqual({
      typeName: 'ButtonProps',
      files: [],
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
    write('lib/broken.ts', 'export type Broken = {');
    const file = component(
      "  import type { HTMLButtonAttributes } from 'svelte/elements';\n  import type { Gone } from './gone';\n  import type { Broken } from './broken';\n  let { a }: HTMLButtonAttributes & Gone & Broken = $props();"
    );
    const found = read(file)!;
    expect(found.typeName).toBe('HTMLButtonAttributes');
    expect(found.props.map((p) => p.name)).toEqual(['a']);
    expect(found.files).toEqual([]);
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
    expect(found.files.sort()).toEqual([button, extra, inner, index].sort());
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
