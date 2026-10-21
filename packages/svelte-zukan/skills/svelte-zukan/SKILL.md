---
name: svelte-zukan
description: Write and check svelte-zukan catalog files (`*.zukan.svelte`) for Svelte components. Use when a project uses svelte-zukan and you add or change a component, are asked to document one in the catalog, or need to see what a component looks like.
---

# svelte-zukan

svelte-zukan is a Vite plugin that serves a component catalog at `/__zukan/` on the app's dev server. Each component gets a catalog file next to it; there is no other config to touch.

## Find what to work on

With the dev server running, read `/__zukan/catalog.json` (after `vite build` with `build: true`, the same data is in `<outDir>/catalog.json`, `zukan-dist/` by default):

- `components[]`: `id`, `file` (the catalog file), `component` (the `.svelte` next to it), `doc` (its `.md`), `props` (read from the component's `$props()`), and `sections[]` with each `title`, `code` and `preview`
- `components[].error`: why a catalog file does not compile. Fix these first
- `uncataloged[]`: `.svelte` files with no catalog file next to them yet

Paths are relative to the Vite root.

## Write a catalog file

Put `<Name>.zukan.svelte` next to `<Name>.svelte` (the suffix can differ: check `suffix` in `zukan()` in `vite.config.ts`).

```svelte
<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';
</script>

<Section title="Primary">
  <Button variant="primary">Save</Button>
</Section>

<Section title="Disabled">
  <Button disabled>Save</Button>
</Section>
```

- One `<Section>` per state worth seeing: variants, sizes, disabled, loading, empty, error, long text. Show realistic content, not "foo"
- `<Section>` must be at the top level, with a non-empty, static, unique `title`. Anything else is a build error with the file and line
- Plain Svelte 5 with runes; `lang="ts"` is fine. Preprocessors only inside `<style>`
- State a section needs (`$state`, snippets, helper data) goes in the `<script>` or as top-level `{#snippet}` blocks; the code view shows each section with what it uses
- Describe the component in an optional `<Name>.zukan.md` next to it (Markdown, rendered above the sections; it is inserted as HTML). Describe each prop with a JSDoc comment on its type in the component instead of repeating props in the `.md`: the props table shows them

## Check the result

- Reload `/__zukan/catalog.json`: the component is listed, has no `error`, and its sections are the ones you wrote
- Open a section alone: `/__zukan/#/preview/<id>?section=<title>` (add `&theme=dark` for the dark theme). The page has only the component and fills the window, so set the window width for a phone or tablet layout. It makes a good target for a screenshot
- On the detail page, `/__zukan/#/<id>?section=<title>&width=375` opens that section's preview at 375px inside the catalog
- Run the accessibility check (axe-core) on the sections you wrote: the button in each preview's toolbar, or, in a browser with WebMCP, the catalog page's `check_accessibility` tool (`list_components`, `get_component` and `open_component` are there too)
- A `vite build` with `build: true` fails on the same catalog file errors, with the file and line
