---
title: Catalog files
sidebar:
  order: 1
---

Put `<Name>.zukan.svelte` next to the component. `<Name>.zukan.md` is optional. No dedicated directory such as `zukan/` is needed. File names are matched case-sensitively on every platform, so `Button.Zukan.svelte` is not a catalog file, and `Button.Zukan.md` and `button.svelte` do not belong to `Button.zukan.svelte`.

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

A missing, dynamic, or empty `title`, a duplicate `title`, or a `<Section>` that is not at the top level each cause a build error with the file name and line. A file that is not plain Svelte markup also causes a build error with the file name. On the dev server, the file's detail page shows the same message instead, and the app's tabs are left alone, unless one of the app's own pages imports the file: Vite then shows the error there as usual.

Other errors in a catalog file, such as one the Svelte compiler reports or an import that cannot be resolved, show in the terminal and, on the dev server, in the file's previews. So do errors in a file that only catalog files import. Here too the app's tabs are left alone unless the app imports the file, and fixing the file reloads the previews.

A file with no `<Section>` is not an error: its detail page says that there is nothing to preview. A `<Section>` without content renders nothing.

## Code view

The detail page shows the contents of each section as code, with syntax colors, together with the definitions in `<script>` that the section references. In the example above, the code for "Basic" also shows `label` and `count`. Top-level `{#snippet}` blocks, `<script module>` declarations and TypeScript types that the section uses are shown too. `Section` can be imported under another name, for example `import { Section as Example } from 'svelte-zukan'`, or through a namespace import as `<Z.Section>` with `import * as Z from 'svelte-zukan'`.

## Markdown description

`Button.zukan.md` pairs only with the `Button.zukan.svelte` in the same directory. If it exists, it is rendered as HTML at the top of the detail page. The HTML is inserted as it is, including any raw HTML in the `.md` file, so review `.md` files like code before you publish the catalog.

```md
<!-- src/lib/Button/Button.zukan.md -->

A button for the main action on a page. Use one per screen.
```

## Props table

When `Button.svelte` sits next to `Button.zukan.svelte`, the detail page lists its props under the [description](#markdown-description) and above the sections: each name, its type, its default, and its JSDoc comment (rendered as inline Markdown, up to the first `@` tag). As in an editor, HTML in a comment is shown as text, and `{@link}` shows a name as code and an `http` or `https` URL as a link. A prop whose type has no comment takes the one on its destructuring (`let { /** … */ children }`): that is where to describe a prop that comes from a package type. Props marked `required` have no `?` and no default; props marked `bindable` default to `$bindable()`.

```svelte
<!-- src/lib/Button/Button.svelte -->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    variant = 'primary',
    disabled = false,
    children,
    ...rest
  }: HTMLButtonAttributes & {
    /** the look of the button: `primary` for the main action */
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
  } = $props();
</script>

<button class={variant} {disabled} {...rest}>
  {@render children?.()}
</button>
```

The props are read from the component's source, not by running it. The type can be written inline, or as a type alias or interface declared in the component (an interface's `extends` included). A prop declared twice, such as an interface narrowing a member of the one it extends, is listed once, as the interface itself declares it; an interface declared twice in one file has the members of both declarations. A type imported by a relative path is read too: from a `.ts` or `.d.ts` file (`./types`, `./types.js`, `./types/index.ts`, `./types/index.d.ts`, with its `export … from` re-exports and names exported under another name, as in `export { Inner as Props }`), from a `.svelte.ts` module (`./state.svelte`) or from another component's `<script module>`, following imports up to three files deep. It is read whether it is imported by name, as the default export (`export default interface Props`) or through a namespace import (`T.Props` with `import type * as T`). A generic type alias or interface takes the type arguments it is given, or its defaults: with `type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null }`, `WithElementRef<HTMLButtonAttributes, HTMLButtonElement>` lists `ref` as `HTMLButtonElement | null` and shows `HTMLButtonAttributes` by name. A package type's members keep its own type parameters as written. `Omit` and `Pick` with literal keys (`Omit<Base, 'id' | 'class'>`) list the members they keep when the table can list every member of the type they take from; over a package type they are shown by name, like the package type itself. A type from a package (`HTMLButtonAttributes` from `svelte/elements`) is shown by name above the table, and several are shown separated by commas. Of its members, only the destructured ones are listed, with the type and JSDoc comment from the file the package's types point to (the `types` condition of its `exports`, the `.d.ts` next to the JavaScript file its `exports` points to, its `types` field, or the `.d.ts` next to its `main`: a `.d.ts`, or the source `.ts`, `.mts` or `.cts` of a workspace package; for a subpath of a package without `exports`, `sub.d.ts` or `sub/index.d.ts`), or from `@types/<name>` when the package has no types of its own, so `children` above reads `Snippet`; what goes into `...rest` is not listed. A package's `typesVersions` is not read. A component of a library built with `svelte-package` is read from the `Button.svelte.d.ts` next to it, both for a props type it exports and for `ComponentProps<typeof Button>` (`ComponentProps` from `svelte`). `ComponentProps<typeof Field>` of a component of your project (`import Field from './Field.svelte'`) reads the type of its `$props()`. A type the table can not read, such as a union (`{ href: string } | { onclick: () => void }`), is shown as written, and the destructured props it would type are listed without types. Editing a file of your project that a props type comes from refreshes the table, as does creating or deleting it, and so does editing the types of a workspace package, which is linked into `node_modules` from outside it. A component that does not parse, or that has no `$props()`, gets no table. A JSDoc comment's Markdown links and images still become HTML, so review them like code before you publish the catalog.

## Changing the suffix

The `suffix` option changes the file names. `zukan({ suffix: 'catalog' })` uses `*.catalog.svelte` and `*.catalog.md`.

## Watching and HMR

- Creating, deleting, or editing a catalog file or a `.md` file reloads only the `/__zukan/` tab. Tabs of the app connected to the same dev server are not reloaded. An app page that imports a catalog file still gets the edit through normal HMR
- Editing the `logo` image also reloads only the `/__zukan/` tab
- Editing a component itself (such as `Button.svelte`) goes through normal HMR and is reflected in both the app and the catalog. If the edit changes its props, the `/__zukan/` tab also reloads to update the props table
- Directories outside Vite's root, such as other packages in a monorepo, are also watched
