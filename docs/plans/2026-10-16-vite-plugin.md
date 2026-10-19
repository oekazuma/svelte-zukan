# svelte-zukan /__zukan/ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Just by adding `zukan()` to `vite.config.ts`, the catalog appears at `/__zukan/` on the dev server. With `build: true`, `vite build` writes the catalog out as a static SPA.

**Architecture:** The plugin decides the search directories (automatic discovery or `groups`), enumerates `*.<suffix>.svelte` with `fs.globSync`, and builds the list's virtual module. In dev, the `configureServer` middleware returns HTML at `/__zukan/`, and the virtual entry starts the library's SPA (routed by hash). In the build, it adds `environments.zukan`, builds the JS entry in `buildApp`, and writes the HTML.

**Tech Stack:** Svelte 5.57 (runes), Vite 8.3 (Environment API, `buildApp`), SvelteKit 3.0.1 and `@sveltejs/vite-plugin-svelte` (only on the app side of dogfooding and fixtures), vitest 4, Node 22.17 or later

**Spec:** `docs/specs/2026-10-16-catalog.md` (this revision)

**Leftovers from the previous plan:** The minor review comments deferred in the review of the previous plan (the implementation plan for the route-file approach; the file has been deleted and survives only in git history) have been assigned to the tasks of this plan (to be fixed) or added with reasons to the spec's "Out of scope" section

**Prerequisites:** The logo SVGs (`src/lib/app/logo.svg`, `src/lib/app/icon.svg`, `.github/logo.svg`, `.github/logo-dark.svg`, `static/favicon.svg`) have been placed by the controller and are included in the commits of Task 4 and Task 6. Tasks 1 to 6 of the previous plan are complete. The commits that were stacked earlier in Task 7 (2fb60eb, 509917c) are redone in Task 6 of this plan. The spec's "Findings from the spike" has been carried out by the controller (the code is not committed).

## Global Constraints

- Do not add new dependencies (`pnpm install` is not needed). Removing `@sveltejs/kit` from `peerDependencies` and adding `vite` is only an edit to package.json
- There are 7 options: `suffix`, `groups`, `wrapper`, `logo`, `title`, `locale`, `build`. The defaults are as in the spec (`suffix: 'zukan'`, `title: 'zukan'`, `locale: 'en'`, `build: false`, and `outDir: 'zukan-dist'` when `build: true`)
- Accept only `/^[a-z0-9-]+$/i` as the suffix, and escape it when putting it into a regular expression
- Compare and print paths only after passing them through `vite`'s `normalizePath`
- Catalog URLs are hash-based: `#/<ID>`, `#/preview/<ID>?section=<title>`
- All UI strings come from the spec's dictionary (en / ja). The plugin's error messages are English only
- Library code does not import `$app/*`
- Commit messages are in English in the form `feat: ...` / `fix: ...` / `chore: ...`. Do not write the background or Co-Authored-By
- At the end of each task, `pnpm lint`, `pnpm check`, and `node_modules/.bin/vitest run --project server` must pass. For client tests, use `node_modules/.bin/vitest run --config .superpowers/vitest.sandbox.config.ts --no-file-parallelism` (do not commit this config)
- Subagents do not start dev servers or static servers. Verification in the browser is done by the controller with the preview feature

## Review Focus

- Tabs of the app connected to the same dev server are not reloaded when a catalog file is edited (use `zukan:reload`. Task 3 tests, Task 6 verification)
- Global CSS imported by `wrapper` does not affect the catalog's UI side (dynamic import only for the preview. Task 4 tests, Task 6 verification)
- Group names containing `/` and IDs containing `preview` in the middle round-trip correctly through the hash (Task 4 tests of `parseHash` / `formatHash`)
- Even when the built catalog is placed under a subpath (for example, `/docs/zukan/`), deep links and the preview open (Task 5 tests, Task 6 verification)
- A SvelteKit update leaves Kit's replacements (`__SVELTEKIT_*__`) in the catalog build and breaks components that use `$app/*` (Task 7 automated test)
- `/__zukan/` opens in an app with Vite's `base` set (Task 3 tests, Task 7 verification)

## File structure

| File                                           | Role                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/vite/index.ts`                        | `zukan(options?)`. Option validation, transform, virtual modules, dev middleware, watching, `fs.allow`, build                                     |
| `src/lib/vite/discover.ts` (new)               | `discoverGroups` and `listCatalog`                                                                                                                |
| `src/lib/vite/html.ts` (new)                   | `renderHtml`, which builds the HTML for dev and build                                                                                             |
| `src/lib/vite/extract.ts`                      | Make the `title` validation finer-grained (Task 1)                                                                                                |
| `src/lib/app/` (new)                           | The catalog SPA. `App.svelte` (hash router), `Sidebar.svelte`, `List.svelte`, `Detail.svelte`, `Preview.svelte`, `hash.ts`, `i18n.ts`, `logo.svg` |
| `src/lib/components/`                          | `Badge`, `CodeBlock`, `PreviewFrame`, and `EntryList` stay, and receive their strings from the dictionary                                         |
| `src/lib/Section.svelte`, `src/lib/context.ts` | No changes                                                                                                                                        |
| Deleted                                        | `src/lib/Zukan.svelte`, `src/lib/components/Detail.svelte` and `Preview.svelte` (moved to `app/`), `src/lib/entries.ts`, the `Groups` type        |
| `fixtures/monorepo/`                           | For monorepo verification                                                                                                                         |

---

### Task 1: Suffix option and one-to-one `.md` correspondence

**Files:** Modify `src/lib/vite/index.ts` and `src/lib/vite/extract.ts`, Test `src/lib/vite/index.test.ts` and `src/lib/vite/extract.test.ts`

**Interfaces:**

- Produces:
  - `type ZukanOptions = { suffix?; groups?; wrapper?; logo?; title?; locale?; build? }` (as in the spec's type. This task uses only `suffix` and merely accepts the rest)
  - `zukan(options?: ZukanOptions): Plugin`
  - `createMatchers(suffix: string): { isCatalogId(id): boolean; isCatalogFile(file): boolean; isDocFile(file): boolean; docFileOf(catalogFile): string; catalogFileOf(docFile): string }` (replaces `isZukanId`)

- [ ] **Step 1: Write the failing tests**
  - `createMatchers('zukan')`: `/a/Foo.zukan.svelte`, and the same with `?v=1`, make `isCatalogId` true. With `?svelte&type=style&lang.css`, with `\0`, and `/a/Foo.svelte` it is false
  - `createMatchers('catalog')`: `/a/Foo.catalog.svelte` is true, `/a/Foo.zukan.svelte` is false
  - `docFileOf('/a/Foo.zukan.svelte')` is `'/a/Foo.zukan.md'`, and `catalogFileOf` is the reverse
  - `rejects invalid suffix`: `'a.b'` and `''` throw (the message contains `suffix`)
  - transform: if `Foo.zukan.md` exists, its HTML is included and `addWatchFile` is called with its absolute path. With `suffix: 'catalog'`, it reads `Foo.catalog.md`
  - hotUpdate: for create / update / delete of `Foo.zukan.md`, `getModulesByFile` is called with `normalizePath('<dir>/Foo.zukan.svelte')` (`readdirSync` is not used). It does not throw even when `Foo.zukan.svelte` is not yet in the module graph (`getModulesByFile` returns `undefined`)
  - `filter agrees with isCatalogId`: the results of applying `include` and `exclude` of `transform.filter.id` to several IDs match `isCatalogId` (a response to the previous plan's "filter tests are shallow")
  - extract (leftovers from the previous plan):
    - `throws on empty title`: `title=""` and `title="  "` are errors as an empty title
    - `missing and dynamic title have different messages`: a missing `title` and `title={x}` have different messages
    - `collects dotted component root`: with `<Foo.Bar />`, the definition of `Foo` is attached
    - `collects transition and animate names`: the definitions of the names in `transition:fade`, `in:fly`, and `animate:flip` are attached
- [ ] **Step 2: Confirm the failure** → **Step 3: Implement** → **Step 4: Confirm PASS**
- [ ] **Step 5: Commit** `feat: make the catalog file suffix configurable`

### Task 2: Discovery and list building

**Files:** Create `src/lib/vite/discover.ts`, Test `src/lib/vite/discover.test.ts`, Modify `src/lib/types.ts`

**Interfaces:**

- Consumes: `createMatchers` (Task 1)
- Produces:
  - `type CatalogGroup = { name: string; dirs: string[] }` (`dirs` are `normalizePath`-ed absolute paths)
  - `discoverGroups(root: string, groups?: Record<string, string | string[]>): CatalogGroup[]`
  - `type CatalogItem = { group: string; name: string; dir: string; path: string; file: string }` (`path` is the spec's ID)
  - `listCatalog(groups: CatalogGroup[], suffix: string): CatalogItem[]`

- [ ] **Step 1: Write the failing tests.** Build the layout in a temporary directory (workspace links with `fs.symlinkSync`)
  - Discovery: `single package`, `workspace dependency` (in the order `app` → `@acme/ui`), `skips installed packages` (a real directory `node_modules/lodash`), `dependencies before devDependencies`, `groups option` (key order, no automatic discovery), `missing groups dir throws`
  - ID:
    - `same name in different dirs`: `src/lib/forms/Button.zukan.svelte` and `src/lib/nav/Button.zukan.svelte` → `app/lib/forms/Button` and `app/lib/nav/Button`, `name` is `Button` for both, and `dir` is `lib/forms` and `lib/nav`
    - `collapses Dir/Dir`: `src/lib/Button/Button.zukan.svelte` → `app/lib/Button`, and `dir` is `lib`
    - `groups option is relative to the given dir`, `root file has empty dir`
    - `stable when files are added`: even if a file with the same name is added in another directory and the list is rebuilt, the `path` of existing items does not change
    - `suffix: 'catalog'`, `scoped group name` (`@acme/ui/lib/Card`), `rel may contain preview` (`ui/preview/Foo` is not an error)
  - Order: group order; within a group, compare `rel` with `Intl.Collator('en', { numeric: true, sensitivity: 'base' })`, ties by code point order. `alert` comes before `Button`, and `Item2` before `Item10`
  - Errors (containing the file path or group name): the group names `preview` and `preview/x`, duplicates after merging, duplicates across groups
  - `group without files is dropped`, `no files at all → []`
- [ ] **Step 2: Confirm the failure** → **Step 3: Implement** → **Step 4: Confirm PASS**
- [ ] **Step 5: Commit** `feat: discover catalog files and build the list`

### Task 3: Dev `/__zukan/`, the list's virtual module, watching, `fs.allow`

**Files:** Create `src/lib/vite/html.ts`, Modify `src/lib/vite/index.ts`, Test `src/lib/vite/index.test.ts` and `src/lib/vite/html.test.ts`

**Interfaces:**

- Consumes: `discoverGroups`, `listCatalog` (Task 2)
- Produces:
  - Virtual module IDs: the entry `\0virtual:svelte-zukan/entry` and the list `\0virtual:svelte-zukan/catalog` (both resolved in `resolveId` from `virtual:svelte-zukan/...`)
  - `generateCatalogModule(items: CatalogItem[]): string`
  - `generateEntryModule(opts: { appFile: string; logo: string | null; wrapper: string | null; title: string; locale: 'en' | 'ja' }): string` (`appFile` and the like are `normalizePath`-ed absolute paths. `logo` is imported with `?url`. `wrapper` is passed as a `() => import(...)` function)
  - `renderHtml(opts: { title: string; locale: 'en' | 'ja'; entrySrc: string; icon: string }): string` (`icon` is an SVG string. It is URL-encoded and embedded in `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">`)
  - `extendFsAllow(root: string, dirs: string[], allow: string[] | undefined): string[] | undefined`
  - `resolveOptions(root: string, options: ZukanOptions)`: fills in the defaults and returns the result of validating `locale`, `suffix`, and the existence of the `wrapper` and `logo` files

- [ ] **Step 1: Write the failing tests**
  - `renderHtml`: `<html lang="ja">`, `<title>` is `title`, `<script type="module" src="...">` is `entrySrc`, there is a `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">`, and decoding it gives back the SVG that was passed. `<` and the like in `title` are escaped
  - `generateCatalogModule`: contains `import("/abs/Card.zukan.svelte")` and `"path":"@acme/ui/lib/Card"`
  - `generateEntryModule`: with `logo: null`, there is no logo import. With `wrapper: null`, `wrapper` is `null`
  - `resolveOptions`: defaults; `locale: 'fr'` throws; a nonexistent `wrapper` / `logo` throws (an English message containing the path)
  - middleware: with a fake `server` (`middlewares.use` records, `transformIndexHtml` returns its input as is), `/__zukan/` and `/__zukan/?x` get HTML, while `/` and `/__zukanx` go to `next()`. Even with `server.config.base` of `/app/`, it handles `/app/__zukan/`
  - `extendFsAllow`: `undefined` if all search directories are inside `searchForWorkspaceRoot(root)`. If any is outside, `[searchForWorkspaceRoot(root), ...allow, ...outside ones]`
  - hotUpdate:
    - On create / delete of `X.zukan.svelte` inside a search directory, the list's virtual module is invalidated, and in the client environment `hot.send({ type: 'custom', event: 'zukan:reload' })` is sent. `full-reload` is not sent
    - Creation outside the search directories is ignored
  - `configureServer` calls `server.watcher.add` only for search directories outside the root
  - `printUrls`: wraps `server.printUrls` and adds one line with the catalog URL
- [ ] **Step 2: Confirm the failure** → **Step 3: Implement** (discovery is done once in `configResolved`, and `listCatalog` is redone on each create / delete. The SPA's `appFile` is computed from the plugin file's location with `new URL('../app/App.svelte', import.meta.url)`) → **Step 4: Confirm PASS**
- [ ] **Step 5: Commit** `feat: serve the catalog at /__zukan/ on the dev server`

### Task 4: The catalog SPA

**Files:**

- Create: `src/lib/app/App.svelte`, `Sidebar.svelte`, `List.svelte`, `Detail.svelte`, `Preview.svelte`, `hash.ts`, `i18n.ts` (use the already placed `logo.svg` and `icon.svg`)
- Modify: `src/lib/components/CodeBlock/CodeBlock.svelte` (receive strings via props. Move the copy button into the toolbar on the `<summary>` line. Display on failure), `PreviewFrame/PreviewFrame.svelte` (receive strings via props. Home / End keys, align `aria-valuemin` with the viewport width, do not show the width display and aria values until measured), `EntryList.svelte` (add `dir`), `src/lib/index.ts` (export only `Section`), `src/lib/types.ts` (delete `Groups`), `package.json` (remove `@sveltejs/kit` from `peerDependencies` and add `vite`)
- Delete: `src/lib/Zukan.svelte`, `src/lib/components/Detail.svelte`, `src/lib/components/Preview.svelte`, `src/lib/entries.ts`, `src/lib/entries.test.ts`
- Test: `src/lib/app/hash.test.ts`, `src/lib/app/i18n.test.ts`, `src/lib/components/EntryList.svelte.test.ts` (client), `PreviewFrame.svelte.test.ts` and `CodeBlock.svelte.test.ts` (client, additions), fixes to the existing client tests

**Interfaces:**

- Consumes: the props that `generateEntryModule` passes (Task 3), `CatalogItem` (Task 2)
- Produces:
  - `App` props: `{ catalog: (CatalogItem & { load: () => Promise<ZukanModule> })[]; logo: string | null; wrapper: (() => Promise<{ default: Component }>) | null; title: string; locale: 'en' | 'ja' }`
  - `parseHash(hash: string): { view: 'list' } | { view: 'detail'; path: string } | { view: 'preview'; path: string; section: string | null }`
  - `formatHash(view: 'detail' | 'preview', path: string, section?: string): string`
  - `messages: Record<'en' | 'ja', Messages>` (keys as in the spec's dictionary table)

- [ ] **Step 1: Write the failing tests**
  - `parseHash` / `formatHash`:
    - `''`, `'#'`, and `'#/'` are list
    - `formatHash('detail', '@acme/ui/lib/Card')` gives `'#/%40acme/ui/lib/Card'`, and `parseHash` returns it to `@acme/ui/lib/Card`
    - `formatHash('preview', 'ui/preview/Foo', 'a b?c')` round-trips (`section` comes back too)
    - `#/preview/ui/Button` has a section of `null`
    - Japanese IDs also round-trip
  - `i18n`: the key sets of `en` and `ja` match, and there are no empty strings
  - `EntryList` (client): `shows dir to tell same names apart`. With two items with the same `name`, each `dir` is shown and the link targets (`#/...`) differ
  - Fix the existing client tests that locate elements by Japanese strings (the dictionary's `code`, `copy`, `previewWidth` values, and so on) so that they locate them by the English default values
  - PreviewFrame (client. Leftovers from the previous plan):
    - `keyboard resize`: focus the handle, ArrowLeft makes it 10px narrower, Home gives 200px, End gives the viewport width
    - `drag resize`: sending `pointerdown` → `pointermove` (+50px) → `pointerup` on the handle widens it by 50px, and `pointer-events: none` is set on the iframe only during the drag. It does not start with the right button (`button: 2`)
    - `aria-valuemin follows a narrow stage`: with a viewport of 150px, `aria-valuemin` is 150 and `aria-valuenow` does not fall below it
    - `height follows the preview`: set `src` to `about:blank`, and after loading, put an element with `[data-zukan-preview]` (300px high) into `contentDocument`; the iframe's height becomes 300px
  - CodeBlock (client): `copy failure is shown`: when `navigator.clipboard.writeText` rejects, the `copyFailed` text appears. The copy button is in the same toolbar as the `<summary>`
- [ ] **Step 2: Confirm the failure** → **Step 3: Implement**
  - `App` subscribes to `hashchange` and, based on the result of `parseHash`, switches between list / detail with the sidebar and preview without UI
  - Only for the preview, dynamically import `wrapper` and wrap with it. If there is a `section`, call `setPreviewSection`
  - `import.meta.hot?.on('zukan:reload', () => location.reload())`
  - `document.title` is as in the spec (`title` on the list, `<name> | <title>` on a detail page)
  - Logo: if `logo` is given, `<img alt={title}>`; otherwise the bundled `logo.svg` (about 32px high) (`logo: false` makes `generateEntryModule` pass `null`, and the `title` string is shown. Whether it is distinguished from the bundled logo by `logo` being `undefined` or `false` is decided in Task 3)
  - Define the internal CSS variables on the root element (the same defaults as the earlier `Zukan.svelte`)
  - Carry over the handling that was put into the earlier `Zukan.svelte`: the display for load failures, not carrying over the previous item's PreviewFrame state when the detail is switched (`{#key}`), the sidebar's `<nav aria-label>`, and the list's `h1`
- [ ] **Step 4: Confirm PASS** (server and client)
- [ ] **Step 5: Commit** `feat: make the catalog an SPA that does not depend on SvelteKit`

### Task 5: Static output

**Files:** Modify `src/lib/vite/index.ts`, Test `src/lib/vite/index.test.ts`

**Interfaces:**

- Consumes: `renderHtml`, `generateEntryModule` (Task 3)
- Produces:
  - `detectSvelteKit(plugins: unknown[]): Promise<boolean>` (flattens nested arrays and Promises, and checks whether any name starts with `vite-plugin-sveltekit`)
  - When `build` is enabled, the return value of the `config` hook includes `environments.zukan` (`consumer: 'client'`, `define: { __SVELTEKIT_PAYLOAD__: 'undefined', __SVELTEKIT_HAS_SERVER_LOAD__: 'false', __SVELTEKIT_HAS_UNIVERSAL_LOAD__: 'false' }` only when Kit is detected, `build.outDir`, `build.manifest: false`, `build.rolldownOptions.input: { zukan: 'virtual:svelte-zukan/entry' }`, and output file names following a fixed rule such as `assets/[name]-[hash].js` / `.css`)
  - `buildApp` hook: `builder.build(builder.environments.zukan)` → find the entry chunk and write `<outDir>/index.html` with `renderHtml({ entrySrc: './' + fileName })` → delete `<outDir>/_app/version.json` if it exists

- [ ] **Step 1: Write the failing tests**
  - With `build: false` (the default), `config` does not return `environments.zukan` and `buildApp` does nothing
  - `detectSvelteKit`: true for `[Promise.resolve([{ name: 'vite-plugin-sveltekit-setup' }])]`, false for `[[{ name: 'vite-plugin-svelte' }], null, false]`
  - When Kit is not detected, `define` is not put into `environments.zukan`
  - With `build: true`, `outDir` is `<root>/zukan-dist`, and with `build: { outDir: 'out/catalog' }` it is `<root>/out/catalog`
  - `buildApp`: with a fake `builder` (`build` returns an output containing the entry chunk `assets/zukan-abc.js`), the script in `index.html` becomes `./assets/zukan-abc.js`. `_app/version.json` is deleted
- [ ] **Step 2: Confirm the failure** → **Step 3: Implement** → **Step 4: Confirm PASS**
- [ ] **Step 5: Commit** `feat: allow vite build to write the catalog statically`

### Task 6: Dogfooding and README

**Files:**

- Move: `src/lib/components/{Badge,CodeBlock}/zukan/*` next to the components (`git mv`. Rename `Document.md` to `<Name>.zukan.md` and fix the relative imports inside). Do the same for `src/examples/Button/zukan/*`
- Create: `src/examples/nav/Button/Button.zukan.svelte` (for checking same names), `src/examples/PageInfo/PageInfo.svelte` and `PageInfo.zukan.svelte` (a component that only shows `page.url.pathname` from `$app/state` and `resolve('/')` from `$app/paths`. For checking how Kit's runtime APIs behave in the catalog), `.zukan/Wrapper.svelte` (an example that imports one global CSS file and wraps `children`), `.zukan/global.css` (for example, `body { background: #fffbe6 }`)
- Delete: `src/routes/zukan/`
- Modify: `src/routes/+page.svelte` (an introduction to the library and, in dev, a link to `/__zukan/`), `vite.config.ts` (`zukan({ groups: { ui: 'src/lib', examples: 'src/examples' }, wrapper: '.zukan/Wrapper.svelte', build: true, locale: 'ja' })`, keep `resolve.alias`), `package.json` (make `files` `!dist/**/*.zukan.svelte` and `!dist/**/*.zukan.md`. Make `description` and `keywords` as in the spec's "Supported environments"), `.gitignore` (`/zukan-dist`), `README.md`

- [ ] **Step 1: Move and fix the files**
- [ ] **Step 2: Rewrite the README** (as in the spec's "README" section. The top switches `.github/logo-dark.svg` and `.github/logo.svg` with `<picture>`. Include the line "not an official Svelte project")
- [ ] **Step 3: Get `pnpm lint`, `pnpm check`, the server / client tests, and `pnpm build` to pass.** `zukan-dist/index.html` and `zukan-dist/assets/` exist, and `zukan-dist/_app` does not. `pnpm pack --dry-run` contains no files with `.zukan.`
- [ ] **Step 4: Commit** `feat: move catalog files next to their components`, `chore: rewrite the README`
- [ ] **Step 5 (controller): Start dev with the preview feature and verify**
  - The list at `/__zukan/` is in the order `ui` → `examples` with badges. Two `Button`s appear side by side, and one has `nav` attached. The UI is in Japanese, `<html lang="ja">`, and the sidebar logo and the tab favicon are the bundled zukan ones
  - Detail, preview, code, `.md`
  - The preview background is the color of `.zukan/global.css`, and the background of the catalog's UI side does not change
  - With the app's `/` open in another tab, creating, deleting, and editing a catalog file reloads only the catalog's tab. Editing `Button.svelte` is reflected in both tabs by HMR
  - Display a small component that uses `resolve` from `$app/paths` in the catalog, and write the result in the README
- [ ] **Step 6 (controller):** Serve `zukan-dist` statically under a subpath (for example, `/docs/zukan/`), and confirm that the list, the deep link `#/examples/nav/Button`, and the preview open. Confirm that `#/examples/PageInfo` renders without errors (a check that the `__SVELTEKIT_PAYLOAD__` define is effective)

### Task 7: Fixtures (SvelteKit monorepo and plain Vite)

**Files:**

- Create: `fixtures/monorepo/apps/catalog/` (`package.json`: name `catalog`, with `@fixture/ui` and `svelte-zukan` in `dependencies`. `vite.config.ts`: register `zukan()` with no configuration, plus `sveltekit()` and adapter-static. `src/app.html`, `src/routes/+page.svelte`, `src/routes/+layout.ts`. For the second check, also place `vite.config.base.ts` (a config with `base: '/app/'`))
- Create: `fixtures/monorepo/packages/ui/` (`package.json`: name `@fixture/ui`, `imports: { "#lib/*": "./src/lib/*" }`. `src/lib/Card/Card.svelte` imports `#lib/label.js`, `Card.zukan.svelte`, `Card.zukan.md`, and `src/lib/forms/Button.zukan.svelte` and `src/lib/nav/Button.zukan.svelte` for checking same names)
- Create: `fixtures/monorepo/packages/ui/src/lib/PageInfo/PageInfo.svelte` and `PageInfo.zukan.svelte` (using `$app/state`)
- Create: `fixtures/vite-svelte/` (plain Vite + Svelte. `package.json`: name `vite-svelte`, `vite.config.ts`: `svelte()` and `zukan({ build: true })`, `index.html`, `src/main.ts`, `src/lib/Counter/Counter.svelte` and `Counter.zukan.svelte`)
- Create: `fixtures/build.test.ts` (included in the server project. Step 1 below)
- Create: `fixtures/monorepo/setup.mjs` (creates the symlinks `apps/catalog/node_modules/@fixture/ui` → `../../../packages/ui` and `apps/catalog/node_modules/svelte-zukan` → the repo root)
- Modify: `.gitignore` (`fixtures/**/.svelte-kit`, `fixtures/**/build`, `fixtures/**/dist`, `fixtures/**/zukan-dist`), `vite.config.ts` (add `fixtures/**/*.test.ts` to the server project's `include`), `.github/workflows/ci.yml` (add a job that runs only the server project's tests on `windows-latest`. This responds to the spec's "Windows paths with drive letters are checked in CI")

The fixture's `vite.config.ts` reads `svelte-zukan/vite` (the repo root's dist via the symlink from setup.mjs) if the environment variable `ZUKAN_FROM_DIST` is set, and otherwise reads the repo's `src/lib/vite/index.ts` by relative path. For `svelte-zukan` in catalog files, likewise, when it is not set, `resolve.alias` points to `src/lib/index.ts`. The automated tests run on src without building dist, and the controller's verification is done on dist.

Do not put a `pnpm-workspace.yaml` in the fixtures. If one is present, Vite's `searchForWorkspaceRoot` stops there, the repo root's `dist` falls outside the allowed range, and requests get a 403 regardless of what the plugin does.

- [ ] **Step 1: Write the automated tests** (`fixtures/build.test.ts`, timeout 120 seconds)
  - Run `node fixtures/monorepo/setup.mjs` in `beforeAll`
  - `kit monorepo build`: run `node <repo>/node_modules/vite/bin/vite.js build` as a child process with `fixtures/monorepo/apps/catalog` as `cwd` (SvelteKit uses `process.cwd()` as the project root, so do not use `createBuilder` inside a vitest worker). Exit code 0, `zukan-dist/index.html` exists, none of `zukan-dist/assets/*.js` contains anything matching `/__SVELTEKIT_[A-Z_]+__/`, and `zukan-dist/_app` does not exist
  - `plain vite build`: likewise run `vite build` in `fixtures/vite-svelte`. Exit code 0, and both the app's `dist/` and `zukan-dist/index.html` are produced
- [ ] **Step 2: Create the files and confirm the tests pass.** `pnpm lint` and `pnpm check` pass
- [ ] **Step 3: Commit** `chore: add SvelteKit and plain Vite fixtures`
- [ ] **Step 4 (controller): After `node fixtures/monorepo/setup.mjs` and `pnpm build` (which builds the repo root's dist), start the fixture app's dev with the preview feature using `ZUKAN_FROM_DIST=1` and verify**
  - With no configuration, the group `@fixture/ui` is attached, and the detail and preview of `#/@fixture/ui/lib/Card` open
  - Two `Button`s appear side by side and can be told apart by `lib/forms` and `lib/nav`
  - `#lib/label.js` inside Card is resolved on the ui side
  - The `Section` of `svelte-zukan` loaded via `node_modules` uses the same context as the SPA (in a preview with `section` specified, only the specified section appears)
  - Creating `packages/ui/src/lib/New/New.zukan.svelte` makes it appear in the list without a restart
  - No 403 appears
  - Starting with `vite.config.base.ts` opens `/app/__zukan/`
  - `vite build` with `build: true` writes `zukan-dist/index.html`, and it opens when served statically. `#/@fixture/ui/lib/PageInfo` renders without errors in the built version too
- [ ] **Step 5 (controller): Start the plain Vite fixture's dev with `ZUKAN_FROM_DIST=1` and verify**
  - The list, detail, and preview at `/__zukan/` open, and the app's `/` works too
  - Editing `Counter.svelte` is reflected in both the app and the catalog by HMR. Editing `Counter.zukan.svelte` reloads only the catalog's tab
  - Serve the result of `vite build` with `build: true` statically, and the catalog opens
- [ ] **Step 6: Write the results in the ledger**
