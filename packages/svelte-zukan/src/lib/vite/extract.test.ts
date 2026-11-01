import { describe, expect, it } from 'vitest';
import { extractSections } from './extract.js';

const FILE = 'Button.zukan.svelte';

describe('extractSections', () => {
  it('extracts title and dedented body', () => {
    const source = `<Section title="Basic">
    <Button>Press</Button>
  </Section>`;
    expect(extractSections(source, FILE)).toEqual([{ title: 'Basic', code: '<Button>Press</Button>' }]);
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

<Section title="Basic">
  <Button onclick={() => count++}>{label}</Button>
</Section>`;
    expect(extractSections(source, FILE)).toEqual([
      {
        title: 'Basic',
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

  it('collects a style: shorthand directive', () => {
    const source = `<script>
  let color = 'red';
  let other = 1;
</script>

<Section title="a"><p style:color>x</p></Section>`;
    const { code } = extractSections(source, FILE)[0];
    expect(code).toContain("let color = 'red';");
    expect(code).not.toContain('other');
  });

  it('includes a store the section reads with $', () => {
    const source = `<script>
  import { writable } from 'svelte/store';
  const count = writable(1);
  const doubled = $derived($count * 2);
</script>

<Section title="direct"><p>{$count}</p></Section>
<Section title="derived"><p>{doubled}</p></Section>`;
    for (const { code } of extractSections(source, FILE)) {
      expect(code).toContain("import { writable } from 'svelte/store';");
      expect(code).toContain('const count = writable(1);');
    }
  });

  it('does not take a rune for a store of the same name', () => {
    const source = `<script>
  const state = $state(init());
  let count = $state(1);
  function init() {
    return {};
  }
</script>

<Section title="a"><p>{count}</p></Section>`;
    const { code } = extractSections(source, FILE)[0];
    expect(code).not.toContain('init');
    expect(code).toContain('let count = $state(1);');
  });

  it('keeps the overload signatures of a function', () => {
    const source = `<script lang="ts">
  function f(a: string): string;
  function f(a: number): number;
  function f(a: unknown) {
    return a;
  }
</script>

<Section title="a"><p>{f(1)}</p></Section>`;
    expect(extractSections(source, FILE)[0].code).toBe(`<script lang="ts">
  function f(a: string): string;
  function f(a: number): number;
  function f(a: unknown) {
    return a;
  }
</script>

<p>{f(1)}</p>`);
  });

  it('collects dotted component root', () => {
    const source = `<script>
  import * as Foo from './Foo.svelte';
  import Other from './Other.svelte';
</script>

<Section title="a"><Foo.Bar /></Section>`;
    const { code } = extractSections(source, FILE)[0];
    expect(code).toContain("import * as Foo from './Foo.svelte';");
    expect(code).not.toContain('Other');
  });

  it('collects transition and animate names', () => {
    const source = `<script>
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { unused } from './unused';
</script>

<Section title="a"><div transition:fade in:fly animate:flip></div></Section>`;
    const { code } = extractSections(source, FILE)[0];
    expect(code).toContain("import { fade, fly } from 'svelte/transition';");
    expect(code).toContain("import { flip } from 'svelte/animate';");
    expect(code).not.toContain('unused');
  });

  it('does not take member names and object keys for variables', () => {
    const source = `<script>
  const label = 'unrelated';
  const key = 'k';
  const obj = { label: 1, key };
</script>

<Section title="member"><p>{obj.label}</p></Section>
<Section title="shorthand"><A value={{ label }} /></Section>
<Section title="computed"><p>{obj[label]}</p></Section>`;
    const [member, shorthand, computed] = extractSections(source, FILE).map((s) => s.code);
    expect(member).toContain('const obj = { label: 1, key };');
    expect(member).toContain("const key = 'k';");
    expect(member).not.toContain("const label = 'unrelated';");
    expect(shorthand).toContain("const label = 'unrelated';");
    expect(shorthand).not.toContain('const obj');
    expect(computed).toContain("const label = 'unrelated';");
    expect(computed).toContain('const obj');
  });

  it('does not take an imported name, import.meta, a qualified name, an enum member or a label for a variable', () => {
    const source = `<script lang="ts">
  import { format as fmt } from './format';
  import * as NS from './ns';
  const format = 'unrelated';
  const meta = 'unrelated';
  const Type = 'unrelated';
  const A = 'unrelated';
  const outer = 'unrelated';
  const url = import.meta.url;
  let t: NS.Type;
  enum E { A }
  function f() {
    outer: for (;;) break outer;
  }
</script>

<Section title="a"><p>{fmt(url)} {t} {E.A} {f()}</p></Section>`;
    const [{ code }] = extractSections(source, FILE);
    expect(code).toContain('import { format as fmt }');
    expect(code).toContain('enum E { A }');
    expect(code).toContain('break outer');
    expect(code).not.toContain("'unrelated'");
  });

  it('keeps the lines of a template literal as written', () => {
    const source = `<script>
  const css = \`
.a {
    color: red;
}
  \`;
  const html = \`<p>
    \${css}
</p>\`;
</script>

<Section title="a">
    <div>
      <p>{\`one
  two\`}</p>
    </div>
    <Show {css} {html} />
</Section>`;
    expect(extractSections(source, FILE)[0].code).toBe(`<script>
  const css = \`
.a {
    color: red;
}
  \`;
  const html = \`<p>
    \${css}
</p>\`;
</script>

<div>
  <p>{\`one
  two\`}</p>
</div>
<Show {css} {html} />`);
  });

  it('parses a catalog file with SCSS in <style>', () => {
    const source = `<script>
  import Button from './Button.svelte';
</script>

<Section title="a"><Button /></Section>

<style lang="scss">
  $c: red;
  .a {
    color: $c;
    &:hover { color: darken($c, 10%); }
  }
</style>

<Section title="b">
  <p class="a">x</p>
</Section>`;
    expect(extractSections(source, FILE)).toEqual([
      { title: 'a', code: "<script>\n  import Button from './Button.svelte';\n</script>\n\n<Button />" },
      { title: 'b', code: '<p class="a">x</p>' }
    ]);
    // line numbers still count the blanked lines
    const dup = source.replace('title="b"', 'title="a"');
    expect(() => extractSections(dup, FILE)).toThrow(/Button\.zukan\.svelte:15 /);
  });

  it('does not take a custom element such as <style-guide> for <style>', () => {
    const source =
      '<Section title="a"><style-guide>x</style-guide></Section>\n\n<Section title="b"><B /></Section>\n\n<style>p{}</style>\n';
    expect(extractSections(source, FILE)).toEqual([
      { title: 'a', code: '<style-guide>x</style-guide>' },
      { title: 'b', code: '<B />' }
    ]);
  });

  it('does not take a <style> in a script or a comment for a style block', () => {
    const source = `<script>
  // the <style> below is SCSS
  const css = '<style>';
</script>

<!-- <style> -->
<Section title="a"><p>{css}</p></Section>

<style lang="scss">
  $c: red;
</style>`;
    expect(extractSections(source, FILE).map((s) => s.title)).toEqual(['a']);
  });

  it('does not take a <style> in an attribute for a style block', () => {
    const source = '<Section title="a"><Code code="<style>" /></Section>\n\n<style>p{}</style>\n';
    expect(extractSections(source, FILE)).toEqual([{ title: 'a', code: '<Code code="<style>" />' }]);
  });

  it('names the file and the cause when the markup does not parse', () => {
    expect(() => extractSections('<Section title="a">\n<A />', FILE)).toThrow(
      /^svelte-zukan: could not parse Button\.zukan\.svelte \(catalog files must be plain Svelte markup; preprocessor languages are only supported inside <style>\): .+/
    );
  });

  it('dedents mixed indentation by common prefix', () => {
    const source = '<Section title="a">\n\t\t<A />\n\n\t\t\t<B />\n</Section>';
    expect(extractSections(source, FILE)[0].code).toBe('<A />\n\n\t<B />');
  });

  it('detects Section imported under another name', () => {
    const source = `<script>
  import { Section as Example } from 'svelte-zukan';
</script>

<Example title="a"><A /></Example>`;
    expect(extractSections(source, FILE)).toEqual([{ title: 'a', code: '<A />' }]);
  });

  it('an own component named Section is not a section when the import is aliased', () => {
    const source = `<script>
  import { Section as Example } from 'svelte-zukan';
  import Section from './Section.svelte';
</script>

<Example title="a"><Section /></Example>`;
    expect(extractSections(source, FILE)).toEqual([
      { title: 'a', code: `<script>\n  import Section from './Section.svelte';\n</script>\n\n<Section />` }
    ]);
  });

  it('finds a Section alias imported in <script module>', () => {
    const source = `<script module>
  import { Section as Example } from 'svelte-zukan';
</script>

<Example title="A"><p>one</p></Example>`;
    expect(extractSections(source, FILE)).toEqual([{ title: 'A', code: '<p>one</p>' }]);
  });

  it('names the alias in title errors', () => {
    const source = `<script>
  import { Section as Example } from 'svelte-zukan';
</script>

<Example><p>one</p></Example>`;
    expect(() => extractSections(source, FILE)).toThrow(/<Example> needs a title/);
  });

  it('detects Section through a namespace import, with the same rules', () => {
    const source = (body: string) =>
      `<script lang="ts">\n  import * as Z from 'svelte-zukan';\n</script>\n\n<Z.Section title="A">\n  ${body}\n</Z.Section>\n`;
    expect(extractSections(source('<p>hi</p>'), FILE)).toEqual([{ title: 'A', code: '<p>hi</p>' }]);
    expect(() => extractSections(source('<Z.Section title="B" />'), FILE)).toThrow(/<Z\.Section> must not be nested/);
    expect(() => extractSections(source('<p>hi</p>') + '<Z.Section title="A" />', FILE)).toThrow(
      /duplicate <Z\.Section> title "A"/
    );
  });

  it('detects both a named and a namespace import of Section in one file', () => {
    const source = `<script lang="ts">
  import { Section } from 'svelte-zukan';
  import * as Z from 'svelte-zukan';
</script>

<Section title="A"><p>a</p></Section>
<Z.Section title="B"><p>b</p></Z.Section>`;
    expect(extractSections(source, FILE)).toEqual([
      { title: 'A', code: '<p>a</p>' },
      { title: 'B', code: '<p>b</p>' }
    ]);
    expect(() => extractSections(source.replace('title="B"', 'title="A"'), FILE)).toThrow(
      /duplicate <Z\.Section> title "A"/
    );
    expect(() => extractSections(source.replace('<p>b</p>', '<Section title="C" />'), FILE)).toThrow(
      /<Section> must not be nested/
    );
  });

  it('keeps the lines a string continued with a backslash goes on to', () => {
    const source = `<script>
  const text = 'a\\
 b';
</script>

<Section title="A"><p title={'c\\
    d'}>{text}</p>
</Section>`;
    expect(extractSections(source, FILE)[0].code).toBe(
      "<script>\n  const text = 'a\\\n b';\n</script>\n\n<p title={'c\\\n    d'}>{text}</p>"
    );
  });

  it('dedents content that starts on the <Section> line', () => {
    const source = `<Section title="A"><div>\n    <p>hi</p>\n  </div>\n</Section>`;
    expect(extractSections(source, FILE)[0].code).toBe('<div>\n  <p>hi</p>\n</div>');
  });

  it('indents the script definitions of a tab-indented file with tabs', () => {
    const source =
      '<script lang="ts">\n\timport { Section } from \'svelte-zukan\';\n\tfunction greet(name: string) {\n\t\treturn name;\n\t}\n</script>\n\n<Section title="A">\n\t<button onclick={() => greet(\'x\')}>Hi</button>\n</Section>\n';
    expect(extractSections(source, FILE)[0].code).toBe(
      '<script lang="ts">\n\tfunction greet(name: string) {\n\t\treturn name;\n\t}\n</script>\n\n<button onclick={() => greet(\'x\')}>Hi</button>'
    );
  });

  it('gives the same code for CRLF line endings', () => {
    const lf = `<script>
  import { Section } from 'svelte-zukan';
  const f = (x) => {
    return x;
  };
</script>

<Section title="A">
  <p>{f(1)}</p>
  <p>two</p>
</Section>`;
    expect(extractSections(lf.replace(/\n/g, '\r\n'), FILE)).toEqual(extractSections(lf, FILE));
  });

  it('gives a multi-line title of a CRLF file with LF line endings', () => {
    expect(extractSections('<Section title="two\r\nlines"><A /></Section>', FILE)[0].title).toBe('two\nlines');
  });

  it('reports the line of an error in a CRLF file', () => {
    expect(() => extractSections('<p></p>\r\n<Section><A /></Section>', FILE)).toThrow(/Button\.zukan\.svelte:2 /);
  });

  it('gives the same code and error lines for a file with a byte order mark', () => {
    const source = '<script>\n  const a = 1;\n</script>\n\n<Section title="A">\n  <b>{a}</b>\n</Section>';
    expect(extractSections('\uFEFF' + source, FILE)).toEqual(extractSections(source, FILE));
    expect(() => extractSections('\uFEFF<p></p>\n<Section><A /></Section>', FILE)).toThrow(/Button\.zukan\.svelte:2 /);
  });

  it('includes TypeScript types the section uses', () => {
    const source = `<script lang="ts">
  type Item = { id: number };
  const items: Item[] = [];
  type Unused = string;
</script>

<Section title="a"><List {items} /></Section>`;
    expect(extractSections(source, FILE)[0].code).toBe(
      `<script lang="ts">\n  type Item = { id: number };\n  const items: Item[] = [];\n</script>\n\n<List {items} />`
    );
  });

  it('includes an exported declaration', () => {
    const source = `<script>
  export const size = 's';
</script>

<Section title="a"><A {size} /></Section>`;
    expect(extractSections(source, FILE)[0].code).toContain(`  export const size = 's';`);
  });

  it('includes module script definitions', () => {
    const source = `<script module>
  export const sizes = ['s', 'm'];
</script>

<Section title="a">{#each sizes as s (s)}<A {s} />{/each}</Section>`;
    expect(extractSections(source, FILE)[0].code).toMatch(
      /^<script module>\n {2}export const sizes = \['s', 'm'\];\n<\/script>\n\n\{#each/
    );
  });

  it('includes top-level snippets the section renders', () => {
    const source = `<script>
  import Row from './Row.svelte';
</script>

{#snippet row(item)}
  <Row {item} />
{/snippet}

<Section title="a"><Table {row} /></Section>
<Section title="b"><Other /></Section>`;
    expect(extractSections(source, FILE)).toEqual([
      {
        title: 'a',
        code: `<script>\n  import Row from './Row.svelte';\n</script>\n\n{#snippet row(item)}\n  <Row {item} />\n{/snippet}\n\n<Table {row} />`
      },
      { title: 'b', code: '<Other />' }
    ]);
  });

  it('does not take a snippet the section declares for a top-level snippet or import of the same name', () => {
    const source = `<script lang="ts">
  import Card from './Card.svelte';
  import icon from './star.svg';
</script>

{#snippet header()}
  <h2>Default</h2>
{/snippet}

<Section title="Shared">
  <Card {header}><img src={icon} alt="" /></Card>
</Section>

<Section title="Custom">
  <Card>
    {#snippet header()}<h2>Custom</h2>{/snippet}
    {#snippet icon()}★{/snippet}
  </Card>
</Section>`;
    const code = Object.fromEntries(extractSections(source, FILE).map((s) => [s.title, s.code]));
    expect(code.Shared).toContain('<h2>Default</h2>');
    expect(code.Shared).toContain("import icon from './star.svg';");
    expect(code.Custom).toBe(
      `<script lang="ts">\n  import Card from './Card.svelte';\n</script>\n\n<Card>\n  {#snippet header()}<h2>Custom</h2>{/snippet}\n  {#snippet icon()}★{/snippet}\n</Card>`
    );
  });

  it('does not take a name the template declares for the script variable it shadows', () => {
    const source = `<script>
  import List from './List.svelte';
  let option = $state('a');
  const options = ['a', 'b'];
</script>

<Section title="radio"><input type="radio" bind:group={option} value="a" /></Section>
<Section title="each">{#each options as option, i (option)}{@const label = option + i}<p>{label}</p>{/each}</Section>
<Section title="fallback">{#each options as option}{option}{:else}{option}{/each}</Section>
<Section title="await">{#await Promise.resolve(options) then option}{option}{:catch option}{option}{/await}</Section>
<Section title="snippet">{#snippet row(option, { i = options.length })}{option}{i}{/snippet}{@render row(1, {})}</Section>
<Section title="arrow"><button onclick={(option) => console.log(option)}>x</button></Section>
<Section title="let"><List let:option>{option}</List><List let:item={option}>{option}</List></Section>`;
    const code = Object.fromEntries(extractSections(source, FILE).map((s) => [s.title, s.code]));
    expect(code.radio).toContain("let option = $state('a');");
    expect(code.each).not.toContain('let option');
    // `{:else}` does not see the item
    expect(code.fallback).toContain("let option = $state('a');");
    expect(code.await).not.toContain('let option');
    expect(code.snippet).not.toContain('let option');
    expect(code.snippet).toContain("const options = ['a', 'b'];");
    expect(code.arrow).not.toContain('<script>');
    expect(code.let).not.toContain('let option');
  });

  it('does not take a loop variable for the script variable it shadows', () => {
    const source = `<script>
  import { Section } from 'svelte-zukan';
  let item = 'x';
  let i = 0;
  let items = [1];
</script>

<Section title="of"><button onclick={() => { for (const item of items) console.log(item); }}>b</button></Section>
<Section title="in"><button onclick={() => { for (const item in items) console.log(item); }}>b</button></Section>
<Section title="for"><button onclick={() => { for (let i = 0; i < 3; i++) console.log(i); }}>b</button></Section>`;
    const code = Object.fromEntries(extractSections(source, FILE).map((s) => [s.title, s.code]));
    for (const title of ['of', 'in']) {
      expect(code[title]).toContain('<script>\n  let items = [1];\n</script>');
      expect(code[title]).not.toContain('let item ');
    }
    expect(code.for).not.toContain('<script>');
  });

  it('keeps generics on the script tag', () => {
    const source = `<script lang="ts" generics="T">
  let items: T[] = [];
</script>

<Section title="a"><A {items} /></Section>`;
    expect(extractSections(source, FILE)[0].code).toMatch(/^<script lang="ts" generics="T">\n/);
  });

  it('keeps the quotes of the script attributes', () => {
    const source = `<script lang='ts' generics='T extends "a" | "b"'>
  let items: T[] = [];
</script>

<Section title="a"><A {items} /></Section>`;
    expect(extractSections(source, FILE)[0].code).toMatch(/^<script lang='ts' generics='T extends "a" \| "b"'>\n/);
  });

  it('returns [] when no sections', () => {
    expect(extractSections('<p>hi</p>', FILE)).toEqual([]);
  });

  it('throws on dynamic title', () => {
    const source = '<script>let x = "a";</script>\n\n<Section title={x}><A /></Section>';
    expect(() => extractSections(source, FILE)).toThrow(/Button\.zukan\.svelte:3/);
  });

  it.each(['title=""', 'title="  "', 'title'])('throws on empty title (%s)', (attr) => {
    expect(() => extractSections(`<Section ${attr}><A /></Section>`, FILE)).toThrow(/Button\.zukan\.svelte:1 .*empty/);
  });

  it('missing and dynamic title have different messages', () => {
    expect(() => extractSections('<Section><A /></Section>', FILE)).toThrow(/Button\.zukan\.svelte:1 .*needs a title/);
    const dynamic = '<script>let x = "a";</script>\n<Section title={x}><A /></Section>';
    expect(() => extractSections(dynamic, FILE)).toThrow(/Button\.zukan\.svelte:2 .*static string/);
  });

  it('throws on duplicate title', () => {
    const source = '<Section title="a"><A /></Section>\n<Section title="a"><B /></Section>';
    expect(() => extractSections(source, FILE)).toThrow(/Button\.zukan\.svelte:2/);
  });

  it('throws on nested Section', () => {
    const nested = '<Section title="a">\n<div><Section title="b"><A /></Section></div>\n</Section>';
    expect(() => extractSections(nested, FILE)).toThrow(
      /Button\.zukan\.svelte:2 <Section> must not be nested .*import it under another name/
    );
  });

  it.each(['{#if true}', '{#key 1}', '{#each [1] as x}', '<div>'])('throws on a Section inside %s', (open) => {
    const close = open === '<div>' ? '</div>' : `{/${open.slice(2).split(' ')[0]}}`;
    const source = `<p></p>\n${open}\n<Section title="a"><A /></Section>\n${close}`;
    expect(() => extractSections(source, FILE)).toThrow(
      /Button\.zukan\.svelte:3 <Section> must be at the top level of the file .*import it under another name/
    );
  });
});
