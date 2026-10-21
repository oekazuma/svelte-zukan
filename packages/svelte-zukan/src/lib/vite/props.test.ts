import { describe, expect, it } from 'vitest';
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
      props: [
        { name: 'variant', type: null, default: "'primary'", required: false, bindable: false, description: null },
        { name: 'disabled', type: null, default: null, required: false, bindable: false, description: null }
      ]
    });
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
