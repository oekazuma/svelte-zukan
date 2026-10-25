---
name: svelte-zukan
description: Set up svelte-zukan and write its catalog files (`*.zukan.svelte`) and docs (`*.zukan.md`) for Svelte components. Use when asked to add svelte-zukan or a component catalog to a project, to configure `zukan()` in `vite.config`, to catalog or document components, when you add or change a component in a project that uses svelte-zukan, or when you need to see what a component looks like.
---

# svelte-zukan

svelte-zukan is a Vite plugin that serves a component catalog at `/__zukan/` on the app's dev server. Setup is one plugin in `vite.config`; after that, you add a catalog file next to each component you want in the catalog.

## Set it up

Skip this when `vite.config.*` already calls `zukan(`. Otherwise:

1. Read `package.json`: SvelteKit (`@sveltejs/kit`) or plain Vite (`@sveltejs/vite-plugin-svelte`). svelte-zukan needs Vite 8+, Svelte 5.46.4+ and Node 22.17+. If `svelte-zukan` is not installed, add it as a dev dependency with the package manager of the lockfile
2. In `vite.config.*`, import `zukan` from `svelte-zukan/vite` and make `zukan()` the first entry of `plugins`, ahead of `sveltekit()` / `svelte()` and every other plugin: `plugins: [zukan(), tailwindcss(), sveltekit()]`
3. Start from `zukan()` and add an option only for what you find:

| What the project has                                                                                                         | Option                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Global CSS (`app.css`, Tailwind, fonts) imported in `main.ts` or a layout, or a provider every component needs (theme, i18n) | `wrapper: '.zukan/Wrapper.svelte'`, see below                                                  |
| Components in one directory, such as `src/lib/components`, and the rest of `src` is the app (`App.svelte`, `routes/`)        | `groups: { ui: 'src/lib/components' }`, with that directory                                    |
| Components in another app, or Yarn Plug'n'Play (workspace packages the app depends on are found without it)                  | `groups` with each directory, relative to the Vite root                                        |
| Catalog files that already use another suffix                                                                                | `suffix`                                                                                       |
| No dark mode in the app (no `dark:` variant, `prefers-color-scheme` or `light-dark()`)                                       | `theme: 'light'`, so the previews and the accessibility check use a light page as the app does |
| The user wants a static catalog to deploy                                                                                    | `build: true`, and add `zukan-dist` to `.gitignore`                                            |

`build: true` makes every `vite build` also write the catalog, so add it only when the user asks for a static catalog, not to check your work (check on the dev server, below). Every option: https://oekazuma.github.io/svelte-zukan/options.md

A preview loads only its catalog file, never the app's entry, so the wrapper is where the global CSS and providers go. Put it in `.zukan/`, outside the scanned directories:

```svelte
<!-- .zukan/Wrapper.svelte -->
<script lang="ts">
  import '../src/app.css';

  let { children } = $props();
</script>

{@render children()}
```

### In a monorepo

When the repository has workspaces (`pnpm-workspace.yaml`, or `workspaces` in the root `package.json`), components usually live in packages such as `packages/ui` and the catalog is served by an app:

- `zukan()` and the wrapper go in the app that serves the catalog (`apps/web`), not in the component packages. Without `groups`, it scans that app's `src` and the `src` of each workspace package in the app's `dependencies` and `devDependencies`, and each package's `name` becomes its group
- A workspace package the app does not list itself, such as a dependency of a dependency, is not scanned and is not in `uncataloged` either. Add it to the app's `devDependencies` (`"@acme/icons": "workspace:*"`) and install, or list every directory in `groups`
- Every package that gets catalog files lists `svelte-zukan` in its own `devDependencies`, with the same version as the app, and you install. With pnpm, a catalog file in `packages/ui` cannot resolve `import { Section } from 'svelte-zukan'` otherwise: the dev server may still show it, but `vite build` with `build: true` fails
- The wrapper imports shared CSS by package name: `import '@acme/ui/tokens.css'`

## Find what to work on

Start the dev server in the background and read `/__zukan/catalog.json` (under Vite's `base` or SvelteKit's `paths.base` if one is set). After `vite build` with `build: true`, the same data is in `<outDir>/catalog.json`, `zukan-dist/` by default:

- `components[]`: `id`, `file` (the catalog file), `component` (the `.svelte` next to it), `doc` (its `.md`), `props` (read from the component's `$props()`, each with its `description`), and `sections[]` with each `title`, `code` and `preview`
- `components[].error`: why a catalog file does not compile. Fix these first
- `uncataloged[]`: `.svelte` files with no catalog file next to them yet
- `tailwind`: `null` when the project has no Tailwind CSS v4 entry, else one object per entry with `file`, `version`, `prefix`, `categories[]` (the utility classes by category, each token with its `class`, `cssVariable` and `value`), `variables` (every theme variable) and `error`. When styling a component, use only the classes listed here (with the entry's `prefix`, if any): they are the ones the theme defines

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
- A component that needs a parent or a context provider gets it inside the section: `<Section title="Basic"><ToastProvider><ToastButton /></ToastProvider></Section>`

## Document it

A component's docs have two parts, each in its own place.

Each prop gets a JSDoc comment on its type in the component. The props table on the detail page reads the name, type and default from the source and the description from this comment. Adding the comments changes no behaviour, so add them when you document a component. A prop that comes only from a package type, such as `children` from `HTMLButtonAttributes`, has no comment to read: declare it in the component's own type, with the same type, and comment it there:

```ts
let {
  variant = 'primary',
  children,
  ...rest
}: HTMLButtonAttributes & {
  /** `primary` for the main action on a screen, `danger` for one that deletes data */
  variant?: 'primary' | 'secondary' | 'danger';
  /** The label: a verb for what the button does, such as "Save changes" */
  children?: Snippet;
} = $props();
```

`<Name>.zukan.md` next to the catalog file is one to three short paragraphs of Markdown, rendered above the sections. They say what the component is for and when to use it, plus what the props table cannot show: keyboard and screen reader behaviour, a parent it must be inside, what it does with attributes it passes through. The `.md` is inserted as HTML, so write no raw HTML from untrusted sources.

## Check the result

- Reload `/__zukan/catalog.json`: the component is listed, has no `error`, its sections are the ones you wrote, and each prop has a `description`
- Open a section alone: `/__zukan/#/preview/<id>?section=<title>` (add `&theme=dark` for the dark theme; ignored when the `theme` option fixes the theme). The page has only the component and fills the window, so set the window width for a phone or tablet layout. It makes a good target for a screenshot
- On the detail page, `/__zukan/#/<id>?section=<title>&width=375` opens that section's preview at 375px inside the catalog
- Run the accessibility check (axe-core) on the sections you wrote: the button in each preview's toolbar, or, in a browser with WebMCP, the catalog page's `check_accessibility` tool (`list_components`, `get_component` and `open_component` are there too, and, with Tailwind CSS, `list_tailwind_tokens`). Fix its `violations`; its `review` list is what axe-core could not decide, such as text over an image or an ARIA attribute, so tell the user which rules need a manual check instead of calling them passed. A preview gets the catalog's theme, so a `color-contrast` violation on text with no background of its own may only mean the preview is dark and the app is not: if the app has no dark mode, set `theme: 'light'` and check again before changing the component's colors
- A `vite build` with `build: true` fails on the same catalog file errors, with the file and line
