import { compile } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
import { extractSections, transformZukan } from './extract.js';

const FILE = 'Button.zukan.svelte';

describe('extractSections', () => {
  it('extracts title and dedented body', () => {
    const source = `<Section title="基本">
    <Button>押す</Button>
  </Section>`;
    expect(extractSections(source, FILE)).toEqual([{ title: '基本', code: '<Button>押す</Button>' }]);
  });

  it('prepends referenced definitions in source order', () => {
    const source = `<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button.svelte';
  import Icon from '../Icon.svelte';

  let count = $state(0);
  const label = $derived(\`\${count}\`);
  let unused = 1;
</script>

<Section title="基本">
  <Button onclick={() => count++}>{label}</Button>
</Section>`;
    expect(extractSections(source, FILE)).toEqual([
      {
        title: '基本',
        code: `<script lang="ts">
  import Button from '../Button.svelte';
  let count = $state(0);
  const label = $derived(\`\${count}\`);
</script>

<Button onclick={() => count++}>{label}</Button>`
      }
    ]);
  });

  it('keeps lang only when the source script has it', () => {
    const source = `<script>
  import Button from '../Button.svelte';
</script>

<Section title="a"><Button /></Section>`;
    expect(extractSections(source, FILE)[0].code).toBe(
      `<script>\n  import Button from '../Button.svelte';\n</script>\n\n<Button />`
    );
  });

  it('collects identifiers from directives', () => {
    const source = `<script lang="ts">
  import { tooltip } from './tooltip';
  let text = $state('');
  let active = true;
  let other = 1;
</script>

<Section title="a">
  <input use:tooltip bind:value={text} class:active />
</Section>`;
    const { code } = extractSections(source, FILE)[0];
    expect(code).toContain("import { tooltip } from './tooltip';");
    expect(code).toContain("let text = $state('');");
    expect(code).toContain('let active = true;');
    expect(code).not.toContain('other');
  });

  it('dedents mixed indentation by common prefix', () => {
    const source = '<Section title="a">\n\t\t<A />\n\n\t\t\t<B />\n</Section>';
    expect(extractSections(source, FILE)[0].code).toBe('<A />\n\n\t<B />');
  });

  it('returns [] when no sections', () => {
    expect(extractSections('<p>hi</p>', FILE)).toEqual([]);
  });

  it('throws on dynamic title', () => {
    const source = '<script>let x = "a";</script>\n\n<Section title={x}><A /></Section>';
    expect(() => extractSections(source, FILE)).toThrow(/Button\.zukan\.svelte:3/);
  });

  it('throws on duplicate title', () => {
    const source = '<Section title="a"><A /></Section>\n<Section title="a"><B /></Section>';
    expect(() => extractSections(source, FILE)).toThrow(/Button\.zukan\.svelte:2/);
  });

  it('throws on nested Section', () => {
    const nested = '<Section title="a">\n<Section title="b"><A /></Section>\n</Section>';
    expect(() => extractSections(nested, FILE)).toThrow(/Button\.zukan\.svelte:2/);
    const inIf = '<p></p>\n{#if true}\n<Section title="a"><A /></Section>\n{/if}';
    expect(() => extractSections(inIf, FILE)).toThrow(/Button\.zukan\.svelte:3/);
  });
});

describe('transformZukan', () => {
  const withScripts = `<script module lang="ts">export const x = 1;</script>
<script lang="ts">
  import Button from '../Button.svelte';
</script>

<Section title="a"><Button /></Section>
`;

  it('appends to existing module script and compiles', () => {
    const { code: out } = transformZukan(withScripts, FILE, null);
    expect(() => compile(out, { filename: FILE, generate: 'client' })).not.toThrow();
    expect(out.match(/export const __zukan =/g)).toHaveLength(1);
    expect(out).toContain('\\u003c/script>');
    expect(out.split('\n')).toHaveLength(withScripts.split('\n').length);
  });

  it('inserts at module content start', () => {
    const source = `<script module>export const x = 1; // comment</script>\n\n<Section title="a"><A /></Section>`;
    const { code: out } = transformZukan(source, FILE, null);
    expect(compile(out, { filename: FILE, generate: 'client' }).js.code).toContain('__zukan');
  });

  it('returns a source map', () => {
    const { map } = transformZukan(withScripts, FILE, null);
    expect(map.sources).toEqual([FILE]);
    expect(map.sourcesContent?.[0]).toBe(withScripts);
    expect(map.mappings).not.toBe('');
  });

  it('adds module script when missing', () => {
    const source = '<Section title=\'a "b" 日本語\'><A /></Section>\n';
    const { code: out } = transformZukan(source, FILE, '<p>x</p>');
    expect(out.startsWith(source)).toBe(true);
    const json = out.slice(source.length).match(/export const __zukan = (.*);<\/script>/)![1];
    expect(JSON.parse(json)).toEqual({
      sections: [{ title: 'a "b" 日本語', code: '<A />' }],
      doc: '<p>x</p>'
    });
  });
});
