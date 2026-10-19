# svelte-zukan Coding Agent Guide

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a **pnpm workspace monorepo**. The pnpm version is pinned via `packageManager` and the Node version via `devEngines.runtime` in the root `package.json` — check that file for the current values. All shared dependency versions live in the `catalog:` block of `pnpm-workspace.yaml`; package `package.json` files reference them via `"catalog:"` and should not pin versions directly (the published package's runtime `dependencies` are the exception).

Workspace members:

- `docs/` — the documentation site, built with Blume (a markdown-first docs framework on Astro) and deployed to GitHub Pages by `.github/workflows/deploy-docs.yml`. It is **bilingual**: English pages live in `docs/content/`, Japanese translations in `docs/content/ja/` (mirrored paths). Site config (i18n, deployment base) lives in `docs/blume.config.ts`; section ordering comes from `meta.ts` files plus each page's `sidebar.order` frontmatter. When documenting a feature, update **both** locales. The docs are the reference for user-facing behaviour.
- `packages/svelte-zukan/` — the published library (the only public package). Source is in `src/lib/`. The package consumes itself (dogfooding): `vite.config.ts` registers `zukan({ groups: { ui: 'src/lib', examples: 'src/examples' }, wrapper: '.zukan/Wrapper.svelte', build: true })`, `src/routes/` is a one-page introduction that links to `/__zukan/`, and `src/examples/` holds sample catalog files. `vite build` writes the intro page to `build/` and the catalog to `zukan-dist/`.
- `example/` — a SvelteKit app that imports `svelte-zukan` as `workspace:*` and so resolves it from `dist/`. It has no tests of its own, but CI's `test` job builds it (`pnpm --filter example build`) as a smoke check of the built package.
- `tests/build/` (package `build-tests`) — Vitest tests that run `vite build` in a child process on two fixtures and check the written catalog: `monorepo/` (SvelteKit app `apps/catalog` depending on the workspace package `packages/ui`) and `vite-svelte/` (plain Vite + `svelte()`). The fixtures are not workspace members; `monorepo/setup.mjs` links their packages the way pnpm would (directory junctions, so it also works on Windows without admin rights) and links `svelte-zukan` to `packages/svelte-zukan`. The fixtures use the library's **source** unless `ZUKAN_FROM_DIST=1` is set; CI runs `build.test.ts` both ways. `dev.test.ts` starts a dev server on `vite-svelte/` with the built package, forced through Vite's dependency prebundling as an npm install is, and checks a preview in Chromium; it needs `pnpm run package` first.

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
- `svelte-zukan/vite` (`src/lib/vite/index.ts`) — the `zukan()` Vite plugin (`name: 'vite-plugin-svelte-zukan'`, `enforce: 'pre'`). Options: `suffix`, `groups`, `wrapper`, `logo`, `title`, `locale`, `build` (validated in `options.ts`). Keep the option set small; `docs/content/options.md` documents each one.

How the plugin works:

- Discovery (`vite/discover.ts`): with `groups`, only the listed directories are scanned. Without it, the Vite root's own `src`, then the `src` of each dependency whose `node_modules` link resolves outside `node_modules` (a workspace link), in declaration order. Group name is the package's `name`.
- Catalog IDs: `<group>/<path relative to the scanned directory, minus .<suffix>.svelte>`; a trailing `Button/Button` collapses to `Button`. Duplicate IDs throw with both file paths. Group names `preview` and `preview/...` are reserved.
- Metadata (`vite/extract.ts`, `vite/index.ts`): for each entry, the virtual module `virtual:svelte-zukan/meta/<encoded ID>` parses the catalog file with `svelte/compiler` and exports `{ sections, doc }`, with `Foo.<suffix>.md` rendered by `marked`. The detail page imports only this module; only the preview iframe imports the catalog file (and so the component), which keeps the component's CSS and side effects out of the catalog UI. The plugin has no `transform` hook.
- Dev: `configureServer` serves `/__zukan/` itself (before SvelteKit's middleware) with an HTML that loads the virtual entry `virtual:svelte-zukan/entry`; the list is the virtual module `virtual:svelte-zukan/catalog` (`vite/virtual.ts`). The SPA (`src/lib/app/`) routes by hash (`#/<ID>`, `#/preview/<ID>?section=<title>`); each section previews in a same-origin iframe of the same HTML.
- Build (`build: true`): adds a `zukan` environment and builds it in `buildApp` (`order: 'post'`) after the app, then writes `<outDir>/index.html` (default `zukan-dist/`) with relative URLs.

### Behaviors that are easy to break

- Plugin order: `zukan()` must come before `sveltekit()` / `svelte()`; the README says so and `enforce: 'pre'` relies on it.
- `<Section>` rules: `title` must be a non-empty static string, unique in the file, and `<Section>` must be top-level. Each violation is a build error with file and line, and each case has its own message.
- Discovery scans `src` only, never the package root (that would pick up catalog files copied into `dist`), and skips a dependency named `svelte-zukan`: a workspace link to this library (as in `example/`) must not put its internal catalog files into the app's catalog.
- HMR: creating/removing catalog files invalidates the list module; changing a catalog or `.md` file sends the custom event `zukan:reload`, never `full-reload` (that would also reload the app's tabs on the same dev server).
- SvelteKit runtime APIs are not replaced or mocked. In dev the app and the catalog share one module graph. For the build, and only when SvelteKit is detected (a plugin named `vite-plugin-sveltekit*` in the awaited, flattened `plugins`), the catalog environment defines `__SVELTEKIT_PAYLOAD__`, `__SVELTEKIT_HAS_SERVER_LOAD__` and `__SVELTEKIT_HAS_UNIVERSAL_LOAD__`. `tests/build` fails if any `__SVELTEKIT_*__` identifier is left in the catalog output — this catches SvelteKit updates that add new client-only replacements.
- Static output: the catalog environment always has `emptyOutDir: false`; before writing, the plugin removes only `<outDir>/_zukan/` and `<outDir>/index.html`. Its outDir must not overlap the Vite root, the app's `build.outDir` or SvelteKit's `kit.outDir` (errors); overlapping `<root>/build` with SvelteKit is only a warning. `renderBuiltUrl` is wrapped so `_zukan/` files get relative URLs (the catalog works under any subpath).
- `server.fs.allow` is extended only for scanned directories, the wrapper/logo directories and the library's own directory that lie outside the Vite root, added to the existing `allow` list (SvelteKit's or the user's), or to `searchForWorkspaceRoot(root)` when there is none, which is Vite's default.
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

- `ci.yml` runs on every PR: `lint` (`pnpm run lint`), `check` (`pnpm run package` then `pnpm run check`), `test` (`pnpm run package`, `pnpm --filter example build`, `pnpm --filter docs build`, Playwright Chromium, then `pnpm run test`), `test-windows` (the library's `server` tests and `tests/build`, for drive-letter paths and directory junctions), and `build` (`pnpm --filter svelte-zukan build`, which must write `packages/svelte-zukan/zukan-dist/index.html`). Replicate that order locally before opening a PR.
- `deploy-docs.yml` runs on pushes to `main` that touch `docs/**` or `packages/svelte-zukan/**` (and on demand). It builds the docs, builds the library's own catalog as the demo (`pnpm --filter svelte-zukan build`), copies `packages/svelte-zukan/zukan-dist` to `docs/dist/demo`, and deploys `docs/dist` to GitHub Pages (`https://oekazuma.github.io/svelte-zukan/`, demo at `/demo/`).
- The Version Packages pull request is opened by `changesets/action` with `GITHUB_TOKEN`, which triggers no workflow, so `release.yml` starts `ci.yml` on `changeset-release/main` with `workflow_dispatch` (the exception to that rule). Its checks then satisfy the branch protection on `main`, which requires all five jobs.
- `test-windows` installs pnpm with npm instead of the shared setup action: `pnpm/action-setup` self-updates to the `packageManager` version and leaves a broken pnpm shim on Windows.
- All GitHub Actions are **pinned to a commit SHA** with a `# vX.Y.Z` comment (Renovate keeps them updated). Preserve this style when adding or editing workflow steps — never use a bare tag like `@v6`. Local composite actions use the self-repository syntax (`uses: $/.github/workflows/<name>`), not `./`.
- `.github/workflows/setup-node/` installs pnpm and the Node version from `devEngines.runtime.version`, then runs `pnpm install --frozen-lockfile`; `.github/workflows/setup-playwright/` caches and installs Chromium for the version in the catalog. To change a toolchain version, edit `package.json` only — not the workflows.

## Tooling notes

- Real Vite, no Vite+: the library is a Vite plugin that depends on Vite's internals (Environment API, `buildApp`, `hotUpdate`), so tests run on the same `vite` package users install.
- Prettier: 120 col, single quotes, no trailing commas, `prettier-plugin-svelte` (`.prettierrc`). Run `pnpm run format` before committing — CI's `lint` job will fail otherwise.
- ESLint (`eslint.config.js`): `@eslint/js`, `typescript-eslint` and `eslint-plugin-svelte` recommended configs plus `eslint-config-prettier`, ignoring what `.gitignore` ignores. `.svelte` files use `projectService`, which needs the `$app/tsconfig` that `svelte-kit sync` generates (the library's `prepare` script runs it on install); the build fixtures and the example are linted without type information.
- `.gitignore`: `build`, `dist`, `zukan-dist` and `.svelte-kit` are ignored in every directory, with `!/tests/build/` re-including the build tests package itself. Keep that negation if you touch those lines.
- Language: everything is in English. Commit messages and PR descriptions use Conventional Commits prefixes (`feat:`, `fix:`, `chore:`, `docs:`), and changesets are in English. The only Japanese kept on purpose is the Japanese docs (`docs/content/ja/`), the `ja` dictionary in `src/lib/app/i18n.ts`, and the tests that cover Japanese / non-ASCII handling.
- Svelte 5 only: use runes (`$props`, `$state`, `$derived`, `$effect`) — do not introduce Svelte 4 reactive `$:` syntax. The supported ranges live in `peerDependencies` (`svelte`, `vite`) of `packages/svelte-zukan/package.json`.
- `marked` is the runtime dependency of the plugin. Keep it in `dependencies`; Renovate does not auto-merge its updates because they reach every consumer.
- No new dependencies for small things: file listing uses Node's `fs.globSync` (Node 22.17+), and the UI has its own two-language dictionary instead of an i18n library.
