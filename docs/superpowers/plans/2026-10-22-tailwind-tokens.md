# Tailwind CSS tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the resolved Tailwind CSS v4 theme of the project as a "Tailwind CSS" page in the catalog, and give the same data to agents through `catalog.json` and WebMCP.

**Architecture:** The plugin finds Tailwind CSS entries in the scanned `src` directories, loads each one with the user's own `@tailwindcss/node` (`__unstable__loadDesignSystem(css, { base })`, which resolves `@import`, `@plugin` and `@config` itself), and turns the design system into categories of tokens plus a scoped sample stylesheet. The data reaches the catalog through two virtual modules (a small list loaded with the catalog, one data module per entry loaded on demand) and reaches agents through `catalog.json` and one WebMCP tool. A new hash route `#/tailwind` renders the page.

**Tech Stack:** Vite 8 plugin (Environment API, `hotUpdate`), Svelte 5 runes, Vitest (`server` and `client` projects), Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/node`) as dev dependencies only.

**Spec:** `docs/superpowers/specs/2026-10-22-tailwind-tokens-design.md`

## Global Constraints

- Tailwind CSS v4 or later only; v3 or no Tailwind → the feature is off silently (no page, `tailwind: null` in `catalog.json`, no warning).
- No new runtime dependency and no peer dependency: `tailwindcss` and `@tailwindcss/node` go to `devDependencies` (library, `tests/build`) through the pnpm `catalog:` only. Respect `minimumReleaseAge` when choosing the catalog version.
- No new `zukan()` option.
- Everything that touches `__unstable__loadDesignSystem` lives in `vite/tailwind-load.ts` behind a shape check that throws `Tailwind CSS <version> does not expose the design-system API svelte-zukan uses` (the error of that entry only).
- A failing entry never breaks the catalog, the dev server or the build: it becomes `error` in its data, and `vite build` logs one warning.
- `catalog.json` and the static build carry no absolute paths.
- Plugin messages in English. UI strings in `src/lib/app/i18n.ts` (en and ja); class names, CSS variables, values and file paths are never translated.
- HMR uses the custom event `zukan:reload`, never `full-reload`, and never swallows the app's own CSS update.
- Sample CSS applies only inside the token page's scope element; nothing from it reaches the catalog UI or previews.
- Dark-mode values are out of scope, but the data shape must allow adding them later without a breaking change (one `value` per token now; a later optional field is additive).
- Svelte 5 runes only; Prettier 120 cols, single quotes, no trailing commas; Conventional Commits; English everywhere except the ja docs/dictionary/demo.

## Review Focus

- A project whose only Tailwind entry is `src/app.css` while `groups` points at `src/lib` → the page still appears (Task 2 test `finds src/app.css outside the groups`).
- An unrelated `.css` file (no `@import "tailwindcss"`, no `@theme`) or one only pulled in with `@reference` → never an entry (Task 2 tests).
- A Tailwind upgrade that renames or drops the unstable API → only that entry shows an error, the catalog and `catalog.json` still work (Task 2 test `reports an unsupported API as the entry's error`, Task 3 test `serves catalog.json when an entry fails`).
- A user without Tailwind (the `floor` job, the monorepo fixture) → no sidebar item, `tailwind: null`, and editing any `.css` file sends no `zukan:reload` (Task 3 test `ignores CSS changes when no Tailwind module is loaded`).
- Editing the app's CSS on the shared dev server → the app's own CSS HMR still runs (Task 3 test `does not swallow the app's CSS update`).

---

## File Structure

- Create `packages/svelte-zukan/src/lib/vite/tailwind-tokens.ts` — pure: the category table, `extractTokens()` from a design system, `sampleCss()`. No fs, no imports of Tailwind.
- Create `packages/svelte-zukan/src/lib/vite/tailwind-load.ts` — finding entries on disk, resolving the user's `@tailwindcss/node`, the guarded load, per-entry errors.
- Modify `packages/svelte-zukan/src/lib/types.ts` — shared data types.
- Modify `packages/svelte-zukan/src/lib/vite/virtual.ts`, `vite/index.ts`, `vite/catalog-json.ts` — virtual modules, catalog data, HMR.
- Modify `packages/svelte-zukan/src/lib/app/hash.ts`, `App.svelte`, `Sidebar.svelte`, `i18n.ts`; create `app/Tailwind.svelte` — route, entry point, page.
- Modify `packages/svelte-zukan/src/lib/app/webmcp.ts` — one tool.
- Modify `tests/build/*` — fixture and assertions.
- Docs, CONTRIBUTING.md, AGENTS.md, SKILL.md, changeset, dogfooding CSS.

---

### Task 1: Token extraction

**Files:**

- Create: `packages/svelte-zukan/src/lib/vite/tailwind-tokens.ts`
- Modify: `packages/svelte-zukan/src/lib/types.ts`
- Modify: `pnpm-workspace.yaml` (catalog: `tailwindcss`, `@tailwindcss/node`, same 4.x version), `packages/svelte-zukan/package.json` (`devDependencies`)
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
  /** `cssVariable` is null when the class reads no theme variable (e.g. `p-4` is `calc(var(--spacing) * 4)`) */
  export type TailwindToken = { class: string; cssVariable: string | null; value: string };
  export type TailwindCategory = { id: TailwindCategoryId; title: string; tokens: TailwindToken[] };
  /** one Tailwind CSS entry; `file` is relative to the Vite root; `css` is the scoped sample stylesheet */
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
  - `export type DesignSystemLike = { theme: { prefix: string | null; entries(): Iterable<[string, { value: string }]> }; getClassList(): [string, ...unknown[]][]; candidatesToCss(classes: string[]): (string | null)[] }`
  - `export const CATEGORIES: readonly { id: TailwindCategoryId; title: string; stem: string; property: string; kind: 'color' | 'text-color' | 'border-color' | 'padding' | 'margin' | 'text' | 'box' | 'border' | 'width' | 'height' | 'value' }[]` — Histoire's table, same order, same stems/properties (see spec "Data, per entry"); `breakpoints` has `stem: ''`.
  - `export function extractTokens(system: DesignSystemLike): { prefix: string | null; categories: TailwindCategory[]; variables: Record<string, string>; compiled: string[] }` — `compiled` is the non-null `candidatesToCss` output of the listed classes, for `sampleCss`.
  - `export function sampleCss(scope: string, variables: Record<string, string>, compiled: string[]): string`

- [ ] **Step 1: Add the dev dependencies** — `tailwindcss` and `@tailwindcss/node` to the `catalog:` block of `pnpm-workspace.yaml` (one 4.x version at least `minimumReleaseAge` old), and both as `"catalog:"` in `packages/svelte-zukan/package.json` `devDependencies`. Run `pnpm install`. Expected: lockfile updated, `files`/`dependencies` unchanged.

- [ ] **Step 2: Write the failing tests** — load a real design system in the test with `@tailwindcss/node`:

```ts
const load = (css: string) => __unstable__loadDesignSystem(css, { base: here });
const system = await load('@import "tailwindcss";\n@theme { --color-brand-500: #ff3e00; --spacing-gutter: 18px; }');

it('lists a project color once per color category, with its variable and value', () => {
  const { categories } = extractTokens(system);
  for (const id of ['background-color', 'text-color', 'border-color'])
    expect(categories.find((c) => c.id === id)!.tokens).toContainEqual(
      expect.objectContaining({ cssVariable: '--color-brand-500', value: '#ff3e00' })
    );
  expect(byId(categories, 'background-color').tokens.find((t) => t.cssVariable === '--color-brand-500')!.class).toBe('bg-brand-500');
});
it('keeps text colors and font sizes apart although both use text-', ...);   // text-red-500 only in text-color, text-lg only in font-size
it('leaves out side-specific border colors', ...);                          // no border-t-red-500 in border-color
it('starts spacing with the --spacing base and keeps calc values without a variable', ...); // first token { class: '--spacing', cssVariable: '--spacing', value: '0.25rem' }; p-4 has cssVariable null, value 'calc(var(--spacing) * 4)'
it('lists breakpoints from the theme', ...);                                // { class: 'sm', cssVariable: '--breakpoint-sm', value: '40rem' }
it('drops empty categories', ...);                                          // with '@theme { --color-*: initial; --color-x: red; }' plus import, no category is empty
it('prefixes classes with the project prefix', ...);                        // '@import "tailwindcss" prefix(tw);' → class 'tw:bg-red-500', prefix 'tw'
it('scopes rules to the scope class and keeps @property global', () => {
  const css = sampleCss('zukan-tw-x', { '--color-a': 'red' }, ['.bg-a {\n  background-color: var(--color-a);\n}\n@property --tw-x {\n  syntax: "*";\n  inherits: false;\n}\n']);
  expect(css).toContain('.zukan-tw-x {');
  expect(css).toContain('--color-a: red;');
  expect(css).toMatch(/^@property --tw-x/m);            // at the top level, outside the scope block
  expect(css).not.toMatch(/^\.bg-a/m);                   // only nested inside the scope block
});
```

- [ ] **Step 3: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/tailwind-tokens.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `tailwind-tokens.ts`** — port Histoire's `v4.ts` loop without postcss: take a declaration's value with a regex over the compiled rule (`/(?:^|[;{\s])<property>:\s*([^;]+);/`), the variable with `/var\((--[\w-]+)/`, and the value from `variables[variable]` when it exists, else the declaration value. A class belongs to a category when it equals the stem or starts with `stem-` and its CSS declares the category's property. Breakpoints come from `--breakpoint-*` variables, the spacing base from `--spacing`. Category `title` is the English title from `CATEGORIES`. `sampleCss`: one block `.<scope> { <variables> <rules nested> }` (native CSS nesting) plus every `@property … { … }` block (no nested braces) moved to the top level.

- [ ] **Step 5: Run the tests** — same command. Expected: PASS.

- [ ] **Step 6: Commit** — `feat: extract Tailwind CSS tokens from a design system`.

---

### Task 2: Finding and loading entries

**Files:**

- Create: `packages/svelte-zukan/src/lib/vite/tailwind-load.ts`
- Test: `packages/svelte-zukan/src/lib/vite/tailwind-load.test.ts`

**Interfaces:**

- Consumes: `extractTokens`, `sampleCss` (Task 1); `TailwindSource` (Task 1).
- Produces:
  - `export function findTailwindEntries(dirs: string[]): string[]` — absolute normalized paths, sorted, deduplicated (dirs may overlap).
  - `export function resolveTailwindNode(from: string[]): { entry: string; version: string } | null` — `entry` is the resolved `@tailwindcss/node` module, `version` is the `tailwindcss` version that package loads; `from` is the list of directories to try in order.
  - `export async function loadTailwind(root: string, dirs: string[]): Promise<{ sources: TailwindSource[]; watch: string[] }>` — never rejects for one entry's failure. `watch` (absolute, normalized, never serialized) is every entry plus, recursively, the local files its `@import`, `@plugin` and `@config` name by relative path.

- [ ] **Step 1: Write the failing tests** (temp dirs under `os.tmpdir()`; for resolution, pass the library's own directory as `root` so its dev dependencies resolve):

```ts
it('finds an entry that imports tailwindcss and one with only @theme', ...);       // both returned
it('leaves out a partial imported by another entry', ...);                         // a.css: @import "./tokens.css"; tokens.css: @theme {…} → only a.css
it('leaves out files only pulled in with @reference and unrelated CSS', ...);
it('finds src/app.css outside the groups', ...);                                     // loadTailwind(root, [root/src/lib, root/src]) with app.css in root/src
it('skips node_modules', ...);
it('returns no source when @tailwindcss/node does not resolve', async () => {
  expect(await loadTailwind(tmpRootWithoutTailwind, [srcWithEntry])).toEqual([]);
});
it('loads an entry with the root fallback and relative paths only', async () => {
  const [source] = await loadTailwind(libRoot, [tmpSrc]);
  expect(source.file).not.toMatch(/^([A-Za-z]:)?\//);   // relative to root
  expect(source.version).toMatch(/^4\./);
  expect(source.error).toBeUndefined();
});
it('adds the defaults to an @theme-only entry', ...);                                 // has bg-red-500 and the project's token
it('reports an unsupported API as the entry\'s error', ...);                           // vi.doMock the loaded module to lack __unstable__loadDesignSystem → error contains 'does not expose the design-system API'
it('reports invalid CSS as the entry\'s error and keeps the other entries', ...);
it('watches the entry, its relative imports and its @plugin file', ...); // watch has the entry, ../tokens.css outside dirs, ./plugin.js
```

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/tailwind-load.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `tailwind-load.ts`**
  - `findTailwindEntries`: `fs.globSync('**/*.css', { cwd, exclude: ['**/node_modules/**'] })` per dir; a file is a candidate when a non-`@reference` `@import` names `tailwindcss` (`/^tailwindcss(?:\/|$)/`) or it contains `@theme`; drop candidates that another candidate `@import`s by relative path.
  - `resolveTailwindNode`: for each directory, `createRequire(join(dir, 'noop.js'))`; try `@tailwindcss/node`, then the `@tailwindcss/node` that `@tailwindcss/vite`, `@tailwindcss/postcss` or `@tailwindcss/cli` resolves from its own package directory (pnpm does not hoist it); the version is `tailwindcss/package.json` resolved from the found `@tailwindcss/node` directory. Return null when nothing resolves or the major version is below 4.
  - `loadTailwind`: for each entry, `resolveTailwindNode([dirname(entry), root])`; skip the entry when null. Import the module (`pathToFileURL`), take `__unstable__loadDesignSystem` from it or its `default`, check its shape (function; result has `theme.entries`, `getClassList`, `candidatesToCss`), else throw the Global Constraints message. Prepend `@import "tailwindcss";\n` when the entry has no Tailwind import. `id` = first 12 hex of sha256 of the relative path; scope = `zukan-tw-${id}`. Catch per entry: `{ id, file, version, prefix: null, categories: [], variables: {}, css: '', error: message }`.

- [ ] **Step 4: Run the tests** — same command. Expected: PASS.

- [ ] **Step 5: Commit** — `feat: find and load Tailwind CSS entries`.

---

### Task 3: Plugin wiring, catalog data and HMR

**Files:**

- Modify: `packages/svelte-zukan/src/lib/vite/virtual.ts`, `vite/index.ts`, `vite/catalog-json.ts`
- Test: `packages/svelte-zukan/src/lib/vite/index.test.ts`, `vite/catalog-json.test.ts` (or where `catalogJson` is tested now)

**Interfaces:**

- Consumes: `loadTailwind` (Task 2, `{ sources, watch }`), `TailwindSource` (Task 1).
- Produces:
  - `virtual.ts`: `export const TAILWIND = 'virtual:svelte-zukan/tailwind'`, `export const TAILWIND_SOURCE = 'virtual:svelte-zukan/tailwind/'`, `export function generateTailwindModule(sources: TailwindSource[]): string` — exports `tailwind: { id: string; file: string; error: string | null; load: () => Promise<{ default: TailwindSource }> }[]`.
  - `generateEntryModule` imports `TAILWIND` alongside the catalog and passes `tailwind` to `App`.
  - `CatalogJson.tailwind: { file: string; version: string; prefix: string | null; categories: TailwindCategory[]; variables: Record<string, string>; error?: string }[] | null` (no `css`, no `id`); `null` when no entry was found. `catalogJson` takes `tailwind: TailwindSource[]` and the plugin's `catalogData` becomes async.
  - The client-side type `TailwindListItem = { id: string; file: string; error: string | null; load: () => Promise<{ default: TailwindSource }> }` in `types.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
it('resolves and loads the Tailwind list module', ...);            // resolveId(TAILWIND) → '\0'+TAILWIND; load → contains 'export const tailwind'
it('loads one entry\'s data module', ...);                          // load('\0'+TAILWIND_SOURCE+id) → export default with 'categories'
it('serves catalog.json with tailwind null without Tailwind', ...); // tmp root without @tailwindcss/node
it('serves catalog.json when an entry fails', ...);                 // the failing entry has `error`, components unaffected
it('keeps absolute paths out of catalog.json tailwind', ...);
it('invalidates the Tailwind modules and sends zukan:reload on a CSS change', ...); // hotUpdate on src/app.css with the TAILWIND module in the graph
it('reloads on a change to a watched @plugin file', ...);
it('does not swallow the app\'s CSS update', ...);                  // hotUpdate returns undefined for a CSS file, never []
it('ignores CSS changes when no Tailwind module is loaded', ...);   // hot.send not called
```

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts src/lib/vite/catalog-json.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `index.ts`: `const cssDirs = () => [...new Set([...scanned(), ...(isDir(root/src) ? [normalizePath(join(root, 'src'))] : [])])]`; `let tailwind: Promise<{ sources: TailwindSource[]; watch: string[] }> | null = null` reset in `config` and on relevant changes; `loadTw = () => (tailwind ??= loadTailwind(root, cssDirs()).catch((e) => (logger warn, { sources: [], watch: [] })))`; keep the last resolved `watch` in a `Set` for `hotUpdate`. `resolveId`/`load` for `TAILWIND` and `TAILWIND_SOURCE` (`export default ${JSON.stringify(source)}`; an unknown id throws like a missing catalog file). The dev middleware awaits `catalogData()`; `buildApp` awaits it and logs `svelte-zukan: Tailwind CSS entry <file>: <error>` once per failing entry.
  - `hotUpdate`: first branch — a file in the last `watch` set, or a `.css` file inside `cssDirs()` (a new or deleted entry): if the `\0`+`TAILWIND` module is in the graph and the consumer is `client`, set `tailwind = null`, invalidate it and every `\0`+`TAILWIND_SOURCE` module, send `zukan:reload`; return `undefined` in every case.
  - `server.fs.allow` needs nothing new (`root/src` is inside the root).

- [ ] **Step 4: Run the tests** — same command plus the whole `server` project: `pnpm --filter svelte-zukan exec vitest run --project server`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat: serve Tailwind CSS tokens to the catalog and catalog.json`.

---

### Task 4: The Tailwind CSS page

**Files:**

- Modify: `packages/svelte-zukan/src/lib/app/hash.ts`, `app/App.svelte`, `app/Sidebar.svelte`, `app/i18n.ts`
- Create: `packages/svelte-zukan/src/lib/app/Tailwind.svelte`
- Test: `app/hash.test.ts`, `app/i18n.test.ts`, `app/Tailwind.svelte.test.ts`, `app/App.svelte.test.ts`

**Interfaces:**

- Consumes: `TailwindListItem`, `TailwindSource`, `TailwindCategoryId` (Tasks 1, 3); `tailwind` prop from the entry module (Task 3).
- Produces:
  - `Route` gains `{ view: 'tailwind'; source: string | null; category: string | null }`; `parseHash('#/tailwind?source=<id>&category=<id>')`; only the exact single segment `tailwind` maps to it (`#/tailwind/Button` stays a detail page). `export function formatTailwindHash(source?: string, category?: string): string`.
  - `i18n.ts`: new `Messages` keys `tailwind` ('Tailwind CSS' / 'Tailwind CSS'), `filterTokens`, `sampleText`, `fullConfig`, `copyClass`, `copyVariable`, `noTokens`, `tailwindError`; `export const categoryTitles: Record<'en' | 'ja', Record<TailwindCategoryId | 'full-config', string>>`.
  - `App` prop `tailwind?: TailwindListItem[]` (default `[]`); `Sidebar` props `tailwind: { id: string; file: string }[]`, `currentTailwind?: string`.

- [ ] **Step 1: Write the failing tests**

```ts
// hash.test.ts
it('parses the Tailwind page', () => {
  expect(parseHash('#/tailwind?source=abc&category=spacing')).toEqual({ view: 'tailwind', source: 'abc', category: 'spacing' });
  expect(parseHash('#/tailwind')).toEqual({ view: 'tailwind', source: null, category: null });
  expect(parseHash('#/tailwind/Button').view).toBe('detail');
});
// i18n.test.ts
it('category titles exist in both languages', ...);   // same keys, no empty strings
// Tailwind.svelte.test.ts (render with a hand-made TailwindSource)
it('shows the first category with a sample, the class and the variable', ...);
it('switches category through the hash', ...);
it('filters by class name and value', ...);          // typing 'brand' leaves only bg-brand-500; no match shows t.noTokens
it('copies the class name', ...);                    // navigator.clipboard.writeText called with 'bg-brand-500'
it('shows every theme variable in Full config', ...);
it('shows the entry\'s error instead of the tokens', ...);
it('applies the sample CSS only inside the page', ...); // a .bg-brand-500 element outside the scope has no background
// App.svelte.test.ts
it('has no Tailwind item without Tailwind data', ...);
it('links one Tailwind item per entry, labelled with the file when there are several', ...);
```

- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app` and `--project server src/lib/app/hash.test.ts src/lib/app/i18n.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**
  - `Tailwind.svelte`: loads the selected entry's data through `load()` (first entry when `source` is null), renders the categories as links (`formatTailwindHash`), a filter field (matches `class`, `cssVariable`, `value`, case-insensitive), a sample-text field for `text`/`text-color` kinds, then one card per token: sample `<div class={token.class}>` inside the scope element `zukan-tw-<id>` (kinds styled like Histoire's `render.ts`), the class and variable with copy buttons (`navigator.clipboard.writeText`, the same failure handling as `CodeBlock.svelte`). "Full config" lists `variables`. The sample CSS is injected with a `<style>` element owned by the page and removed with it. Category titles come from `categoryTitles[locale]`. Up to a few hundred cards per category render without virtualization.
  - `App.svelte`: route `tailwind` renders `Tailwind` in `<main>`; the document title is `Tailwind CSS | <title>`; `j`/`k` do nothing on this page.
  - `Sidebar.svelte`: below the entry list, inside the same `nav`, one link per entry (`t.tailwind`, or `t.tailwind` + ` (<file>)` when there are several), `aria-current="page"` when active.

- [ ] **Step 4: Run the tests** — same commands. Expected: PASS. Then `pnpm --filter svelte-zukan run check`. Expected: 0 errors.

- [ ] **Step 5: Commit** — `feat: add the Tailwind CSS page to the catalog`.

---

### Task 5: Agents

**Files:**

- Modify: `packages/svelte-zukan/src/lib/app/webmcp.ts`, `app/App.svelte` (pass `tailwind: tailwind.length > 0` to `buildTools`), `packages/svelte-zukan/skills/svelte-zukan/SKILL.md`
- Test: `packages/svelte-zukan/src/lib/app/webmcp.svelte.test.ts`

**Interfaces:**

- Consumes: `CatalogJson.tailwind` (Task 3).
- Produces: `buildTools` option `tailwind?: boolean`; when true, a tool `list_tailwind_tokens` with input `{ category?: TailwindCategoryId | 'full-config'; query?: string }`, read-only. Without `category`: per entry `{ file, prefix, error?, categories: { id, title, count }[] }`. With `category`: per entry the tokens of that category (or the variables for `full-config`), filtered by `query` like the page.

- [ ] **Step 1: Write the failing tests** — `registers list_tailwind_tokens only with Tailwind data`; `summarizes categories without a category`; `returns the filtered tokens of a category`; `answers an unknown category with an error result`.
- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/webmcp.svelte.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the tool and the SKILL.md lines** (the `tailwind` field of `catalog.json`: use only listed classes; `null` means the project has no Tailwind v4).
- [ ] **Step 4: Run the tests** — same command. Expected: PASS.
- [ ] **Step 5: Commit** — `feat: give agents the Tailwind CSS tokens`.

---

### Task 6: Build tests and the dogfooding demo

**Files:**

- Modify: `tests/build/package.json` (`tailwindcss`, `@tailwindcss/node` as `catalog:` dev dependencies), `tests/build/build.test.ts`
- Create: `tests/build/vite-svelte/src/app.css` (`@import "tailwindcss";` and `@theme { --color-brand-500: #ff3e00; }`)
- Create: `packages/svelte-zukan/src/tailwind.css` (`@import "tailwindcss";` and a few `@theme` tokens; not in `src/lib`, so it is never published; the root `src` is searched in both demo locales)

- [ ] **Step 1: Write the failing tests** in `build.test.ts`: the `vite-svelte` catalog's `catalog.json` has one `tailwind` entry with `file: 'src/app.css'` and a `background-color` token `{ class: 'bg-brand-500', cssVariable: '--color-brand-500', value: '#ff3e00' }`; the monorepo catalog has `tailwind: null`; the written files contain no absolute path of the fixture (extend the existing check if there is one).
- [ ] **Step 2: Run them to verify they fail** — `pnpm --filter build-tests exec vitest run build.test.ts`. Expected: FAIL.
- [ ] **Step 3: Add the fixture CSS and the dependencies**, `pnpm install`.
- [ ] **Step 4: Run the build tests both ways** — `pnpm --filter build-tests exec vitest run build.test.ts`, then `pnpm run package` and `ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts`. Expected: PASS.
- [ ] **Step 5: Add the demo CSS and check the demo** — `pnpm --filter svelte-zukan build` and `ZUKAN_DEMO_LOCALE=ja pnpm --filter svelte-zukan build`; both `zukan-dist/catalog.json` have a `tailwind` entry with `file: 'src/tailwind.css'`; `src/examples.test.ts` still passes.
- [ ] **Step 6: Commit** — `test: cover Tailwind CSS tokens in the build tests and show them in the demo`.

---

### Task 7: Docs and release

**Files:**

- Create: `docs/content/(catalog)/tailwind.md`, `docs/content/ja/(catalog)/tailwind.md` (sidebar order after `catalog-ui`)
- Modify: `docs/content/(catalog)/ai-agents.md`, `docs/content/ja/(catalog)/ai-agents.md` (the `tailwind` field and `list_tailwind_tokens`), CONTRIBUTING.md (first rule of "What belongs in svelte-zukan" includes the design tokens components are built from), AGENTS.md (the two modules, the guard, the virtual modules, the HMR rule for CSS), `README.md` / `README.ja.md` untouched
- Create: `.changeset/tailwind-tokens.md` (`'svelte-zukan': minor`, `feat: show the project's Tailwind CSS v4 theme in the catalog and in catalog.json.`)

- [ ] **Step 1: Write the pages** — what appears and when (v4+, entry detection incl. `src/app.css` with `groups`, `@theme`-only files), the categories, the filter and copy, errors, what is not shown (arbitrary values, variants, dark-mode values), and that it uses the project's `@tailwindcss/node` (installed with `@tailwindcss/vite`, `@tailwindcss/postcss` or `@tailwindcss/cli`).
- [ ] **Step 2: Verify** — `pnpm --filter docs build`, `pnpm run lint`, `pnpm run check`, `pnpm run test`. Expected: all pass.
- [ ] **Step 3: Commit** — `docs: document the Tailwind CSS page`.
