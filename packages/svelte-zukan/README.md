<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/oekazuma/svelte-zukan/main/.github/logo-dark.svg" />
    <img src="https://raw.githubusercontent.com/oekazuma/svelte-zukan/main/.github/logo.svg" alt="zukan" width="320" />
  </picture>
</p>

<p align="center">
  A component catalog for Svelte. Put a catalog file next to a component and you get a list, a live preview, and a code view.
</p>

"zukan" (図鑑) is Japanese for "illustrated encyclopedia".

> svelte-zukan is not an official Svelte project (not affiliated with or endorsed by the Svelte team). The S shape in the logo is derived from the Svelte logo.

> Under development. The API may change without notice.

## Features

- All you do on your side is add `zukan()` to `vite.config.ts`. No routes or config files in `src`
- Open the catalog at `/__zukan/` on the dev server (the same idea as `/__inspect/` in vite-plugin-inspect)
- Put `Button.zukan.svelte` and `Button.zukan.md` next to a component and they show up in the catalog automatically
- Each section is previewed in an iframe, and you can change its width by dragging or with presets (375 / 768 / 1024 / 1280px)
- Shows the contents of a section as code, together with the definitions of the variables it references
- With `build: true`, `vite build` also writes out a static catalog
- In a monorepo, it also collects the catalog files of the workspace packages that the catalog app depends on

## Scope and requirements

A library for Svelte on Vite. The same `zukan()` works with plain Vite + Svelte (`svelte()` from `@sveltejs/vite-plugin-svelte`) and with SvelteKit.

- Vite 8 or later, Svelte 5, Node 22.17 or later
- It uses Vite-specific hooks (`configureServer`, `hotUpdate`, `buildApp`), so it does not work with bundlers other than Vite

## Setup

### Plain Vite + Svelte

Place `zukan()` before `svelte()`.

```ts
// vite.config.ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), svelte()] });
```

### SvelteKit

Place `zukan()` before `sveltekit()`.

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), sveltekit()] });
```

Start the dev server and open `/__zukan/`. The catalog URL is also listed in the URLs printed to the terminal at startup.

If you set Vite's `base` or SvelteKit's `paths.base`, the catalog moves to `<base>__zukan/` (for example, `/app/__zukan/` when `base: '/app/'`). The terminal's URL list shows the new URL.

## Writing catalog files

Put `<Name>.zukan.svelte` next to the component. `<Name>.zukan.md` is optional (subdirectories such as `zukan/` are not used).

```text
src/lib/Button/
├── Button.svelte
├── Button.zukan.svelte
└── Button.zukan.md
```

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

- Put `<Section>` at the top level (not inside another element or block). `title` must be a non-empty static string. A missing, dynamic, or empty `title`, a duplicate within the same file, or a `<Section>` that is not at the top level each cause a build error (with the file name and line)
- The code view on the detail page shows the contents of the section and the definitions in `<script>` that it references (`label` and `count` in the example above)
- `Button.zukan.md` pairs only with the `Button.zukan.svelte` in the same directory with the same name. If it exists, it is rendered as HTML at the top of the detail page
- You can change the suffix with the `suffix` option (`zukan({ suffix: 'catalog' })` gives `*.catalog.svelte` / `*.catalog.md`)

## Catalog IDs and URLs

The catalog is a hash-routed SPA. It has only one HTML file, so deep links open as-is wherever you put the exported output.

| URL                                       | Shows                                  |
| ----------------------------------------- | -------------------------------------- |
| `/__zukan/`                               | List                                   |
| `/__zukan/#/<ID>`                         | Detail page                            |
| `/__zukan/#/preview/<ID>?section=<title>` | Preview for the iframe (no catalog UI) |

An ID is `<group name>/<relative path>`. The relative path is the path from the search directory to the catalog file, minus `.<suffix>.svelte`.

- With the group name `my-app`, `src/lib/forms/Button.zukan.svelte` becomes `my-app/lib/forms/Button`
- When the last two segments are the same (`Button/Button`), they are merged into one. `src/lib/Button/Button.zukan.svelte` becomes `my-app/lib/Button`
- Catalog files with the same name (`forms/Button.zukan.svelte` and `nav/Button.zukan.svelte`) get different IDs if their directories differ. The list shows the name (`Button`) prominently and the directory (`lib/forms`) in a subdued color, so you can tell them apart
- A group name that is `preview` or starts with `preview/` is an error (reserved in URLs)
- Duplicate IDs are an error, and both file paths are reported. IDs collide, for example, in these cases
  - `lib/Button.zukan.svelte` and `lib/Button/Button.zukan.svelte`. After merging, both become `my-app/lib/Button`
  - `ui/Card.zukan.svelte` in the group `@acme` and `Card.zukan.svelte` in the group `@acme/ui`. Both become `@acme/ui/Card`

An ID does not change unless you move the file. With automatic discovery, `lib/` appears in the ID because the whole `src` directory is searched. If that bothers you, point `groups` at `src/lib`.

## Options

```ts
zukan({
  suffix: 'zukan',
  groups: { ui: 'src/lib', examples: ['src/examples', 'src/demo'] },
  wrapper: '.zukan/Wrapper.svelte',
  logo: '.zukan/logo.svg',
  title: 'zukan',
  locale: 'en',
  build: { outDir: 'zukan-dist' }
});
```

| Option    | Type                                 | Default        | Description                                                                                                                                                                                       |
| --------- | ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suffix`  | `string`                             | `'zukan'`      | Suffix of catalog files. A string matching `/^[a-z0-9-]+$/i`                                                                                                                                      |
| `groups`  | `Record<string, string \| string[]>` | auto-discovery | Group name → directories to search. If given, automatic discovery is skipped and only the listed directories are searched. Groups are ordered by key. A directory that does not exist is an error |
| `wrapper` | `string`                             | none           | Path to a `.svelte` file that wraps the preview                                                                                                                                                   |
| `logo`    | `string \| false`                    | bundled logo   | Path to the sidebar logo image. `false` hides the logo and shows the `title` text instead                                                                                                         |
| `title`   | `string`                             | `'zukan'`      | The sidebar logo's `alt` and the `<title>`                                                                                                                                                        |
| `locale`  | `'en' \| 'ja'`                       | `'en'`         | UI language. `<html lang>` follows it                                                                                                                                                             |
| `build`   | `boolean \| { outDir?: string }`     | `false`        | Write the catalog statically during `vite build`. With `true`, `outDir` is `'zukan-dist'`                                                                                                         |

- All paths are relative to Vite's root, and can point outside `src`, such as `.zukan/`
- Invalid values (a `suffix` that does not match the rule, an unknown `locale`, a file or directory that does not exist) cause an error when the config is loaded
- If a `groups` key consists only of digits, JavaScript object semantics order it numerically instead of in declaration order. Include a non-digit character in group names

### Discovery in a monorepo

Without `groups`, catalog files are searched in this order.

1. The `src` of the package at Vite's root (the catalog app itself)
2. The `src` of the workspace packages the app depends on, in the order of `dependencies` then `devDependencies` in the app's `package.json`

- The group name is the `name` in the package's `package.json`. A package without catalog files does not become a group
- Dependency packages are found through the links in the catalog app's own `node_modules/<dependency name>` (pnpm workspaces link them this way). With npm or yarn workspaces, the links are created in the workspace root's `node_modules`, so they are not found. In that case, specify them with `groups`
- Transitive dependencies are not searched. For apps or packages that are not declared in the app's dependencies (for example, when the catalog app `apps/catalog` should show components from another app, `apps/web`), specify them with `groups`

```ts
// apps/catalog/vite.config.ts
zukan({
  groups: {
    web: '../web/src',
    ui: '../../packages/ui/src'
  }
});
```

### `wrapper`

Wraps only the inside of the preview iframe. This is where you put providers and global CSS, and it corresponds to Storybook's `.storybook/preview.js`. Accept `children` and render it.

```svelte
<!-- .zukan/Wrapper.svelte -->
<script lang="ts">
  import '../src/app.css';
  import ThemeProvider from '../src/lib/ThemeProvider.svelte';

  let { children } = $props();
</script>

<ThemeProvider>{@render children()}</ThemeProvider>
```

Global CSS loaded by `wrapper` does not affect the catalog's own UI. The catalog UI is a separate HTML page and does not load the app's CSS either.

## Static export

```ts
zukan({ build: true });
```

During `vite build`, the catalog is written to `zukan-dist/`, separately from the app build (you can also choose the output directory, as in `build: { outDir: 'docs/zukan' }`). It is separate from the app's build output, so the adapter's output step does not delete it.

- Output paths are relative, so it works under any subpath (for example, `/docs/zukan/`). No server-side rewrite configuration is needed
- When `build` is enabled, `vite build` runs in Vite's builder mode (Environment API), and all environments are built in a single run
- `vite build --watch` does not write the catalog (it prints a warning and skips it)
- Before writing, only the previous catalog (`_zukan/` and `index.html` in the output directory) is removed. In SvelteKit, adapters often empty `build/`, so a warning is printed if the output directory overlaps with `build/`
- Add `/zukan-dist` to `.gitignore`

## SvelteKit runtime APIs

SvelteKit runtime APIs such as `$app/state` and `$app/navigation` are not replaced. Inside the catalog, SvelteKit's runtime code runs in its default state.

- `page` from `$app/state`: `url.pathname` is an empty string, `params` is `{}`, and `data` is `{}`
- `browser` from `$app/env`: `true`
- `goto` and similar from `$app/navigation`: they only reject, and the page does not navigate
- `resolve` from `$app/paths`: returns a URL based on the app's `paths.base` (with an empty `paths.base`, `resolve('/')` is `/`). It is not the catalog's own URL
- `asset` from `$app/paths`: like `resolve`, it returns a URL based on the app's `paths.base` (for example, `asset('favicon.svg')` is `/favicon.svg`). `paths.assets` is not used inside the catalog. When the catalog reads a file from the app's `static/`, the one served by the app's dev server is used

Anything that changes the display based on the current page, such as navigation, is rendered with the default values in the catalog. In an app that uses SvelteKit, this behavior is the same in a statically exported catalog.

## Watching and HMR

- Creating, deleting, or editing a catalog file (`*.zukan.svelte`) or a `.md` file reloads only the `/__zukan/` tab. Tabs of the app connected to the same dev server are not reloaded
- Editing a component itself (such as `Button.svelte`) goes through normal HMR and is reflected in both the app and the catalog
- Directories outside Vite's root (such as other packages in a monorepo) are also watched
- When IDs collide, for example when two catalog files end up with the same ID, Vite's error overlay appears in the terminal and also in the tabs of apps connected to the dev server

## UI language

The catalog UI is in English by default. `locale: 'ja'` switches it to Japanese. Strings you write yourself, such as `groups` keys and the `title` in catalog files, are not translated. The plugin's error messages are in English and do not follow `locale`.

## Development

See [CONTRIBUTING.md](https://github.com/oekazuma/svelte-zukan/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE.md)
