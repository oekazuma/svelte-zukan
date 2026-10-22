# Tailwind CSS tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the resolved Tailwind CSS v4 theme of the project as a "Tailwind CSS" page in the catalog, and give the same data to agents through `catalog.json` and WebMCP.

**Architecture:** The plugin finds Tailwind CSS entries in the searched `src` directories and loads each one with the project's own `@tailwindcss/node` and the `tailwindcss` it depends on: `__unstable__loadDesignSystem` for the theme and the class list, `compile().build(classes)` for the sample stylesheet and the files to watch. CSS imports resolve through Vite's resolver the way `@tailwindcss/vite` does. The data reaches the catalog through lazily loaded JS virtual modules, the page renders the samples inside a same-origin iframe, and agents read the same data from `catalog.json` and one WebMCP tool.

**Tech Stack:** Vite 8 plugin (`createIdResolver`, `hotUpdate`, Environment API), Svelte 5 runes, Vitest (`server` and `client` projects), Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/node`, `@tailwindcss/vite`) as dev dependencies only.

**Spec:** `docs/superpowers/specs/2026-10-22-tailwind-tokens-design.md`

## Global Constraints

- Tailwind CSS 4.1.0 or later only (`candidatesToAst`, 4.1.18+, is not used). No `@tailwindcss/node` or a `tailwindcss` below v4 → the entry is skipped silently; 4.0.x → the entry's `error` is `Tailwind CSS <version> is older than 4.1.0, the first version svelte-zukan supports`; no entry loaded → no page and `tailwind: null` in `catalog.json` (never `[]`).
- No new runtime or peer dependency: `tailwindcss`, `@tailwindcss/node` and `@tailwindcss/vite` go to `devDependencies` (library; `tests/build` takes `tailwindcss` and `@tailwindcss/vite`) through the pnpm `catalog:` only, at a version older than `minimumReleaseAge`.
- No new `zukan()` option.
- Everything that touches Tailwind's API lives in `vite/tailwind-load.ts` behind a shape check (`__unstable__loadDesignSystem`, `compile`, `loadModule`, `theme.entries`, `theme.prefix`, `getClassList`, `candidatesToCss`); a mismatch is that entry's `error`: `Tailwind CSS <version> does not expose the design-system API svelte-zukan uses`.
- A failing entry never breaks the catalog, the dev server or the build: it becomes `error` in its data, and `vite build` logs one warning per failing entry.
- Generation is lazy (first load of the Tailwind list module) and cached; never at dev-server start.
- `catalog.json` and the static build carry no absolute paths. The sample CSS is not in `catalog.json`.
- The data and sample CSS are strings in JS modules, never a CSS import.
- HMR: `zukan:reload` only when the generated data or CSS changed; `hotUpdate` returns `undefined` for CSS and Tailwind dependencies (never `[]`, never `full-reload`).
- Samples render in a same-origin iframe pinned to `color-scheme: light` (element and document root); no Tailwind CSS reaches the catalog document.
- No Tailwind entry → the generated entry module has no Tailwind import, so the build output gains no file.
- No CSS parser dependency: one small scanner (`scanCss`) reads Tailwind's serialized output.
- Dark-mode values are out of scope; the data keeps one `value` per token so a later optional field is additive.
- Plugin messages in English; UI strings in `src/lib/app/i18n.ts` (en and ja); class names, variables, values, paths never translated. Svelte 5 runes; Prettier 120 cols, single quotes, no trailing commas; Conventional Commits.

## Review Focus

- `src/app.css` with `:root { --primary: oklch(…) }` and `@theme inline { --color-primary: var(--primary) }` (shadcn-svelte style) → `bg-primary` has `cssVariable: '--color-primary'` and an `oklch(…)` value, and its swatch is coloured (Task 1 test `resolves @theme inline tokens through :root variables`, Task 4 test `draws a :root-based swatch`).
- `@import "$lib/theme.css"` (a Vite alias) in the entry → the entry loads, and `theme.css` is a partial, not a second entry (Task 3 test `resolves CSS imports through Vite aliases`).
- A Tailwind upgrade that renames the unstable API → only that entry shows an error; `catalog.json` and the rest of the catalog still work (Task 2 test `reports an unsupported API as the entry's error`, Task 3 test `serves catalog.json when an entry fails`).
- A project without Tailwind (the `floor` job, the monorepo fixture), or one that edits any `.css` file → no Tailwind item, `tailwind: null`, no `zukan:reload` (Task 3 test `ignores CSS changes when no Tailwind module is loaded`).
- Editing the app's CSS on the shared dev server where no token changes → the app's own CSS HMR runs and the catalog tab does not reload (Task 3 tests `does not swallow the app's CSS update`, `does not reload when the data did not change`).

---

## File Structure

- Create `packages/svelte-zukan/src/lib/vite/tailwind-tokens.ts` — pure: the CSS scanner, category table, token extraction from a design system, `:root` variable extraction, `var()` resolution. No fs, no Tailwind import.
- Create `packages/svelte-zukan/src/lib/vite/tailwind-load.ts` — entry discovery, resolving `@tailwindcss/node`, loaders, the guard, per-entry errors, watch list.
- Modify `packages/svelte-zukan/src/lib/types.ts` — shared data types.
- Modify `packages/svelte-zukan/src/lib/vite/virtual.ts`, `vite/index.ts`, `vite/catalog-json.ts` — virtual modules, Vite resolver, catalog data, HMR.
- Modify `app/hash.ts`, `app/App.svelte`, `app/Sidebar.svelte`, `app/i18n.ts`; create `app/Tailwind.svelte` (outer page) and `app/TailwindTokens.svelte` (mounted inside the iframe, `<svelte:options css="injected" />`).
- Modify `app/webmcp.ts`, `skills/svelte-zukan/SKILL.md`.
- Modify `tests/build/*`; dogfooding CSS; docs, CONTRIBUTING.md, AGENTS.md, changeset.

---

### Task 1: Token extraction

**Files:**

- Create: `packages/svelte-zukan/src/lib/vite/tailwind-tokens.ts`
- Modify: `packages/svelte-zukan/src/lib/types.ts`, `pnpm-workspace.yaml` (catalog: `tailwindcss`, `@tailwindcss/node`, `@tailwindcss/vite`, one version 4.1.0 or later), `packages/svelte-zukan/package.json` (`devDependencies`)
- Test: `packages/svelte-zukan/src/lib/vite/tailwind-tokens.test.ts`

**Interfaces:**

- Produces (in `types.ts`):
  ```ts
  export type TailwindCategoryId =
    | 'background-color'
    | 'text-color'
    | 'border-color'
    | 'padding'
    | 'margin'
    | 'font-size'
    | 'font-weight'
    | 'font-family'
    | 'letter-spacing'
    | 'line-height'
    | 'drop-shadow'
    | 'border-radius'
    | 'border-width'
    | 'width'
    | 'height'
    | 'box-shadow'
    | 'opacity'
    | 'breakpoints'
    | 'z-index'
    | 'spacing';
  /** `class` is null for Breakpoints and the `--spacing` base; one `value` now, a dark value may be added later */
  export type TailwindToken = { class: string | null; cssVariable: string | null; value: string };
  export type TailwindCategory = { id: TailwindCategoryId; title: string; tokens: TailwindToken[] };
  /** one entry; `file` is relative to the Vite root; `css` is the sample stylesheet for the iframe */
  export type TailwindSource = {
    id: string;
    file: string;
    version: string;
    prefix: string | null;
    categories: TailwindCategory[];
    variables: Record<string, string>;
    css: string;
    error?: string;
  };
  ```
- Produces (in `tailwind-tokens.ts`):
  - `export type DesignSystemLike` — the members used: `theme: { prefix: string | null; entries(): Iterable<[string, { value: string }]> }`, `getClassList(): [string, ...unknown[]][]`, `candidatesToCss(classes: string[]): (string | null)[]`.
  - `export type CssRule = { selector: string; atRules: string[]; declarations: [property: string, value: string][] }` and `export function scanCss(css: string): CssRule[]` — brace matching over serialized CSS, strings and comments skipped; `atRules` is the at-rule preludes around the rule, outermost first (`['@layer base']`, `['@media (x)']`); at-rules without a block and `@property` blocks yield no rule.
  - `export const CATEGORIES: readonly { id: TailwindCategoryId; title: string; stem: string; property: string; kind: 'color' | 'text-color' | 'border-color' | 'padding' | 'margin' | 'text' | 'box' | 'border' | 'width' | 'height' | 'value' }[]` — the spec's table, same order; kinds as in Histoire's `categories.ts`.
  - `export function rootVariables(css: string): Record<string, string>` — via `scanCss`: custom properties of rules whose selector list is only `:root`, `:host` and/or `html` and whose `atRules` are all `@layer`; nothing inside `@media`, `@supports`, `@container` or under other selectors.
  - `export function resolveValue(value: string, known: Record<string, string>): string` — replaces `var(--x)` / `var(--x, fallback)` with known values recursively (cycle-safe), keeps unknown ones as written.
  - `export function extractTokens(system: DesignSystemLike, known: Record<string, string>): { prefix: string | null; categories: TailwindCategory[]; variables: Record<string, string>; classes: string[] }` — `known` is `variables` plus `rootVariables(...)`; `classes` are the prefixed classes of every token, for `compile().build()`.

- [ ] **Step 1: Add the dev dependencies** to the `catalog:` block of `pnpm-workspace.yaml` and to `packages/svelte-zukan/package.json` `devDependencies` as `"catalog:"`; run `pnpm install`. Expected: lockfile updated; `dependencies`, `peerDependencies` and `files` unchanged.

- [ ] **Step 2: Write the failing tests** — the design system comes from the real packages (`@tailwindcss/node`'s `__unstable__loadDesignSystem(css, { base })` is enough here):

```ts
it('lists a project color once per color category', ...);
// '@import "tailwindcss"; @theme { --color-brand-500: #ff3e00; }' → background-color has
// { class: 'bg-brand-500', cssVariable: '--color-brand-500', value: '#ff3e00' }, same for text- and border-
it('resolves @theme inline tokens through :root variables', () => {
  // ':root { --primary: oklch(0.6 0.2 30); }\n@theme inline { --color-primary: var(--primary); }'
  expect(token('background-color', 'bg-primary')).toEqual({ class: 'bg-primary', cssVariable: '--color-primary', value: 'oklch(0.6 0.2 30)' });
});
it('gives spacing classes no variable and a resolved value', ...);   // p-4 → { cssVariable: null, value: 'calc(0.25rem * 4)' }
it('keeps text colors and font sizes apart', ...);                  // text-red-500 only in text-color, text-lg only in font-size
it('leaves out side-specific border colors', ...);                  // no border-t-red-500
it('lists breakpoints and the spacing base without a class', ...);  // { class: null, cssVariable: '--breakpoint-sm', value: '40rem' }, first spacing token { class: null, cssVariable: '--spacing', value: '0.25rem' }
it('drops empty categories', ...);
it('prefixes classes and variables', ...);                         // '@import "tailwindcss" prefix(tw);' → prefix 'tw'; 'tw:bg-red-500' with cssVariable '--tw-color-red-500'; 'tw:p-4' → 'calc(0.25rem * 4)'; { class: null, cssVariable: '--tw-breakpoint-sm', value: '40rem' }; spacing base '--tw-spacing'
it('scans real Tailwind output', ...);                              // scanCss(system.candidatesToCss(['shadow-lg'])[0]) has one rule '.shadow-lg' with box-shadow; the @property blocks yield no rule
it('reads :root variables from real compile() output', ...);     // compile('@import "tailwindcss"; :root { --primary: red; }').build(['bg-red-500']) → rootVariables has '--primary': 'red' and '--color-red-500'; build([]) has '--primary' but no '--color-red-500' (only used theme variables are emitted)
it('reads :root variables only from unconditional rules', () => {
  expect(rootVariables(':root{--a:1}\n@layer base{:root,:host{--b:2}}\n@media (x){:root{--c:3}}\n.dark{--d:4}\nhtml{--e:5}'))
    .toEqual({ '--a': '1', '--b': '2', '--e': '5' });
});
it('resolves var() chains and survives cycles', ...);              // { '--a': 'var(--b)', '--b': 'red' } → 'red'; '--x': 'var(--x)' stays as written
```

- [ ] **Step 3: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/tailwind-tokens.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `tailwind-tokens.ts`.** With a prefix `p`: `getClassList()` returns unprefixed names and `candidatesToCss` only accepts `${p}:${name}` (it returns `null` for the bare name); theme keys and the `var()`s in the output are `--${p}-…`. So the stem match and the `@theme inline` suffix rule use the unprefixed name, the candidate and `class` are `${p}:${name}`, and Breakpoints and the spacing base read `--${p}-breakpoint-*` and `--${p}-spacing`. Declarations come from `scanCss(candidatesToCss([class])[0])`, the rule whose selector is the class (escaped) with no at-rule around it. `cssVariable`: the declaration is exactly `var(--x)` or `var(--x, …)` with `--x` a theme key; otherwise the theme key whose value equals the declaration and whose name ends with `-<class suffix>` (`@theme inline`); otherwise `null`. `rootVariables` is a small brace-matching walker (strings and comments skipped).

- [ ] **Step 5: Run the tests** — same command. Expected: PASS.

- [ ] **Step 6: Commit** — `feat: extract Tailwind CSS tokens from a design system`.

---

### Task 2: Finding and loading entries

**Files:**

- Create: `packages/svelte-zukan/src/lib/vite/tailwind-load.ts`
- Test: `packages/svelte-zukan/src/lib/vite/tailwind-load.test.ts`

**Interfaces:**

- Consumes: `extractTokens`, `rootVariables` (Task 1); `TailwindSource` (Task 1).
- Produces:
  - `export type Resolver = (id: string, base: string) => Promise<string | false | undefined>` — `@tailwindcss/node`'s shape; `base` is a directory.
  - `export function findTailwindEntries(dirs: string[], resolveCss: Resolver): Promise<string[]>` — absolute, normalized, sorted, deduplicated.
  - `export function resolveTailwindNode(from: string[]): { node: string; tailwind: string; version: string } | null` — resolved module paths of `@tailwindcss/node` and of the `tailwindcss` it depends on. Synchronous, no import.
  - `export function hasTailwind(dirs: string[], root: string): boolean` — synchronous, no resolver: some CSS file in `dirs` passes the entry test (partials ignored) and `resolveTailwindNode([dirname(file), root])` is not null. Used for the entry module.
  - `export async function loadTailwind(root: string, dirs: string[], resolvers?: { css?: Resolver; js?: Resolver }): Promise<{ sources: TailwindSource[]; watch: string[] }>` — never rejects for one entry; `watch` is absolute and never serialized.

- [ ] **Step 1: Write the failing tests.** Fixtures are temp dirs. A Tailwind-positive one gets `node_modules/tailwindcss`, `node_modules/@tailwindcss/node` (or, where stated, only `node_modules/@tailwindcss/vite`) as symlinks (`junction` on Windows) to the library's own installed packages (located with the same lookup as `resolveTailwindNode`); a bare one gets none. No `vi.doMock`: a fake `@tailwindcss/node` is a temp `node_modules/@tailwindcss/node/{package.json,index.mjs}` whose `package.json` has `name` and `exports` pointing at `index.mjs`, and which re-exports a subset of the real module. The bare-dir test assumes no global `@tailwindcss/node` (in `~/.node_modules` and the like), which CI never has.

```ts
it('finds an entry that imports tailwindcss and one with only @theme', ...);
it('treats a file imported by another entry as a partial', ...);
it('ignores @reference imports and unrelated CSS', ...);
it('skips node_modules', ...);
it('finds @tailwindcss/node through @tailwindcss/vite', ...);       // only node_modules/@tailwindcss/vite (with its own node_modules/@tailwindcss/node), as pnpm lays it out
it('finds no Tailwind without @tailwindcss/node', async () => {
  expect(await loadTailwind(bareTmp, [bareTmpSrc])).toEqual({ sources: [], watch: [] });
});
it('loads an entry with relative paths', async () => {
  const { sources: [s], watch } = await loadTailwind(tmpRoot, [tmpSrc]);
  expect(s.file).not.toMatch(/^([A-Za-z]:)?\//);
  expect(s.version).toMatch(/^4\./);
  expect(s.css).toContain('.bg-red-500');
  expect(watch).toContain(entryPath);
});
it('adds the defaults to an @theme-only entry', ...);
it('loads a TypeScript @plugin', ...);
it('reports a 4.0.x Tailwind as too old', ...);                    // fake @tailwindcss/node plus a fake tailwindcss package (version 4.0.17, with an `exports` entry that resolves) → error 'Tailwind CSS 4.0.17 is older than 4.1.0, the first version svelte-zukan supports'
it('watches relative imports outside the searched dirs', ...);     // ../tokens.css is in watch
it('reports an unsupported API as the entry\'s error', ...);      // fake @tailwindcss/node without compile → error matches /does not expose the design-system API/
it('keeps absolute paths out of errors', ...);                      // '@import "./missing.css"' → error does not contain the temp root
it('reports invalid CSS as the entry\'s error and keeps the other entries', ...);
it('uses the given CSS resolver before Node resolution', ...);     // a resolver mapping '$lib/x.css' is called and its file loaded
```

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/tailwind-load.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `tailwind-load.ts`.**
  - `findTailwindEntries`: `fs.globSync('**/*.css', { cwd: dir, exclude: ['**/node_modules/**'] })`; candidate = a non-`@reference` `@import` naming `tailwindcss` or `tailwindcss/…`, or any `@theme`; drop candidates another candidate imports (ids resolved with `resolveCss`, then relative path).
  - `resolveTailwindNode`: these packages export no `./package.json`, so find a package directory with `createRequire(join(dir, 'noop.js')).resolve.paths(name)` and the first `<p>/<name>/package.json` that exists, then `realpathSync`. Try `@tailwindcss/node` from each directory; else find `@tailwindcss/vite`, `@tailwindcss/postcss` or `@tailwindcss/cli` the same way and look for `@tailwindcss/node` from that package's directory. `tailwindcss` is found the same way from `@tailwindcss/node`'s directory; the module paths come from `createRequire(<pkg dir>/package.json).resolve(name)`. Null when nothing is found or the major version is below 4.
  - `loadTailwind`: per entry `resolveTailwindNode([dirname(entry), root])`; import both with `pathToFileURL` (use `default` when the named export is missing); guard; prepend `@import "tailwindcss";\n` when the entry has no Tailwind import; `loadStylesheet(id, base)` = `resolvers.css`, then `enhanced-resolve` loaded from `@tailwindcss/node`'s directory (`createRequire(nodePath)('enhanced-resolve')`, `ResolverFactory` / `create.sync` with `extensions: ['.css'], mainFields: ['style'], conditionNames: ['style']`) from `base` only; read the file, report it to `watch`. No resolve-from-root fallback: an import resolves where the app's build resolves it; `loadModule(id, base)` = `node.loadModule(id, base, onDependency, resolvers.js)`; the version check (major 4 and below 4.1.0 → the too-old error) runs before the import; `compile(css, { base, onDependency, customCssResolver, customJsResolver })` then `build(classes)` for `css`; `known` = theme variables + `rootVariables(build([]))`. `id` = first 12 hex of sha256 of the relative path. A thrown error becomes `{ id, file, version, prefix: null, categories: [], variables: {}, css: '', error }`, with every occurrence of `root + '/'` (normalized, and the OS form) removed from the message as `catalog-json.ts` does. `watch` paths go through `normalizePath`.

- [ ] **Step 4: Run the tests** — same command. Expected: PASS.

- [ ] **Step 5: Commit** — `feat: find and load Tailwind CSS entries`.

---

### Task 3: Plugin wiring, catalog data and HMR

**Files:**

- Modify: `packages/svelte-zukan/src/lib/vite/virtual.ts`, `vite/index.ts`, `vite/catalog-json.ts`, `types.ts`
- Test: `packages/svelte-zukan/src/lib/vite/index.test.ts` (fakes: module ids, sync behaviour), `vite/hmr.test.ts` (real `createServer`: resolver, HMR, catalog.json), `vite/virtual.test.ts`, the existing `catalogJson` tests

**Interfaces:**

- Consumes: `loadTailwind`, `Resolver` (Task 2); `TailwindSource` (Task 1).
- Produces:
  - `virtual.ts`: `TAILWIND = 'virtual:svelte-zukan/tailwind'`, `TAILWIND_SOURCE = 'virtual:svelte-zukan/tailwind/'`; `generateTailwindModule(sources: TailwindSource[]): string` exporting `tailwind: TailwindListItem[]`; `generateEntryModule` gains `tailwind?: boolean` (default `false`) and, only when true, imports `TAILWIND` with the catalog and passes its `tailwind` to `App` (`[]` otherwise). The plugin decides it when it loads `ENTRY`, synchronously, with `hasTailwind(cssDirs(), root)`; `load(ENTRY)` stays synchronous.
  - `types.ts`: `export type TailwindListItem = { id: string; file: string; error: string | null; load: () => Promise<{ default: TailwindSource }> }`.
  - `CatalogJson.tailwind: Omit<TailwindSource, 'id' | 'css'>[] | null`; `catalogJson` takes `tailwind: TailwindSource[]`; the plugin's `catalogData()` is async.
  - In `index.ts`: `tailwindData(env: () => Environment): Promise<{ sources: TailwindSource[]; watch: string[] }>`, the one cached entry point used by `load` (`() => this.environment`), the dev `catalog.json` middleware (`() => server.environments.client`) and `buildApp` (`() => builder.environments.zukan`). The environment is read, and the Vite resolvers built from its config, only on the first resolver call, so a project with no entry never touches it (and the existing fake servers and builders keep working).

- [ ] **Step 1: Write the failing tests**

```ts
// index.test.ts (fakes, no Tailwind entry: the environment is never read)
it('does not load Tailwind until the list module is loaded', ...);       // configResolved + configureServer do not call loadTailwind
it('leaves the Tailwind import out of the entry module without an entry', ...); // generateEntryModule({ tailwind: false, ... }) has no 'virtual:svelte-zukan/tailwind'
it('serves catalog.json with tailwind null without Tailwind', ...);
// hmr.test.ts (real createServer on a temp app with Tailwind symlinked as in Task 2)
it('resolves and loads the Tailwind list and one entry\'s data', ...);
it('serves catalog.json when an entry fails', ...);
it('keeps absolute paths and the sample CSS out of catalog.json', ...);   // includes an entry with an unresolvable @import
it('resolves CSS imports through Vite aliases', ...);                    // resolve.alias { $lib: src/lib }; entry '@import "$lib/theme.css"' loads; theme.css is no entry
it('reloads the catalog when a watched file changes the data', ...);     // hotUpdate on the entry with the TAILWIND module in the graph → zukan:reload
it('does not reload when the data did not change', ...);                 // a comment added to the entry → no hot.send
it('picks up a CSS entry created in a searched dir', ...);
it('does not swallow the app\'s CSS update', ...);                       // hotUpdate returns undefined, never []
it('ignores CSS changes when no Tailwind module is loaded', ...);      // no hot.send
it('serves an edit in catalog.json when the list module was never loaded', ...);
it('reloads on a change to an imported file outside the root', ...);   // ../tokens.css outside the Vite root
```

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts src/lib/vite/hmr.test.ts src/lib/vite/virtual.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `index.ts`: `cssDirs()` = searched dirs plus `<root>/src` when it exists, deduplicated. `tailwindData(env)` builds its resolvers lazily from `env().config`, on the first call of either resolver: `createIdResolver(env.config, { ...env.config.resolve, extensions: ['.css'], mainFields: ['style'], conditions: ['style', 'development|production'], tryIndex: false, preferRelative: true })` for CSS and `createIdResolver(env.config, env.config.resolve)` for JS, each wrapped like `@tailwindcss/vite`'s helper (importer `join(base, '__placeholder__.ts')`, alias-only first, a relative result made absolute, CSS results must end in `.css`). `let tailwind: Promise<{ sources; watch }> | null`, cleared in `config`; `served` = JSON of the last served sources. `load` for `TAILWIND` / `TAILWIND_SOURCE` (unknown id throws like a missing catalog file) calls `this.addWatchFile(f)` for every path in `watch`, so files outside the root are watched too. The dev middleware and `buildApp` await `catalogData()`; `buildApp` warns `svelte-zukan: Tailwind CSS entry <file>: <error>` per failing entry.
  - `hotUpdate` stays synchronous for every existing branch. New first branch: `normalizePath(file)` is in the last `watch`, or a `.css` file created/deleted inside `cssDirs()`. Always set `tailwind = null` (so `catalog.json` is fresh). Then, only when the `\0`+`TAILWIND` module is in the graph and the consumer is `client`, return a promise that regenerates and, when the JSON differs from `served`, invalidates `\0`+`TAILWIND` and every `\0`+`TAILWIND_SOURCE` module and sends `zukan:reload`, resolving to `undefined`. Otherwise return `undefined`. Never `[]`.

- [ ] **Step 4: Run the tests** — `pnpm --filter svelte-zukan exec vitest run --project server`, then `pnpm --filter svelte-zukan run check`. Expected: PASS, 0 errors (existing synchronous assertions in `index.test.ts` and the `generateEntryModule` callers in `virtual.test.ts` unchanged).

- [ ] **Step 5: Commit** — `feat: serve Tailwind CSS tokens to the catalog and catalog.json`.

---

### Task 4: The Tailwind CSS page

**Files:**

- Modify: `packages/svelte-zukan/src/lib/app/hash.ts`, `app/App.svelte`, `app/Sidebar.svelte`, `app/i18n.ts`
- Create: `packages/svelte-zukan/src/lib/app/Tailwind.svelte`, `app/TailwindTokens.svelte`
- Test: `app/hash.test.ts`, `app/i18n.test.ts`, `app/Tailwind.svelte.test.ts`, `app/App.svelte.test.ts`

**Interfaces:**

- Consumes: `TailwindListItem`, `TailwindSource`, `TailwindCategoryId` (Tasks 1, 3).
- Produces:
  - `Route` gains `{ view: 'tailwind'; source: string | null; category: string | null }` for `#/tailwind?source=<id>&category=<id>` (exactly the single segment `tailwind`); `export function formatTailwindHash(source?: string, category?: string): string`.
  - `i18n.ts`: `Messages` keys `tailwind`, `filterTokens`, `sampleText`, `fullConfig`, `copyClass`, `copyVariable`, `noTokens`, `tailwindError`; `export const categoryTitles: Record<'en' | 'ja', Record<TailwindCategoryId | 'full-config', string>>`.
  - `App` prop `tailwind?: TailwindListItem[]` (default `[]`); `Sidebar` props `tailwind: { id: string; file: string }[]`, `currentTailwind?: string`.
  - `TailwindTokens.svelte` props: `{ category: TailwindCategory; kind: string; query: string; sampleText: string; theme: Theme; t: Messages }`.

- [ ] **Step 1: Write the failing tests**

```ts
// hash.test.ts
it('parses the Tailwind page', () => {
  expect(parseHash('#/tailwind?source=abc&category=spacing')).toEqual({ view: 'tailwind', source: 'abc', category: 'spacing' });
  expect(parseHash('#/tailwind')).toEqual({ view: 'tailwind', source: null, category: null });
  expect(parseHash('#/tailwind/Button').view).toBe('detail');
});
// i18n.test.ts
it('category titles exist in both languages', ...);
// Tailwind.svelte.test.ts, with a hand-made TailwindSource whose css defines .bg-brand-500 and a :root variable
it('shows the first category in an iframe with the class and the variable', ...);
it('draws a :root-based swatch', ...);         // computed background-color inside the iframe is not transparent
it('keeps the sample CSS out of the catalog document', ...); // no <style> with .bg-brand-500 in the top document
it('switches category through the hash', ...);
it('filters by class name and value', ...);     // 'brand' leaves bg-brand-500; no match shows t.noTokens
it('copies the class name', ...);
it('keeps samples light in the dark catalog theme', ...); // with theme 'dark' the iframe element and its root compute color-scheme 'light'; a sample using @media (prefers-color-scheme: dark) shows the light value
it('lists every theme variable in Full config', ...);
it('shows the entry\'s error instead of the tokens', ...);
// App.svelte.test.ts
it('has no Tailwind item without Tailwind data', ...);
it('links one Tailwind item per entry, with the file when there are several', ...);
```

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app` and `pnpm --filter svelte-zukan exec vitest run --project server src/lib/app/hash.test.ts src/lib/app/i18n.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `Tailwind.svelte`: loads the selected entry (`source` or the first), shows category links, the filter and (for text kinds) the sample-text field, and an `<iframe>` (`srcdoc` with a `<!doctype html>` skeleton, same origin, `style="color-scheme: light"` on the element and `:root { color-scheme: light }` in the document). On load it writes `<style>{source.css}</style>` into the iframe's head and `mount`s `TailwindTokens` into its body with a `$state` props object, so filter and category changes update in place; a `ResizeObserver` on the iframe's body sets the iframe height. `unmount` and the iframe go with the component.
  - `TailwindTokens.svelte` (`<svelte:options css="injected" />`, so its styles land in the iframe document): one card per filtered token — sample `<div class={token.class}>` drawn per kind as in Histoire's `render.ts`, the class and the variable with copy buttons (same failure handling as `CodeBlock.svelte`); "Full config" is a table of `variables`. Cards set their own colours for `theme`. No virtualization.
  - `App.svelte`: the `tailwind` route renders `Tailwind` in `<main>`; title `Tailwind CSS | <title>`; `j`/`k` do nothing there.
  - `Sidebar.svelte`: below the entry list, inside the same `nav`, one link per entry (`t.tailwind`, plus ` (<file>)` when there are several), `aria-current="page"` when active.

- [ ] **Step 4: Run the tests** — same commands, then `pnpm --filter svelte-zukan run check`. Expected: PASS, 0 errors.

- [ ] **Step 5: Commit** — `feat: add the Tailwind CSS page to the catalog`.

---

### Task 5: Agents

**Files:**

- Modify: `packages/svelte-zukan/src/lib/app/webmcp.ts`, `app/App.svelte` (`tailwind: tailwind.length > 0` to `buildTools`), `packages/svelte-zukan/skills/svelte-zukan/SKILL.md`
- Test: `packages/svelte-zukan/src/lib/app/webmcp.svelte.test.ts`

**Interfaces:**

- Consumes: `CatalogJson.tailwind` (Task 3).
- Produces: `buildTools` option `tailwind?: boolean`; when true, a read-only tool `list_tailwind_tokens` with input `{ category?: TailwindCategoryId | 'full-config'; query?: string }`. Without `category`: per entry `{ file, prefix, error?, categories: { id, title, count }[] }`. With `category`: per entry that category's tokens (or `variables` for `full-config`), filtered by `query` like the page.

- [ ] **Step 1: Write the failing tests** — `registers list_tailwind_tokens only with Tailwind data`, `summarizes categories without a category`, `returns the filtered tokens of a category`, `answers an unknown category with an error result`.
- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/webmcp.svelte.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the tool and the SKILL.md lines** (`tailwind` in `catalog.json`: use only listed classes; `null` means no Tailwind v4 entry).
- [ ] **Step 4: Run the tests** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: give agents the Tailwind CSS tokens`.

---

### Task 6: Build tests and the dogfooding demo

**Files:**

- Modify: `tests/build/package.json` (`tailwindcss` and `@tailwindcss/vite` as `catalog:` dev dependencies, not `@tailwindcss/node`: pnpm does not hoist it, so the build test covers the real `@tailwindcss/vite` + pnpm lookup), `tests/build/build.test.ts`
- Create: `tests/build/vite-svelte/src/app.css` (`@import "tailwindcss";`, `:root { --primary: #123456; }`, `@theme inline { --color-primary: var(--primary); }`, `@theme { --color-brand-500: #ff3e00; }`)
- Create: `packages/svelte-zukan/src/tailwind.css` (`@import "tailwindcss";` and a few `@theme` tokens; outside `src/lib`, searched in both demo locales)

- [ ] **Step 1: Write the failing tests** in `build.test.ts`: the `vite-svelte` catalog's `catalog.json` has one `tailwind` entry with `file: 'src/app.css'`, `{ class: 'bg-brand-500', cssVariable: '--color-brand-500', value: '#ff3e00' }` and `{ class: 'bg-primary', cssVariable: '--color-primary', value: '#123456' }` in `background-color`, and no `css` field; the built `_zukan/` JS contains `.bg-brand-500`; no written file contains the fixture's absolute path; the monorepo catalog has `tailwind: null`.
- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter build-tests exec vitest run build.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the fixture CSS and the dependencies**, `pnpm install`.
- [ ] **Step 4: Run the build tests both ways** — `pnpm --filter build-tests exec vitest run build.test.ts`; then `pnpm run package` and `ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts`. Expected: PASS.
- [ ] **Step 5: Add the demo CSS and check the demo** — `pnpm --filter svelte-zukan build` and `ZUKAN_DEMO_LOCALE=ja pnpm --filter svelte-zukan build`; both `zukan-dist/catalog.json` have a `tailwind` entry with `file: 'src/tailwind.css'`; `src/examples.test.ts` passes.
- [ ] **Step 6: Commit** — `test: cover Tailwind CSS tokens in the build tests and show them in the demo`.

---

### Task 7: Docs and release

**Files:**

- Create: `docs/content/(catalog)/tailwind.md`, `docs/content/ja/(catalog)/tailwind.md` (sidebar order right after `catalog-ui`)
- Modify: `docs/content/(catalog)/ai-agents.md` and its ja copy (the `tailwind` field, `list_tailwind_tokens`); CONTRIBUTING.md (the first rule of "What belongs in svelte-zukan" covers the design tokens components are built from); AGENTS.md (the two modules, the guard, the virtual modules, lazy generation, the CSS HMR rule, the iframe)
- Create: `.changeset/tailwind-tokens.md` — `'svelte-zukan': minor`, `feat: show the project's Tailwind CSS v4 theme in the catalog and in catalog.json.`

- [ ] **Step 1: Write the pages** — when the page appears (Tailwind v4 through `@tailwindcss/vite`, `@tailwindcss/postcss` or `@tailwindcss/cli`; entries in the searched `src` directories and the root `src`; `@theme`-only files), the categories, filter and copy, errors, and what is not shown (arbitrary values, variants, dark-mode values, relative `@font-face` URLs); the minimum is Tailwind CSS 4.1.0, and 4.0.x shows an error asking to upgrade.
- [ ] **Step 2: Verify** — `pnpm --filter docs build`, `pnpm run lint`, `pnpm run check`, `pnpm run test`. Expected: all pass.
- [ ] **Step 3: Commit** — `docs: document the Tailwind CSS page`.
