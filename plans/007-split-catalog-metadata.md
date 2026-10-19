# Plan 007: The detail page reads sections and docs from a metadata module and never imports the component

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib packages/svelte-zukan/package.json AGENTS.md renovate.json docs/content/why.md docs/content/ja/why.md`
> Plans 001, 003, 004 and 006 change parts of these paths (`context.ts`, `App.svelte`, the `hotUpdate` create/delete branch, `extract.ts` section extraction). Those changes are expected. Anything else is drift: compare with "Current state" and STOP on a mismatch.

## Status

- Priority: P2
- Effort: L
- Risk: MED
- Depends on: plans/004-hmr-recreated-catalog-file.md and plans/006-complete-code-view.md (same functions in `index.ts` and `extract.ts`)
- Category: bug + tech-debt
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

The catalog UI page (the parent of the preview iframes) imports every catalog file it shows, only to read the `__zukan` export that the plugin appends to it. Importing a catalog file also imports the user's component and everything it imports. Global CSS imported by a component (`import './tokens.css'`), `:global(...)` rules and module side effects therefore reach the catalog UI. The docs promise the opposite: `wrapper.md` says the catalog UI "does not load the app's CSS either". The comment in `Preview.svelte` ("the wrapper is imported only here, so its global CSS never reaches the catalog UI") shows the intent.

After this plan, sections and the rendered doc come from a small virtual module per entry (`virtual:svelte-zukan/meta/<ID>`), and only the preview iframe imports the component. That also lets the plugin drop its `transform` hook and the `magic-string` runtime dependency. A side effect: imports such as `Foo.zukan.svelte?raw`, which the transform hook currently breaks, work again.

## Current state

- `packages/svelte-zukan/src/lib/vite/virtual.ts`:
  ```ts
  export const ENTRY = 'virtual:svelte-zukan/entry';
  export const CATALOG = 'virtual:svelte-zukan/catalog';

  export function generateCatalogModule(items: CatalogItem[]): string {
    // `file` is left out so that absolute paths do not end up in the static build
    const entries = items.map(
      ({ file, ...item }) => `  { ...${JSON.stringify(item)}, load: () => import(${JSON.stringify(file)}) }`
    );
    return `export const catalog = [\n${entries.join(',\n')}\n];\n`;
  }
  ```
- `packages/svelte-zukan/src/lib/vite/index.ts`:
  - imports `marked`, `transformZukan` from `./extract.js`, and `SVELTE_STYLE_ID, createMatchers` from `./matchers.js`; line 21 destructures `catalogId, isCatalogId, isCatalogFile, isDocFile, docFileOf, catalogFileOf` from `createMatchers(...)`;
  - `resolveId(id) { if (id === ENTRY || id === CATALOG) return '\0' + id; }`;
  - `load(id)`: returns `generateCatalogModule(listCatalog(groups, resolved.suffix))` for `'\0' + CATALOG`, and the entry module for `'\0' + ENTRY`;
  - the transform hook (lines 207–220):
    ```ts
      transform: {
        filter: { id: { include: catalogId, exclude: [/^\0/, SVELTE_STYLE_ID] } },
        handler(code, id) {
          if (!isCatalogId(id)) return;
          const filename = id.split(/[?#]/)[0];
          const docPath = docFileOf(filename);
          let doc: string | null = null;
          if (existsSync(docPath)) {
            this.addWatchFile(docPath);
            doc = marked.parse(readFileSync(docPath, 'utf-8'), { async: false });
          }
          return transformZukan(code, filename, doc);
        }
      },
    ```
  - `hotUpdate` (lines 221–240) has three branches: a `.md` file (invalidates the catalog file's modules), `update` of a catalog file (invalidates `modules`), and create/delete of a catalog file in a scanned dir (invalidates the list module; after plan 004 also `modules`). Then it sends `{ type: 'custom', event: 'zukan:reload' }` and returns `[]`.
- `packages/svelte-zukan/src/lib/vite/extract.ts` exports `extractSections(source, filename)` (sections only) and `transformZukan(source, filename, doc)`, which uses `MagicString` to append `export const __zukan = …` and returns `{ code, map }`.
- `packages/svelte-zukan/src/lib/vite/matchers.ts` exports `SVELTE_STYLE_ID`, `escapeRegExp` and `createMatchers(suffix)`, which returns `catalogId`, `isCatalogId`, `isCatalogFile`, `isDocFile`, `docFileOf`, `catalogFileOf`. `catalogId` / `isCatalogId` / `SVELTE_STYLE_ID` are used only by the transform hook.
- `packages/svelte-zukan/src/lib/types.ts`:
  ```ts
  export type ZukanSection = { title: string; code: string };
  export type ZukanMeta = { sections: ZukanSection[]; doc: string | null };
  export type ZukanModule = { default: Component; __zukan?: ZukanMeta };
  ...
  export type Entry = Omit<CatalogItem, 'file'> & { load: () => Promise<ZukanModule> };
  ```
- `packages/svelte-zukan/src/lib/app/Detail.svelte:19-34`:
  ```svelte
  {#key entry.path}
    {#await entry.load() then mod}
      {#if mod.__zukan?.doc}
        <!-- the HTML comes from the user's own Document.md, rendered at build time -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="doc">{@html mod.__zukan.doc}</div>
      {/if}
      {#each mod.__zukan?.sections ?? [] as section (section.title)}
        <h2>{section.title}</h2>
        <PreviewFrame src="./{formatHash('preview', entry.path, section.title)}" title={section.title} labels={t} />
        <CodeBlock code={section.code} labels={t} />
      {/each}
    {:catch error}
      <p>{t.loadFailed} {error instanceof Error ? error.message : String(error)}</p>
    {/await}
  {/key}
  ```
  `Preview.svelte` calls `entry.load()` and renders `mod.default`. It does not use `__zukan`.
- Tests that depend on the current shape:
  - `src/lib/vite/extract.test.ts` `describe('transformZukan')` (5 tests);
  - `src/lib/vite/index.test.ts`: `describe('createMatchers')` tests for `isCatalogId`; `describe('transform')` (lines 88–150; it uses the helper `transform(...)` and the constant `h1`); `describe('hotUpdate')` and `describe('hotUpdate of the catalog list')`, whose fake `moduleGraph` has `getModulesByFile`, `getModuleById`, `invalidateModule`; `describe('virtual modules')` (calls `p.resolveId(...)` and `p.load(...)` directly);
  - `src/lib/app/App.svelte.test.ts`: `const load = () => Promise.resolve({ default: Catalog, __zukan: { sections: [], doc: null } });`, used by every catalog entry, and the test `'a load error is shown'`, which makes `load` reject on a detail page and expects `'Failed to load: boom'`.
- Text that describes the current design:
  - `AGENTS.md:56`: "Transform (`vite/extract.ts`): parses `*.<suffix>.svelte` with `svelte/compiler` and appends `export const __zukan = { sections, doc }` via `magic-string` (with a source map). `Foo.<suffix>.md` next to the file is rendered with `marked` and registered with `addWatchFile`."
  - `AGENTS.md:112`: "`marked` and `magic-string` are runtime dependencies of the plugin. …"
  - `renovate.json:18` description: "marked and magic-string ship as runtime dependencies …"
  - `docs/content/why.md:36`: "The plugin and its two runtime dependencies (`marked` and `magic-string`) are about 1 MB."; `docs/content/ja/why.md:36`: 「プラグインと実行時の依存 2 つ（`marked` と `magic-string`）で約 1 MB です。」
  - `packages/svelte-zukan/package.json` `dependencies`: `"magic-string": "^1.4.3"`, `"marked": "^18.1.1"`.
- Vite facts this design relies on (checked in Vite 8.3.2 and vite-plugin-svelte 7.3.1 sources):
  - vite-plugin-svelte compiles any id matching `^[^?#]+\.svelte(?:[?#]|$)` that does not start with `\0`. A query-based id such as `Foo.zukan.svelte?zukan-meta` would be compiled as Svelte, so the metadata module must be a `\0` virtual module;
  - `EnvironmentModuleGraph` has a public `idToModuleMap: Map<string, EnvironmentModuleNode>`.
- AGENTS.md rules that still hold: HMR sends only `zukan:reload`, never `full-reload`; absolute paths must not end up in the static build; `marked` stays a runtime dependency.

## Commands you will need

| Purpose       | Command                                      | Expected on success                                          |
| ------------- | -------------------------------------------- | ------------------------------------------------------------ |
| Install       | `pnpm install`                               | exit 0                                                       |
| Library tests | `pnpm --filter svelte-zukan exec vitest run` | all pass                                                     |
| Package       | `pnpm run package`                           | exit 0                                                       |
| Typecheck     | `pnpm run check`                             | exit 0                                                       |
| Build tests   | `pnpm --filter build-tests test`             | all pass                                                     |
| Dogfood build | `pnpm --filter svelte-zukan build`           | exit 0, `packages/svelte-zukan/zukan-dist/index.html` exists |
| Lint          | `pnpm run format && pnpm run lint`           | exit 0                                                       |

## Suggested executor toolkit

- For `Detail.svelte`, use the `svelte:svelte-file-editor` agent or the Svelte MCP `svelte-autofixer` if available.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/virtual.ts`, `index.ts`, `extract.ts`, `matchers.ts`
- `packages/svelte-zukan/src/lib/vite/index.test.ts`, `extract.test.ts`
- `packages/svelte-zukan/src/lib/types.ts`
- `packages/svelte-zukan/src/lib/app/Detail.svelte`, `app/App.svelte.test.ts`, `components/EntryList.svelte.test.ts`
- `packages/svelte-zukan/package.json` (remove `magic-string` from `dependencies`), `pnpm-lock.yaml` (via `pnpm install`)
- `AGENTS.md` (lines 56 and 112), `renovate.json` (the description string on line 18)
- `docs/content/why.md`, `docs/content/ja/why.md` (line 36 only)
- `.changeset/catalog-metadata-module.md` (create)

**Out of scope**:

- `Preview.svelte`, `Section.svelte`, `context.ts`.
- The install-size table in `why.md` (line 13). It is a dated measurement of the published version.
- `docs/content/guides/wrapper.md`. Its claim becomes true with this plan, so leave it as is.

## Git workflow

- Branch: `advisor/007-split-catalog-metadata`
- Commits, for example `feat: load sections and docs from a metadata module instead of the component`, then `chore: drop the transform hook and magic-string`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Add the metadata module to the plugin (keep the transform for now)

1. In `virtual.ts`, add `export const META = 'virtual:svelte-zukan/meta/';`. In `generateCatalogModule`, add `meta: () => import(${JSON.stringify(META + encodeURIComponent(item.path))})` next to `load`. `encodeURIComponent` keeps `/`, `?` and `#` in IDs out of the module id.
2. In `index.ts`:
   - `resolveId`: also return `'\0' + id` when `id.startsWith(META)`;
   - `load`: when `id.startsWith('\0' + META)`, decode the rest of the id (`raw = id.slice(META.length + 1)`; `path = decodeURIComponent(raw)` in a `try`, falling back to `raw`, because Vite's dev server may already have decoded part of it, for example `%20` to a space), find the item with `listCatalog(groups, resolved.suffix).find((i) => i.path === path)` (throw `svelte-zukan: no catalog file for ID "<path>"` if there is none), then `this.addWatchFile(item.file)`, read and `marked.parse` the `.md` file when it exists (`docFileOf(item.file)`, also `addWatchFile`), run `extractSections(readFileSync(item.file, 'utf-8'), item.file)`, and return `` `export default ${JSON.stringify({ sections, doc })};\n` ``.
     Rescanning with `listCatalog` per load keeps the module correct after files are added. It globs only the scanned directories.
3. Tests in `index.test.ts`, `describe('virtual modules')`:
   - `p.resolveId('virtual:svelte-zukan/meta/app%2FA')` → `'\0virtual:svelte-zukan/meta/app%2FA'`;
   - the catalog module contains `import("virtual:svelte-zukan/meta/app%2FA")`;
   - `p.load.call({ addWatchFile: vi.fn() }, '\0virtual:svelte-zukan/meta/app%2FA')` returns a string that contains `"title":"Foo"`, contains `"doc":null` (the temp app has no `A.zukan.md`), and does not contain the temp dir path. Write `src/A.zukan.md` with `# A` in a second case and expect `<h1>A</h1>` and `addWatchFile` called with that file;
   - an unknown ID throws `/no catalog file/`;
   - an ID with a space: write `src/My Button.zukan.svelte` (`<Section title="B"><p>b</p></Section>`); both `'\0virtual:svelte-zukan/meta/app%2FMy%20Button'` and the partly decoded `'\0virtual:svelte-zukan/meta/app%2FMy Button'` load and contain `"title":"B"`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts` → all pass.

### Step 2: Switch the detail page to the metadata module

1. `types.ts`: add `meta: () => Promise<{ default: ZukanMeta }>` to `Entry`.
2. `src/lib/components/EntryList.svelte.test.ts` builds entries with only `load` (lines 12–13). Add `meta: () => Promise.resolve({ default: { sections: [], doc: null } })` to each, or `pnpm run check` fails on the new required field.
3. `Detail.svelte`: replace `{#await entry.load() then mod}` with `{#await entry.meta() then { default: meta }}`, and use `meta.doc` / `meta.sections` (no optional chaining needed). Update the HTML comment: `<!-- the HTML comes from the user's own .md file, rendered by the plugin -->`.
4. `App.svelte.test.ts`:
   - add `const meta = () => Promise.resolve({ default: { sections: [], doc: null } });` and give every catalog entry in the file `meta` (the one in `setup` and every `props.catalog.push({...})`); change `load` to `() => Promise.resolve({ default: Catalog })`;
   - in `'a load error is shown'`, make `meta` reject instead of `load`;
   - new test `'a detail page reads the metadata, not the component'`: `const { props } = setup('#/ui/Card'); const spy = vi.fn(load); props.catalog[0].load = spy; props.catalog[0].meta = () => Promise.resolve({ default: { sections: [], doc: '<p>Doc text</p>' } });`, render, wait for `screen.getByText('Doc text')`, and `expect(spy).not.toHaveBeenCalled()`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/App.svelte.test.ts` → all pass. `pnpm run package && pnpm run check` → exit 0.

### Step 3: Invalidate metadata modules on HMR

In `hotUpdate`, after the branch that returns early for unrelated files (so other files in the project do not pay for it), collect the metadata modules of the environment:

```ts
const metas = [...moduleGraph.idToModuleMap.values()].filter((m) => m.id?.startsWith('\0' + META));
```

and add them to the targets of every branch:

- `.md` file: targets = `metas`. The component no longer depends on the `.md`;
- `update` of a catalog file: `[...modules, ...metas]`;
- create/delete: the existing targets plus `metas`.

Keep the `zukan:reload` send and `return []` as they are. In both fake `moduleGraph`s in `index.test.ts`, add `idToModuleMap: new Map([[metaMod.id, metaMod]])` with `const metaMod = { id: '\0virtual:svelte-zukan/meta/app%2FA' }`, and assert that `metaMod` is invalidated for a `.md` change, a catalog `update`, and a `create`. Existing tests that change:

- `'invalidates the catalog file on %s of its .md'`: drop the `getModulesByFile` expectation (the doc branch no longer looks up the catalog file) and expect `invalidateModule.mock.calls[0][0]` to be `metaMod` instead of `mod`;
- `'does not throw when the catalog file is not in the module graph'`: give that setup an empty `idToModuleMap` (`new Map()`), so `invalidateModule` is still not called. Make the `setup` helper take the map as a parameter if that is simplest.

**Verify**: plugin tests → all pass.

### Step 4: Remove the transform hook and `__zukan`

1. `index.ts`: delete the `transform` hook and the imports that only it used (`transformZukan`, `SVELTE_STYLE_ID`, `catalogId`, `isCatalogId`). Also drop `catalogFileOf` from the `createMatchers(...)` destructure on line 21, since Step 3 removed its only use (keep it in `matchers.ts`; its tests use it). Keep `existsSync`, `readFileSync` and `marked` (Step 1 uses them).
2. `extract.ts`: delete `transformZukan` and the `magic-string` import. Keep `parseZukan` and `extractSections`.
3. `matchers.ts`: delete `SVELTE_STYLE_ID`, `catalogId` and `isCatalogId`. Keep `escapeRegExp`, the suffix validation and the other matchers.
4. `types.ts`: `ZukanModule` becomes `{ default: Component }`.
5. Tests: delete `describe('transformZukan')` in `extract.test.ts` and its now unused `compile` import (line 1). In `describe('createMatchers')`, delete the two tests that only check `isCatalogId` (`'matches catalog files, with or without a query'` and `'rejects style modules, virtual modules and other files'`), and remove only the `isCatalogId` lines from `'follows the suffix'` and `'is case-sensitive, using the suffix verbatim'`. Also delete `describe('transform')` in `index.test.ts`, together with the `transform` helper and the `h1` constant if nothing else uses them. Keep the assertions on `plugin.name` and `plugin.enforce` by moving them to `describe('public API')` or a new `it` in `describe('virtual modules')`. Add `expect(plugin.transform).toBeUndefined();`.
6. `packages/svelte-zukan/package.json`: remove `"magic-string"` from `dependencies`, then `pnpm install`.

**Verify**:

- `git grep -n -e "magic-string" -e "MagicString" -e "transformZukan" -e "isCatalogId" -e "__zukan =" -e "__zukan?:" -e "\.__zukan" -e "__zukan:" packages/svelte-zukan/src` → no output (the `/__zukan/` URL strings are expected and do not match).
- `pnpm --filter svelte-zukan exec vitest run` → all pass.
- `pnpm run package && pnpm run check` → exit 0.

### Step 5: Check the real builds

**Verify**:

- `pnpm --filter build-tests test` → all pass. If plan 005 landed, its assertions on `'Long title'` and `'A card from'` must still pass: they now come from the metadata chunks.
- `pnpm --filter svelte-zukan build` → exit 0. Then `grep -rl "$(pwd)" packages/svelte-zukan/zukan-dist` → no output (no absolute paths in the static build).

### Step 6: Update the descriptions

- `AGENTS.md:56`: replace the Transform bullet with: "Metadata (`vite/extract.ts`, `vite/index.ts`): for each entry, the virtual module `virtual:svelte-zukan/meta/<encoded ID>` parses the catalog file with `svelte/compiler` and exports `{ sections, doc }`, with `Foo.<suffix>.md` rendered by `marked`. The detail page imports only this module; only the preview iframe imports the catalog file (and so the component), which keeps the component's CSS and side effects out of the catalog UI. The plugin has no `transform` hook."
- `AGENTS.md:112`: "`marked` is the runtime dependency of the plugin. Keep it in `dependencies`; Renovate does not auto-merge its updates because they reach every consumer."
- `renovate.json:18` description: "marked ships as a runtime dependency of the published package, so its updates reach every consumer — keep them manually reviewed." Keep the rule itself (`matchDepTypes: ["dependencies"]`).
- `docs/content/why.md:36`: "The plugin and its one runtime dependency (`marked`) are about 1 MB." `docs/content/ja/why.md:36`: 「プラグインと実行時の依存 1 つ（`marked`）で約 1 MB です。」
- Create `.changeset/catalog-metadata-module.md`:
  ```md
  ---
  'svelte-zukan': patch
  ---

  fix: the catalog page no longer imports your components to read their sections, so CSS and side effects from a component reach only its preview, not the catalog UI. Imports such as `Foo.zukan.svelte?raw` work again, and `magic-string` is no longer a dependency.
  ```

**Verify**: `pnpm run format && pnpm run lint` → exit 0, and `pnpm --filter docs build` → exit 0.

## Test plan

- `index.test.ts`: metadata `resolveId` / `load` cases (Step 1) and metadata invalidation in `hotUpdate` (Step 3); the transform tests are removed (Step 4).
- `App.svelte.test.ts`: the detail page reads `meta` and never calls `load` (Step 2).
- Real builds: `tests/build` and the dogfood build (Step 5).
- Manual check if possible: `pnpm --filter svelte-zukan dev`, open `/__zukan/#/ui/components/Badge`. Sections and code show. Edit `Badge.zukan.svelte` and its `.md`: the tab reloads with the change.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0
- [ ] `pnpm run package && pnpm run check` exits 0
- [ ] `pnpm --filter build-tests test` exits 0
- [ ] `pnpm --filter svelte-zukan build` exits 0 and `test -f packages/svelte-zukan/zukan-dist/index.html` succeeds
- [ ] `git grep -n "magic-string" -- packages AGENTS.md renovate.json docs/content` prints nothing
- [ ] `git grep -n -e "__zukan =" -e "__zukan?:" -e "\.__zukan" -e "__zukan:" packages/svelte-zukan/src` prints nothing (the `/__zukan/` URL strings are expected and do not match)
- [ ] `pnpm run lint` exits 0
- [ ] `.changeset/catalog-metadata-module.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- `moduleGraph.idToModuleMap` does not exist on `this.environment.moduleGraph` in the installed Vite (TypeScript error or `undefined` at runtime).
- In dev, a change to a catalog file or its `.md` does not show after the reload (manual check). Report instead of falling back to `full-reload`.
- The static build contains the absolute repo path after Step 5.
- A test outside the listed describes fails because of the removed transform.
- Plan 004 or 006 has not landed and the code in `hotUpdate` / `extract.ts` still matches the pre-004/006 excerpts. Do 004 and 006 first.

## Maintenance notes

- The metadata module rescans the catalog dirs on each load. If catalogs grow to thousands of files and dev feels slow, cache the list between `hotUpdate` create/delete events.
- Section validation errors (missing title, nested `Section`, …) now surface when the metadata module loads, which is on the detail page in dev and always in a build. Opening a preview URL directly no longer validates the file.
- `wrapper.md`'s "does not load the app's CSS either" is now accurate. Keep it accurate when changing what the catalog page imports.
