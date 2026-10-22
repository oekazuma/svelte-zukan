# Tailwind CSS tokens in the catalog — design

Date: 2026-10-22. Status: draft, waiting for the maintainer's approval of the final version.

## Intent

People use svelte-zukan as the place where a design system lives. When the app styles its components with Tailwind CSS, the tokens (colors, spacing, type, radii, shadows, …) are half of that design system, and today the catalog does not show them. The maintainer wants the catalog to list the Tailwind values a project can use, for two reasons:

1. While writing code: check that a class such as `bg-brand-500` or `p-4` exists, and what it looks like.
2. As documentation: show the tokens next to the components, as part of the design system.

"As many usable values as possible" is the aim, but a list of thousands of classes is noise. The maintainer chose to follow Histoire's Tailwind feature ([docs](https://histoire.dev/examples/tailwind.html), [source](https://github.com/histoire-dev/histoire/tree/main/packages/histoire/src/node/builtin-plugins/tailwind)) for what is listed and how. AI agents get the same data through `catalog.json` and WebMCP.

## Goals

- Show the resolved Tailwind theme of the project: Tailwind's defaults plus everything the project's CSS adds or overrides with `@theme` (and `@plugin` / `@config`, as far as Tailwind resolves them).
- Same categories and the same "one representative utility per category" rule as Histoire, so each token appears once per category with a live sample.
- Search within a category; copy the class name and the CSS variable.
- Works with no configuration: it appears when Tailwind CSS v4 or later is installed and a Tailwind CSS entry is found, and is absent otherwise.
- Agents can read the tokens from `catalog.json` and through a WebMCP tool.
- Dev updates when the CSS changes; `build: true` includes it in the static catalog.

## Non-goals

- Tailwind CSS v3 and `tailwind.config.js`-only projects. v3 shows nothing, silently.
- Arbitrary values (`p-[13px]`), variants (`hover:`, `md:`), and utilities that take no theme value (`flex`, `grid`, `sr-only`).
- Every utility a token feeds. Colors appear as `bg-*`, `text-*` and `border-*` only, not `ring-*`, `fill-*`, `outline-*`, and so on (Histoire's rule).
- Generic design tokens for projects without Tailwind (plain CSS custom properties). That would be a separate feature.
- Editing tokens from the catalog.
- Dark-mode values (`.dark { … }`, `@custom-variant dark`) in this version. They are a planned follow-up.

## Anti-goals (a failure even if it works)

- A new runtime dependency. `tailwindcss` is the user's; svelte-zukan never installs, bundles or declares it as a dependency.
- A new `zukan()` option in this version. Detection must be good enough without one.
- Any cost or change for users who do not use Tailwind: no new warnings, no slower dev start in a way they can notice, no new files in the build output.
- A Tailwind upgrade that changes the unstable API breaks the catalog. It may break the Tailwind page only, with a readable error.
- Tailwind's CSS leaking into the catalog UI or into component previews, or the catalog's styles changing the samples.
- A CSS change reloading the app's tabs (`full-reload`).

## Constraints

- CONTRIBUTING.md "What belongs in svelte-zukan": the first rule says a feature helps someone look at, check or document a component. This feature widens that to the design tokens the components are built from. The maintainer accepts that; CONTRIBUTING.md gets one line saying so. All the other rules hold: no configuration, no dependency, catalog files stay plain Svelte, same behaviour in plain Vite and SvelteKit.
- Tailwind v4 has no stable public API for this. The only way is `__unstable__loadDesignSystem` (the API IntelliSense uses): `theme.entries()` for every theme variable, `getClassList()` for the class names IntelliSense suggests, `candidatesToAst()` / `candidatesToCss()` for what a class generates, and `theme.prefix`. Everything that touches it sits behind one guarded module (see "Loading Tailwind").
- Values cannot be read in the browser: Tailwind v4 emits only the variables that are used.
- Node 22.17 floor, Vite 8, Svelte 5 runes; no `fs` helpers beyond Node's own (`fs.globSync`).
- `catalog.json` and the static build carry no absolute paths.
- Plugin messages in English; UI strings in the en/ja dictionary in `src/lib/app/i18n.ts`; token and class names are never translated.

## What gets built (decided)

### Loading Tailwind

- svelte-zukan loads Tailwind through the project's own `@tailwindcss/node`, the package that `@tailwindcss/vite`, `@tailwindcss/postcss` and `@tailwindcss/cli` use to build the app's CSS. It is looked up from the entry's directory, then from the Vite root, either directly or through one of those three packages (pnpm does not hoist it). The `tailwindcss` used is the one that `@tailwindcss/node` depends on, so the catalog sees the same Tailwind that builds the app; its version is the entry's `version`. Never svelte-zukan's own copy.
- No `@tailwindcss/node` found, or a `tailwindcss` older than v4: the entry is skipped silently (no page, no warning). This is the v3 case too.
- Two calls per entry:
  - `__unstable__loadDesignSystem(css, { base, loadStylesheet, loadModule })` of that `tailwindcss`, for the theme and the class list.
  - `compile(css, { base, onDependency, customCssResolver, customJsResolver })` of `@tailwindcss/node`, then `build(classes)` for the listed classes, for the sample stylesheet and the files to watch.
- Resolution matches the app's build:
  - CSS `@import`s (in both calls, and when telling an entry from a partial) go through Vite's resolver with the options `@tailwindcss/vite` uses: `createIdResolver(config, { ...config.resolve, extensions: ['.css'], mainFields: ['style'], conditions: ['style', 'development|production'], tryIndex: false, preferRelative: true })`. Node resolution of the package's `style` export is the fallback. So aliases such as `$lib/theme.css` work.
  - `@plugin` and `@config` load through `@tailwindcss/node`'s `loadModule`, which handles TypeScript files on the Node 22.17 floor.
- The guard checks `__unstable__loadDesignSystem`, `compile`, `theme.entries`, `theme.prefix`, `getClassList`, `candidatesToAst` and `candidatesToCss`. A mismatch is the entry's `error`: "Tailwind CSS <version> does not expose the design-system API svelte-zukan uses".

### Detection

- Tailwind CSS entries are CSS files that `@import "tailwindcss"` (or a `tailwindcss/…` path) or contain `@theme`. They are found in the directories svelte-zukan already scans for catalog files (the Vite root's `src` and the `src` of workspace packages, or the `groups` directories). The Vite root's `src` is always searched too, even when `groups` leaves it out: a SvelteKit app usually keeps its entry at `src/app.css` while its `groups` point at `src/lib`.
- A file that another found entry imports (resolved as above) is a partial, not an entry. `@reference` imports do not count.
- One entry → one "Tailwind CSS" item. Several → one item each, labelled with the path relative to the Vite root.
- An entry with `@theme` but no `@import "tailwindcss"` is loaded with `@import "tailwindcss";` added in front of it, so its page shows the defaults plus its own tokens, like every other entry.

### Data, per entry

Following Histoire's `v4.ts`, with two corrections.

- `variables`: every `theme.entries()` key and value (the "Full config" view).
- Categories, in Histoire's order, each with its utility stem and identifying property:

  | Category         | Stem                               | Property           |
  | ---------------- | ---------------------------------- | ------------------ |
  | Background Color | `bg`                               | `background-color` |
  | Text Color       | `text`                             | `color`            |
  | Border Color     | `border`                           | `border-color`     |
  | Padding          | `p`                                | `padding`          |
  | Margin           | `m`                                | `margin`           |
  | Font Size        | `text`                             | `font-size`        |
  | Font Weight      | `font`                             | `font-weight`      |
  | Font Family      | `font`                             | `font-family`      |
  | Letter Spacing   | `tracking`                         | `letter-spacing`   |
  | Line Height      | `leading`                          | `line-height`      |
  | Drop Shadow      | `drop-shadow`                      | `filter`           |
  | Border Radius    | `rounded`                          | `border-radius`    |
  | Border Width     | `border`                           | `border-width`     |
  | Width            | `w`                                | `width`            |
  | Height           | `h`                                | `height`           |
  | Box Shadow       | `shadow`                           | `box-shadow`       |
  | Opacity          | `opacity`                          | `opacity`          |
  | Breakpoints      | from `--breakpoint-*`              | –                  |
  | Z-index          | `z`                                | `z-index`          |
  | Spacing          | `--spacing` plus the `p-*` classes | `padding`          |

  Empty categories are left out.

- A token is a class from `getClassList()` that is the stem or starts with `stem-`, and whose declarations, read from `candidatesToAst()` (`kind: 'declaration'` nodes, no CSS parser and no postcss), include the category's property. It records:
  - `class`: with the project prefix. `null` for the tokens that are no class (Breakpoints, the `--spacing` base).
  - `cssVariable`: only when the declaration is exactly `var(--x)` or `var(--x, …)` and `--x` is a theme key, else `null`. (Histoire takes the first `var()`, which makes every `p-4` look like `--spacing`; that is the first correction.)
  - `value`: the declaration with `var()`s resolved as far as the known values allow, else the expression as written. For example `p-4` is `calc(0.25rem * 4)` and `bg-primary` is `oklch(…)`.
- Known values (the second correction) are the theme variables plus the custom properties the entry declares unconditionally on `:root`, `:host` or `html`, outside any `@media`, `@supports` or other selector. These are read from the `compile()` output. The common Svelte + Tailwind setup `:root { --primary: … }` with `@theme inline { --color-primary: var(--primary) }` then gets real values and real swatches.
- `tailwind` in `catalog.json` is `null` when no entry was loaded (none found, or all skipped). It is never `[]`.

### The catalog page

- A "Tailwind CSS" item in the sidebar and a page of its own, with the categories as tabs or a sub-list, plus "Full config" (all theme variables).
- Each token: a live sample (color swatch, padded box, sized bar, text sample, shadowed square, …, as in Histoire's `render.ts`), the class name and the CSS variable, each with a copy button.
- A filter box per page that matches class names and values. Text categories have a sample-text field.
- Samples render inside a same-origin iframe, one document per page, like the component previews. The iframe holds the `compile().build(classes)` output: theme variables, the entry's own rules and `:root` variables, `@property` rules, preflight and `@font-face`.
  - Nothing leaks into the catalog, and nothing from the catalog reaches the samples. No selector rewriting is needed.
  - `@font-face` with a relative `url()` is out of scope: it would resolve against the catalog's URL. A Font Family sample may then fall back to a system font, and the docs say so.
- The page itself follows the catalog's light/dark theme. Samples and values are the base values: the iframe's root carries no `.dark` class or dark media emulation, and `theme.entries()` has no dark values. Dark-mode values are a planned follow-up: keep the data shape open to a second value per token (an optional field added later), and keep the iframe able to switch to dark later.
- The route must never collide with a component ID: `#/tailwind` is a single segment, and IDs always have a group prefix.

### Agents

- `catalog.json` gets a `tailwind` field, `null` as above. Otherwise it is a list with one object per entry:
  - `file` (relative), `version`, `prefix`
  - `categories`: `id`, `title`, and tokens with `class`, `cssVariable` and `value`
  - `variables`
  - `error`, when the entry failed

  The sample CSS is not part of it. The skill (`skills/svelte-zukan/SKILL.md`) mentions the field.

- WebMCP registers one more tool when the catalog has Tailwind data. It returns the tokens, filterable by category and by a query string.

### Dev and build

- Generation is lazy. It first runs when the catalog page loads the Tailwind list (never at dev-server start, never for a project without an entry), and the result is cached.
- Dev:
  - The files to watch are each entry plus what `compile()` reports through `onDependency` and `loadModule` (imports, `@plugin`, `@config`, also outside the scanned directories).
  - A change to a watched file, or a `.css` file created or deleted in the searched directories, regenerates the data. Only when the data or the sample CSS actually changed, the catalog tab and its previews update through `zukan:reload` (compared like `servedProps` for props).
  - `hotUpdate` returns `undefined` for these files, so the app's own CSS HMR (`@tailwindcss/vite`) goes on untouched. Never `full-reload`, never `[]`.
  - A failing entry shows its error on its page and keeps the rest of the catalog working.
- Build (`build: true`): the data and the sample CSS are strings in JS virtual modules that the `zukan` environment bundles under `_zukan/`, loaded lazily by the Tailwind page (like the `AXE` module). They are never a CSS import: the catalog's `index.html` links no CSS, and a CSS import would go through the app's CSS pipeline. `catalog.json` gets the data. A failure is a build warning plus an `error` in the data, not a failed build: the user did not ask for this feature.

### Docs and release

- A docs page in both locales (`docs/content/` and `docs/content/ja/`) for the page and the data. The `catalog.json` docs gain the `tailwind` field.
- One line in CONTRIBUTING.md widening the first rule to design tokens. AGENTS.md describes the new modules and the guard.
- A `minor` changeset.

## Calls made by Claude (the maintainer can override)

- The Vite root's `src` is always searched for CSS entries, even with `groups` (otherwise `src/app.css` would never be found in the usual SvelteKit setup).
- Tailwind is loaded through the project's `@tailwindcss/node`, the same copy that builds the app's CSS. A project with `tailwindcss` but none of `@tailwindcss/vite`, `@tailwindcss/postcss` or `@tailwindcss/cli` (and no `@tailwindcss/node`) gets no page.
- An `@theme`-only entry gets Tailwind's defaults added.
- No `zukan()` option in this version, not even to point at a CSS file. Add one only when detection proves insufficient in real projects.
- Neither `tailwindcss` nor `@tailwindcss/node` is declared, even as an optional peer dependency.
- A failure in the build warns instead of failing the build (Histoire fails it).
- `@font-face` with relative URLs is not rewritten for the samples.
- The library's own catalog (dogfooding, deployed as the docs demo) gets `tailwindcss` and `@tailwindcss/node` as dev dependencies and a small CSS entry with a few `@theme` values, so the demo shows the page in both the English and the Japanese build. The entry must not sit in `src/lib` (svelte-package would publish it).

## Left to the builder

- The route's query parameters and how the page is split by category.
- How the iframe is sized and fed (a route of the catalog page like `#/preview/…`, or a document written from the parent), and whether long lists need virtualizing (expect up to a few hundred tokens per category).
- The name and input schema of the WebMCP tool.
- Test layout: unit tests against a real `tailwindcss` v4 and `@tailwindcss/node` (dev dependencies from the catalog), a `tests/build` fixture with Tailwind, a client test for the page. CI's `floor` job must keep passing without Tailwind installed.
