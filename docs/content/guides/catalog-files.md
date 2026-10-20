---
title: Catalog files
sidebar:
  order: 1
---

Put `<Name>.zukan.svelte` next to the component. `<Name>.zukan.md` is optional. No dedicated directory such as `zukan/` is needed.

```text
src/lib/Button/
├── Button.svelte
├── Button.zukan.svelte
└── Button.zukan.md
```

## Sections

A catalog file is a Svelte component made of `<Section>` blocks. Each section is one example, previewed on its own.

```svelte
<!-- src/lib/Button/Button.zukan.svelte -->
<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';

  let count = $state(0);
  const label = $derived(`${count} clicks`);
</script>

<Section title="Basic">
  <Button onclick={() => count++}>{label}</Button>
</Section>

<Section title="Disabled">
  <Button disabled>Disabled</Button>
</Section>
```

- Put `<Section>` at the top level, not inside another element or block
- `title` must be a non-empty static string, unique within the file
- Write the markup and `<script>` in plain Svelte (TypeScript with `lang="ts"` is fine). Preprocessor languages, such as SCSS, work only inside `<style>`

A missing, dynamic, or empty `title`, a duplicate `title`, or a `<Section>` that is not at the top level each cause a build error with the file name and line. A file that is not plain Svelte markup also causes a build error with the file name.

A file with no `<Section>` is not an error: its detail page says that there is nothing to preview. A `<Section>` without content renders nothing.

## Code view

The detail page shows the contents of each section as code, together with the definitions in `<script>` that the section references. In the example above, the code for "Basic" also shows `label` and `count`. Top-level `{#snippet}` blocks, `<script module>` declarations and TypeScript types that the section uses are shown too. `Section` can be imported under another name, for example `import { Section as Example } from 'svelte-zukan'`.

## Markdown description

`Button.zukan.md` pairs only with the `Button.zukan.svelte` in the same directory. If it exists, it is rendered as HTML at the top of the detail page. The HTML is inserted as it is, including any raw HTML in the `.md` file, so review `.md` files like code before you publish the catalog.

```md
<!-- src/lib/Button/Button.zukan.md -->

A button for the main action on a page. Use one per screen.
```

## Changing the suffix

The `suffix` option changes the file names. `zukan({ suffix: 'catalog' })` uses `*.catalog.svelte` and `*.catalog.md`.

## Watching and HMR

- Creating, deleting, or editing a catalog file or a `.md` file reloads only the `/__zukan/` tab. Tabs of the app connected to the same dev server are not reloaded
- Editing a component itself (such as `Button.svelte`) goes through normal HMR and is reflected in both the app and the catalog
- Directories outside Vite's root, such as other packages in a monorepo, are also watched
- When two catalog files end up with the same ID, Vite's error overlay appears in the terminal and in the app tabs connected to the dev server
