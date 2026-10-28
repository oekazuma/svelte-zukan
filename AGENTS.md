# svelte-zukan Coding Agent Guide

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a **pnpm workspace monorepo**. The pnpm version is pinned via `packageManager` and the Node version via `devEngines.runtime` in the root `package.json` — check that file for the current values. All shared dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`; package `package.json` files reference them via `"catalog:"` and should not pin versions directly (the published package's runtime `dependencies` are the exception).

Workspace members:

- `docs/` — the documentation site, built with Blume (a markdown-first docs framework on Astro) and deployed to GitHub Pages by `.github/workflows/deploy-docs.yml`. It is **bilingual**: English pages live in `docs/content/`, Japanese translations in `docs/content/ja/` (mirrored paths; a parenthesized folder such as `(reference)/` is a sidebar group that adds no URL segment). Site config (i18n, deployment base) lives in `docs/blume.config.ts`; section ordering comes from `meta.ts` files plus each page's `sidebar.order` frontmatter. When documenting a feature, update **both** locales. The docs are the reference for user-facing behaviour.
- `packages/svelte-zukan/` — the published library (the only public package). Source is in `src/lib/`. The package consumes itself (dogfooding): `vite.config.ts` registers `zukan({ groups: { ui: 'src/lib', examples: 'src/examples' }, wrapper: '.zukan/Wrapper.svelte', build: true })`, `src/routes/` is a one-page introduction that links to `/__zukan/`, `src/examples/` holds sample catalog files, and `src/tailwind.css` (outside `src/lib`, so it is not published) is the demo's Tailwind CSS entry. `src/examples-ja/` is the same set in Japanese (descriptions, section titles, props JSDoc and demo text), and `src/ui-ja/` holds Japanese catalog files for the `ui` group's components (thin wrappers that import them from `src/lib/` with Japanese JSDoc); with `ZUKAN_DEMO_LOCALE=ja` they replace `src/examples/` and `src/lib/` as the two groups. A change to one demo component, or to a `ui` component's catalog file or props, goes into both; `src/examples.test.ts` fails when the copies drift. `vite build` writes the intro page to `build/` and the catalog to `zukan-dist/`.
- `example/` — a SvelteKit app that imports `svelte-zukan` as `workspace:*` and so resolves it from `dist/`. It has no tests of its own, but CI's `test` job builds it (`pnpm --filter example build`) as a smoke check of the built package.
- `tests/build/` (package `build-tests`) — Vitest tests that run `vite build` in a child process on two fixtures and check the written catalog: `monorepo/` (SvelteKit app `apps/catalog` depending on the workspace package `packages/ui`) and `vite-svelte/` (plain Vite + `svelte()`, with a Tailwind CSS entry `src/app.css`; the package has `tailwindcss` and `@tailwindcss/vite` as dev dependencies, so `@tailwindcss/node` is found the way pnpm lays it out). The fixtures are not workspace members; `monorepo/setup.mjs` links their packages the way pnpm would (directory junctions, so it also works on Windows without admin rights) and links `svelte-zukan` to `packages/svelte-zukan`. The fixtures use the library's **source** unless `ZUKAN_FROM_DIST=1` is set; CI runs `build.test.ts` both ways. `dev.test.ts` starts a dev server on a temporary copy of `vite-svelte/` with the built package copied into its `node_modules`, as npm installs it (the plugin adds an installed `svelte-zukan` to `optimizeDeps.include`, a linked or aliased one never), and checks a preview in Chromium; it needs `pnpm run package` first.

## Common commands

Run from repo root unless noted. Root `dev` / `build` / `preview` / `package` / `check` / `test` fan out to every workspace via `pnpm -r` (dependency order; `dev` and `preview` use `--parallel` because they never exit).

```bash
pnpm install               # install workspace deps (uses the pnpm catalog)
pnpm run dev               # dev servers (the library's dogfooding app, the example)
pnpm run build             # package the library, then build all workspaces (the example uses the library's dist)
pnpm run package           # svelte-kit sync && svelte-package && publint (library output -> packages/svelte-zukan/dist)
pnpm run check             # svelte-check across workspaces
pnpm run lint              # prettier --check . && eslint .
pnpm run format            # prettier --write .
pnpm run test              # every workspace's `test`: the library's Vitest projects and tests/build
```

Per-workspace commands (use these to scope work):

```bash
# Library unit tests: `server` (node) and `client` (Chromium via Vitest browser mode + Playwright)
pnpm --filter svelte-zukan exec vitest run --project server
pnpm --filter svelte-zukan exec vitest run --project client
cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/discover.test.ts   # single file

# Build tests (each test runs a full `vite build`; slow)
pnpm --filter build-tests test
```

**`example/` resolves `svelte-zukan` from `dist/`.** Run `pnpm run package` first whenever you change library source — CI does this before `check` and before building the example app.

## Library architecture

The public surface is intentionally small:

- `svelte-zukan` (`src/lib/index.ts`) — only `<Section title="...">`, used inside catalog files. In a preview it renders its children only when its `title` matches the section in the preview URL (read from a Svelte context, `src/lib/context.ts`); outside the catalog it always renders.
- `svelte-zukan/vite` (`src/lib/vite/index.ts`) — the `zukan()` Vite plugin (`name: 'vite-plugin-svelte-zukan'`, `enforce: 'pre'`). Options: `suffix`, `groups`, `wrapper`, `logo`, `title`, `locale`, `theme`, `build` (validated in `options.ts`; `suffix` in `matchers.ts`, group names and `groups` directories in `discover.ts`). Keep the option set small; `docs/content/(reference)/options.md` documents each one. CONTRIBUTING.md ("What belongs in svelte-zukan") lists the rules a new feature is checked against.

How the plugin works:

- Discovery (`vite/discover.ts`): with `groups`, only the listed directories are scanned. Without it, the Vite root's own `src`, then the `src` of each dependency whose link in the app's `node_modules`, or else in the workspace root's `node_modules`, resolves outside `node_modules` (a workspace link), in declaration order. Group name is the package's `name`.
- Catalog IDs: `<group>/<path relative to the scanned directory, minus .<suffix>.svelte>`; a trailing `Button/Button` collapses to `Button`. Duplicate IDs throw with both file paths. Group names `preview` and `preview/...` are reserved.
- Metadata (`vite/extract.ts`, `vite/props.ts`, `vite/index.ts`): for each entry, the virtual module `virtual:svelte-zukan/meta/<encoded ID>` parses the catalog file with `svelte/compiler` and exports `{ sections, doc, props, propsType }`, with `Foo.<suffix>.md` rendered by `marked` and the props read from the source of `Foo.svelte` next to it and of the files its props type imports by relative path, up to three deep (never imported; `extractProps` parses a `.ts` file as a `<script module>`). A change to that component, or to one of those files (`propsDeps`), reloads the catalog tab only when its props change (`servedProps`). The detail page imports only this module; only the preview iframe imports the catalog file (and so the component), which keeps the component's CSS and side effects out of the catalog UI. The plugin has no `transform` hook.
- Catalog data (`vite/catalog-json.ts`): `/__zukan/catalog.json` in dev and `<outDir>/catalog.json` in the build list every entry with its sections (code and preview hash), `.md` source, props and paths relative to the Vite root. A catalog file that does not compile gets an `error` instead of failing the response. `uncataloged` (also exported by the list module for the top page) lists the scanned `.svelte` files with no catalog file next to them (`listUncataloged` in `discover.ts`: no `+` route files, tests, or `routes/` under a scanned `src`); creating or deleting such a file reloads only the list. Tools and AI agents read it; keep it free of absolute paths.
- WebMCP (`app/webmcp.ts`): the catalog page (not a preview) registers `list_components`, `get_component`, `open_component` and `check_accessibility`, and `list_tailwind_tokens` when the catalog has Tailwind CSS data, on `navigator.modelContext` / `document.modelContext` when the browser has one, loading the module only then. `check_accessibility` renders the section in an off-screen preview iframe and runs the same `runAxe` (`components/PreviewFrame/run-axe.ts`) as the panel.
- Tailwind CSS tokens (`vite/tailwind-load.ts`, `vite/tailwind-tokens.ts`; the page is `app/Tailwind.svelte` and `app/TailwindTokens.svelte`): entries are the CSS files in the scanned directories and the root `src` that `@import "tailwindcss"` or contain `@theme`, minus those another entry imports. `tailwind-load.ts` is the only module that touches Tailwind's unstable API and the guard around it: it finds the project's own `@tailwindcss/node` (directly, or next to `@tailwindcss/vite` / `@tailwindcss/postcss` / `@tailwindcss/cli`, looked up through the `node_modules` of the entry and of the root, never `NODE_PATH`), takes the `tailwindcss` it depends on, never svelte-zukan's own copy (neither is a runtime dependency of this package), skips v3 silently, gives a version below 4.1.0 an `error`, and turns a missing member of the design-system API into an `error` for that entry, never a failed catalog. `tailwind-tokens.ts` turns a design system into categories and tokens with a small CSS scanner over Tailwind's own output (no postcss). `catalog.json` carries them as `tailwind` (`null`, never `[]`, when no Tailwind CSS entry was found or Tailwind is missing or v3; no sample CSS); a failing entry is a build warning, not a failed build.
- Tailwind virtual modules (`vite/virtual.ts`): `virtual:svelte-zukan/tailwind` is the list (id, file, error and a lazy `load`) and `virtual:svelte-zukan/tailwind/<id>` holds one entry's data and its sample CSS as JS strings, never a CSS import (the catalog's `index.html` links no CSS, and a CSS import would go through the app's CSS pipeline). The entry module imports the list only when `hasTailwind` finds an entry that resolves Tailwind, so a project without Tailwind gets no new file in its build. Generation is lazy (the first demand from the page, `catalog.json` or the build; cached; never at server start). A Tailwind entry first created while the dev server runs does not show until a restart, because the entry module is already generated.
- Dev: `configureServer` serves `/__zukan/` itself (before SvelteKit's middleware) with an HTML that loads the virtual entry `virtual:svelte-zukan/entry`; the list is the virtual module `virtual:svelte-zukan/catalog` (`vite/virtual.ts`). The SPA (`src/lib/app/`) routes by hash (`#/<ID>`, `#/<ID>?section=<title>`, `#/preview/<ID>?section=<title>`); each section previews in a same-origin iframe of the same HTML.
- Build (`build: true`): adds a `zukan` environment and builds it in `buildApp` (`order: 'post'`) after the app, then writes `<outDir>/index.html` (default `zukan-dist/`) with relative URLs.
- Preview (`build: true`): `configurePreviewServer` serves `<outDir>` at `<base>__zukan/` under `vite preview`, before SvelteKit's preview middleware (installed directly, not in a returned hook). GET/HEAD only; a resolved path outside the outDir falls through (`isInside`); content types come from `CONTENT_TYPES` in `index.ts`, so add an entry when the catalog build emits a new asset type (octet-stream breaks module scripts). It sends `preview.headers` like Vite's own responses.

### Behaviors that are easy to break

- Plugin order: `zukan()` must come before `sveltekit()` / `svelte()`; the README says so and `enforce: 'pre'` relies on it.
- `<Section>` rules: `title` must be a non-empty static string, unique in the file, and `<Section>` must be top-level. Each violation is a build error with file and line, and each case has its own message.
- Discovery scans `src` only, never the package root (that would pick up catalog files copied into `dist`), and skips a dependency named `svelte-zukan`: a workspace link to this library (as in `example/`) must not put its internal catalog files into the app's catalog.
- HMR: creating/removing catalog files invalidates the list module; changing a catalog or `.md` file sends the custom event `zukan:reload`, never `full-reload` (that would also reload the app's tabs on the same dev server).
- HMR of the Tailwind CSS data: a change to an entry, to a file its `compile()` reports through `onDependency` or `loadModule`, or the creation or deletion of a `.css` file in the searched directories regenerates in the background, so the app's own CSS update (`@tailwindcss/vite`) is neither delayed nor shown our failure. The dependencies go to `server.watcher` (outside the root only), not `addWatchFile`: that would make each one an import of the Tailwind modules, whose chain up to the entry accepts no update, and Vite would answer `full-reload`. `zukan:reload` is sent only when the data or the sample CSS changed (compared as `servedProps` is), and `hotUpdate` returns `undefined`, never `[]`, so the app's CSS HMR goes on untouched.
- The Tailwind sample iframe always has `color-scheme: light` (on the element and its document root), in every catalog theme: `prefers-color-scheme` inside a frame follows the frame's `color-scheme`, so a dark catalog would switch on `dark:` media variants and `light-dark()`. `theme.entries()` has no dark values either, so this is the base value everywhere.
- SvelteKit runtime APIs are not replaced or mocked. In dev the app and the catalog share one module graph. For the build, and only when SvelteKit is detected (the plugin named `vite-plugin-sveltekit-setup` in the awaited, flattened `plugins`; its `api.options` gives Kit's `outDir`), the catalog environment defines `__SVELTEKIT_PAYLOAD__` (`({ env: {} })`: `$app/env/public` reads `payload.env` on import), `__SVELTEKIT_HAS_SERVER_LOAD__`, `__SVELTEKIT_HAS_UNIVERSAL_LOAD__` and the four `__SVELTEKIT_MANIFEST_*__` of `$app/manifest` (empty arrays). `tests/build` fails if any `__SVELTEKIT_*__` identifier is left in the catalog output — this catches SvelteKit updates that add new client-only replacements.
- Static output: the catalog environment always has `emptyOutDir: false`; before writing, the plugin removes only `<outDir>/_zukan/`, `<outDir>/index.html` and `<outDir>/catalog.json`. Its outDir must not be or contain the Vite root (inside the root is fine, and the default), and must not overlap the app's `build.outDir` or SvelteKit's `kit.outDir` (errors); overlapping `<root>/build` with SvelteKit is only a warning. `renderBuiltUrl` is wrapped so `_zukan/` files get relative URLs (the catalog works under any subpath). Web Workers are the exception: `worker` options and Vite's worker bundles are shared by every environment, so a worker keeps the app's file name; the catalog's `generateBundle` moves every asset outside `_zukan/` under it (and drops SvelteKit's `version.json`), and the wrapper points a `_zukan/` chunk at the moved file.
- `server.fs.allow` is extended only for scanned directories, the wrapper's directory, the logo file and the library's own directory that lie outside the Vite root, added to the existing `allow` list (SvelteKit's or the user's), or to `searchForWorkspaceRoot(root)` when there is none, which is Vite's default.
- Messages: plugin errors and warnings are in English and do not follow `locale`. UI strings come from the two-language dictionary in `src/lib/app/i18n.ts`; strings written by users (group names, section titles) are never translated.
- Published files: `files` in `packages/svelte-zukan/package.json` excludes tests and the library's own `*.zukan.svelte` / `*.zukan.md` from `dist`.
- Dogfooding alias: `packages/svelte-zukan/vite.config.ts` aliases `/^svelte-zukan$/` (exact match) to `src/lib/index.ts` so that `svelte-zukan/vite` is not captured; `tsconfig.json` has the matching `paths`.

## Releases

Versioning and publishing go through **Changesets**:

1. Add a changeset describing the user-facing change. `pnpm exec changeset` is an interactive prompt — as an agent, write `.changeset/<short-slug>.md` directly instead. The only published package is `svelte-zukan`; bump is `patch` / `minor` / `major`:

   ```md
   ---
   'svelte-zukan': minor
   ---

   feat: add the `logo` option.
   ```

   Write changesets in English. Internal-only changes (tests, CI, example app, docs) need **no** changeset.

2. On every push to `main`, `.github/workflows/release.yml` runs `changesets/action`. If there are pending changesets, it opens/updates a "Version Packages" PR (bumping `packages/svelte-zukan/package.json` + CHANGELOG). If there are none (including right after that PR is merged), it runs `pnpm run release` (`changeset publish`), which publishes to npm with provenance any public package whose current version is not on npm yet — usually a no-op. `prepublishOnly` runs `pnpm run package`.

Publishing uses npm **trusted publishing** (OIDC from `release.yml`, no npm token in the repository); provenance is generated automatically. Do not add an `NPM_TOKEN` secret.

Do **not** bump versions or edit `CHANGELOG.md` manually. `pnpm-workspace.yaml` sets a `minimumReleaseAge` so new dependency releases are only installed after a cooldown — preserve that field when editing the workspace file.

## CI and workflows

- `ci.yml` runs on every PR: `lint` (`pnpm run lint`), `check` (`pnpm run package`, a check of the files `npm pack` would publish, then `pnpm run check`), `test` (`pnpm run package`, `pnpm --filter example build`, `pnpm --filter docs build`, Playwright Chromium, then `pnpm run test`, then `build.test.ts` again with `ZUKAN_FROM_DIST=1`), `test-windows` (the library's `server` tests and `tests/build/build.test.ts` (not `dev.test.ts`, which needs the packaged library and Chromium), for drive-letter paths and directory junctions), `build` (`pnpm --filter svelte-zukan build`, which must write `packages/svelte-zukan/zukan-dist/index.html`), and `floor` (packs the library and runs `scripts/floor-smoke.mjs` on the `engines.node` floor: a fresh npm install, `vite build` and a dev server). Replicate that order locally before opening a PR.
- `deploy-docs.yml` runs on pushes to `main` that touch `docs/**` or `packages/svelte-zukan/**` (and on demand). It builds the docs, builds the library's own catalog as the demo (`pnpm --filter svelte-zukan build`), copies `packages/svelte-zukan/zukan-dist` to `docs/dist/demo`, builds it again with `ZUKAN_DEMO_LOCALE=ja` (the `ja` UI, `src/examples-ja/` and `src/ui-ja/`) into `docs/dist/demo/ja`, and deploys `docs/dist` to GitHub Pages (`https://oekazuma.github.io/svelte-zukan/`, demo at `/demo/` and `/demo/ja/`).
- The Version Packages pull request is opened by `changesets/action` with `GITHUB_TOKEN`, which triggers no workflow, so `release.yml` starts `ci.yml` on `changeset-release/main` with `workflow_dispatch` (the exception to that rule). Its checks then satisfy the branch protection on `main`, which requires all six jobs.
- `test-windows` installs pnpm with npm instead of the shared setup action: `pnpm/action-setup` self-updates to the `packageManager` version and leaves a broken pnpm shim on Windows.
- All GitHub Actions are **pinned to a commit SHA** with a `# vX.Y.Z` comment (Renovate opens update PRs; they are reviewed by hand). Preserve this style when adding or editing workflow steps — never use a bare tag like `@v6`. Local composite actions use the self-repository syntax (`uses: $/.github/workflows/<name>`), not `./`.
- `.github/workflows/setup-node/` installs pnpm and the Node version from `devEngines.runtime.version`, then runs `pnpm install --frozen-lockfile`; `.github/workflows/setup-playwright/` caches and installs Chromium for the version in the catalog. To change a toolchain version, edit `package.json` only — not the workflows.

## Tooling notes

- Two Node versions, on purpose: root `devEngines.runtime` pins the dev toolchain (CI, local work; Renovate keeps it current), and `engines.node` of `packages/svelte-zukan/package.json` is the support floor for users (Node 22.17, for `fs.globSync`; the quickstart documents it). A Renovate rule keeps `engines` out of updates; raising the floor is a deliberate, user-facing change with a changeset and a docs update. The `floor` CI job defends it; run it locally with `pnpm run package`, `npm pack` in `packages/svelte-zukan`, then `pnpm --package=node@runtime:22.17.1 dlx node scripts/floor-smoke.mjs <tgz>` from a directory outside the repository.
- Real Vite, no Vite+: the library is a Vite plugin that depends on Vite's internals (Environment API, `buildApp`, `hotUpdate`), so tests run on the same `vite` package users install.
- Prettier: 120 col, single quotes, no trailing commas, `prettier-plugin-svelte` (`.prettierrc`). Run `pnpm run format` before committing — CI's `lint` job will fail otherwise.
- ESLint (`eslint.config.js`): `@eslint/js`, `typescript-eslint` and `eslint-plugin-svelte` recommended configs plus `eslint-config-prettier`, ignoring what `.gitignore` ignores. `.svelte` files use `projectService`, which needs the `$app/tsconfig` that `svelte-kit sync` generates (the library's `prepare` script runs it on install); the build fixtures and the example are linted without type information.
- `.gitignore`: `build`, `dist`, `zukan-dist` and `.svelte-kit` are ignored in every directory, with `!/tests/build/` re-including the build tests package itself. Keep that negation if you touch those lines.
- Language: everything is in English. Commit messages and PR descriptions use Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `docs:`), and changesets are in English. The only Japanese kept on purpose is the Japanese docs (`docs/content/ja/`), the Japanese demo (`packages/svelte-zukan/src/examples-ja/` and `src/ui-ja/`), the `ja` dictionary in `src/lib/app/i18n.ts`, and the tests that cover Japanese / non-ASCII handling.
- Svelte 5 only: use runes (`$props`, `$state`, `$derived`, `$effect`) — do not introduce Svelte 4 reactive `$:` syntax. The supported ranges live in `peerDependencies` (`svelte`, `vite`) of `packages/svelte-zukan/package.json`.
- The agent skills live in `packages/svelte-zukan/skills/`: `svelte-zukan` (setup, catalog files, docs, checks) and `migrate-svelte-zukan` (moving from Storybook or Histoire, which defers to `svelte-zukan` for the rest). They ship in the package (`files`; CI's pack check requires both). `npx skills add oekazuma/svelte-zukan` finds them by searching the repository, because there is no root `skills/` directory: keep every `SKILL.md` in the repository under that directory, or the others are offered too.
- `marked` and `axe-core` are the runtime dependencies. Keep them in `dependencies`; Renovate does not auto-merge their updates because they reach every consumer. The catalog's client never imports `axe-core`: the plugin serves `axe.min.js` as a string (`virtual:svelte-zukan/axe`) and a preview injects it into its own page on the first check, so no CommonJS module goes through the user's dependency prebundling.
- No new dependencies for small things: file listing uses Node's `fs.globSync` (Node 22.17+), and the UI has its own two-language dictionary instead of an i18n library.
