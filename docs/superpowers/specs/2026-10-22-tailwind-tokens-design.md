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

- Tailwind CSS v3 and `tailwind.config.js`-only projects. v3 shows nothing (no error, no warning beyond what is useful in a log).
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
- Tailwind v4 has no stable public API for this. The only way is `__unstable__loadDesignSystem` from the user's `tailwindcss` (the API IntelliSense uses): `theme.entries()` for every theme variable, `getClassList()` for the class names IntelliSense suggests, `candidatesToCss()` for the CSS of a class, and `theme.prefix`. Everything that touches it sits behind one guarded module that checks the shape and throws a clear error ("Tailwind CSS x.y.z does not expose the design-system API svelte-zukan uses") when it does not match.
- Values cannot be read in the browser: Tailwind v4 emits only the variables that are used.
- Node 22.17 floor, Vite 8, Svelte 5 runes; no `fs` helpers beyond Node's own (`fs.globSync`).
- `catalog.json` and the static build carry no absolute paths.
- Plugin messages in English; UI strings in the en/ja dictionary in `src/lib/app/i18n.ts`; token and class names are never translated.

## What gets built (decided)

### Detection

- Tailwind CSS entries are CSS files that `@import "tailwindcss"` (or a `tailwindcss/…` path) or contain `@theme`, found in the directories svelte-zukan already scans for catalog files (the Vite root's `src` and the `src` of workspace packages, or the `groups` directories) and, always, the Vite root's `src`, even when `groups` leaves it out: a SvelteKit app usually keeps its entry at `src/app.css` while its `groups` point at `src/lib`. A file imported by another found entry is a partial, not an entry; `@reference` imports do not count. One entry → one "Tailwind" item. Several → one item each, labelled with the path relative to the Vite root.
- Each entry uses the `tailwindcss` its own file would load: resolved from the entry's directory, falling back to the Vite root's install (never svelte-zukan's own copy). Major version 4 or later is required; an entry that resolves no Tailwind or an older one is skipped silently. The API guard runs per entry, and `version` in the data is per entry.
- An entry with `@theme` but no `@import "tailwindcss"` is loaded with Tailwind's defaults added in front of it, so its page shows the defaults plus its own tokens, like every other entry.

### Data, per entry

Following Histoire's `v4.ts`:

- `variables`: every `theme.entries()` key and value (the "Full config" view).
- Categories, in Histoire's order and with its utility stem and identifying property: Background Color (`bg`), Text Color (`text`, `color`), Border Color (`border`), Padding (`p`), Margin (`m`), Font Size (`text`, `font-size`), Font Weight (`font`), Font Family (`font`), Letter Spacing (`tracking`), Line Height (`leading`), Drop Shadow (`drop-shadow`), Border Radius (`rounded`), Border Width (`border`, `border-width`), Width (`w`), Height (`h`), Box Shadow (`shadow`), Opacity (`opacity`), Breakpoints (from `--breakpoint-*`), Z-index (`z`), Spacing (`--spacing` plus `p-*` suggestions). Empty categories are left out.
- A token is a class from `getClassList()` whose name is the stem or starts with `stem-`, whose `candidatesToCss()` output declares the category's property. It records the class (with the project prefix), the CSS variable it reads when there is one, the resolved value, and the declarations used to draw the sample.

### The catalog page

- A "Tailwind" item in the sidebar and a page of its own, with the categories as tabs or a sub-list, plus "Full config" (all theme variables).
- Each token: a live sample (color swatch, padded box, sized bar, text sample, shadowed square, …, as in Histoire's `render.ts`), the class name and the CSS variable, each with a copy button.
- A filter box per page that matches class names and values. Text categories have a sample-text field.
- The page itself follows the catalog's light/dark theme. Samples and values are the theme's base values: `theme.entries()` has no dark-mode values (`.dark { --color-… }`, `@custom-variant dark`), so dark values are out of scope for this version. The maintainer wants them later, as a follow-up: keep the data shape open to a second set of values per token (do not bake "one value per token" into names or the `catalog.json` contract in a way that would need a breaking change). Sample CSS is the `candidatesToCss()` output for the listed classes and the theme variables, scoped to the token page so it neither leaks out nor picks up catalog styles.
- The route must never collide with a component ID (IDs are `<group>/<path>`, and group names come from package names or the `groups` keys).

### Agents

- `catalog.json` gets a `tailwind` field: `null` when the feature is off, else a list with one object per entry: `file` (relative), `version`, `prefix`, `categories` (`id`, `title`, tokens with `class`, `cssVariable`, `value`), `variables`, and `error` when the entry failed. The skill (`skills/svelte-zukan/SKILL.md`) mentions it.
- WebMCP registers one more tool when the catalog has Tailwind data, which returns the tokens, filterable by category and by a query string.

### Dev and build

- Dev: the CSS entry, its local imports and its `@plugin` / `@config` files are watched; a change regenerates the data and the page updates through a custom HMR event, like `zukan:reload`, never `full-reload`. A failing entry shows its error on its page and keeps the rest of the catalog working.
- Build (`build: true`): the data and the sample CSS go into the static catalog and `catalog.json`. A failure is a build warning and an `error` in the data, not a failed build: the user did not ask for this feature.

### Docs and release

- A docs page in both locales (`docs/content/` and `docs/content/ja/`) for the page and the data; `catalog.json` docs gain the `tailwind` field.
- One line in CONTRIBUTING.md widening the first rule to design tokens; AGENTS.md describes the new module and its guard.
- A `minor` changeset.

## Calls made by Claude (the maintainer can override)

- The Vite root's `src` is always searched for CSS entries, even with `groups` (otherwise `src/app.css` would never be found in the usual SvelteKit setup).
- Each entry uses the `tailwindcss` its own location resolves, falling back to the Vite root's.
- An `@theme`-only entry gets Tailwind's defaults added.
- No `zukan()` option in this version, not even to point at a CSS file. Add one only when detection proves insufficient in real projects.
- `tailwindcss` is not declared even as an optional peer dependency.
- A failure in the build warns instead of failing the build (Histoire fails it).
- The library's own catalog (dogfooding, deployed as the docs demo) gets `tailwindcss` as a dev dependency and a small CSS entry with a few `@theme` values, so the demo shows the page in both the English and the Japanese build. The entry must not sit in `src/lib` (svelte-package would publish it).

## Left to the builder

- How `@import "tailwindcss"`, `@plugin` and `@config` are loaded for `__unstable__loadDesignSystem` (the loaders): through Vite's resolver, through the user's `@tailwindcss/node` when it is resolvable, or Node resolution from the CSS file. It must resolve from the CSS file's location and work with pnpm's strict layout and in a monorepo.
- The route shape and how the page is split by category, within the collision rule above (a single-segment hash such as `#/tailwind` cannot collide, since IDs always have a group prefix).
- Whether the samples render in the page or in an iframe, and whether long lists need virtualizing (expect up to a few hundred tokens per category).
- The name and input schema of the WebMCP tool.
- Test layout: unit tests against a real `tailwindcss` v4 (dev dependency from the catalog), a `tests/build` fixture with Tailwind, a client test for the page; CI's `floor` job should keep passing without Tailwind installed.
