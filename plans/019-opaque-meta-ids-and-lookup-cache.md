# Plan 019: Metadata module IDs survive any file name, and loading them no longer rescans every directory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/virtual.ts packages/svelte-zukan/src/lib/vite/index.test.ts`
> Plan 015 is expected to have changed `index.ts` (`configEnvironment`, `buildApp`) and `index.test.ts` (`build` tests). Those hunks are fine. Any change to the `load` hook, `hotUpdate`, `virtual.ts`, or the `metadata modules` tests is a STOP condition.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: plans/015-catalog-css-code-split.md (same files; run after it)
- Category: bug + perf
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

For each catalog entry, the plugin serves a virtual module `virtual:svelte-zukan/meta/<encodeURIComponent(ID)>` with that entry's sections and rendered docs. Two problems come from that ID:

1. **`%` in a file name breaks dev.** Vite's dev transform middleware runs `decodeURI` on the request URL (Vite 8.3.4, `node.js:20351`). That decodes `%25` to `%` but leaves `%2F` encoded, so `ui/100%Bar` arrives as `ui%2F100%Bar`. The plugin's `decodeURIComponent` then throws, the raw ID is kept, and the load fails with `no catalog file for ID`. Checked with Node: `decodeURI('/@id/__x00__virtual:svelte-zukan/meta/' + encodeURIComponent('ui/100%Bar'))` gives `…meta/ui%2F100%Bar`, and `decodeURIComponent` of that throws `URI malformed`.
2. **A `.css`-looking last segment.** `encodeURIComponent` keeps `.`, so a file named `theme.css.zukan.svelte` (ID `ui/theme.css`) produces a meta ID ending in `.css`. Vite's CSS plugins match IDs by extension, and the `\0` prefix does not exclude them. The ID only has to stop looking like a file name.

The same `load` hook also calls `listCatalog(groups, suffix)` on every meta load. `listCatalog` globs every scanned directory, and the static build loads every meta module, so a build with N entries scans the tree N times.

Encoding the ID as lowercase hex of its UTF-8 bytes removes both ID problems, because `decodeURI` leaves hex alone and hex has no `.` or `%`. A path→item map, rebuilt only when it misses or when a catalog file is created or deleted, removes the repeated scans.

## Current state

- `packages/svelte-zukan/src/lib/vite/virtual.ts:1-14`:
  ```ts
  import type { CatalogItem } from '../types.js';

  export const ENTRY = 'virtual:svelte-zukan/entry';
  export const CATALOG = 'virtual:svelte-zukan/catalog';
  export const META = 'virtual:svelte-zukan/meta/';

  export function generateCatalogModule(items: CatalogItem[]): string {
    // `file` is left out so that absolute paths do not end up in the static build
    const entries = items.map(
      ({ file, ...item }) =>
        `  { ...${JSON.stringify(item)}, load: () => import(${JSON.stringify(file)}), meta: () => import(${JSON.stringify(META + encodeURIComponent(item.path))}) }`
    );
    return `export const catalog = [\n${entries.join(',\n')}\n];\n`;
  }
  ```
- `packages/svelte-zukan/src/lib/vite/index.ts:182-205` (`load`):
  ```ts
    load(id) {
      if (id.startsWith('\0' + META)) {
        const raw = id.slice(META.length + 1);
        // the dev server may already have decoded part of the id (e.g. `%20`)
        let path = raw;
        try {
          path = decodeURIComponent(raw);
        } catch {
          // keep the raw id
        }
        // listed again on every load, so that files added after the start are found
        const item = listCatalog(groups, resolved.suffix).find((i) => i.path === path);
        if (!item) throw new Error(`svelte-zukan: no catalog file for ID "${path}"`);
        this.addWatchFile(item.file);
        // …reads the .md and the catalog file…
      }
      if (id === '\0' + CATALOG) return generateCatalogModule(listCatalog(groups, resolved.suffix));
  ```
- `index.ts:272-293` (`hotUpdate`); the create/delete branch is lines 281–285:
  ```ts
      } else if (isCatalogFile(file) && scanned().some((dir) => isInside(normalizePath(file), dir))) {
        // created or deleted: the list is rebuilt when the module is loaded again, and Vite does not
        // invalidate the file's own module on add or unlink, so a re-created file would keep its old module
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = [...modules, ...metas(), ...(list ? [list] : [])];
  ```
  `metas()` (line 275) selects modules whose `id` starts with `'\0' + META`; it does not depend on the encoding.
- `packages/svelte-zukan/src/lib/vite/discover.ts:72-98` — `listCatalog` returns `CatalogItem[]` (`{ group, name, dir, path, file }`) and throws on a duplicate ID.
- `packages/svelte-zukan/src/lib/vite/index.test.ts`:
  - `describe('metadata modules')` (lines 310–362) builds IDs as `meta('app%2FA')` = `` `\0virtual:svelte-zukan/meta/app%2FA` `` and includes `it.each(['app%2FMy%20Button', 'app%2FMy Button'])('finds an ID with a space (%s)')`.
  - `makeApp()` (lines 117–131) creates `<tmp>/app/src/A.zukan.svelte`; `boot(root, options)` (lines 133–142) runs the `config` hook and returns the plugin `p`.
  - The `hotUpdate` tests (lines 59–115 and 492–546) use meta module ids like `'\0virtual:svelte-zukan/meta/app%2FA'` only as opaque ids in a fake module graph.
- `packages/svelte-zukan/src/lib/vite/hmr.test.ts` — real-dev-server tests; not changed here.

## Commands you will need

| Purpose            | Command (from the repo root)                                  | Expected on success |
| ------------------ | ------------------------------------------------------------- | ------------------- |
| Install            | `pnpm install`                                                | exit 0              |
| Plugin unit tests  | `pnpm --filter svelte-zukan exec vitest run --project server` | all pass            |
| Build tests (slow) | `pnpm --filter build-tests exec vitest run build.test.ts`     | all pass            |
| Type check         | `pnpm run package && pnpm run check`                          | exit 0              |
| Lint               | `pnpm run lint` (fix with `pnpm run format`)                  | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/virtual.ts`
- `packages/svelte-zukan/src/lib/vite/index.ts` (`load`, `hotUpdate`, one new closure variable)
- `packages/svelte-zukan/src/lib/vite/index.test.ts`
- `.changeset/opaque-meta-ids.md` (create)

**Out of scope**:

- Catalog IDs themselves, hash URLs (`src/lib/app/hash.ts`), and the import of the catalog file (`load: () => import(file)`). A `?` or `#` in a directory name may break that import; that is not traced, so leave it.
- `discover.ts`.
- AGENTS.md: its text `virtual:svelte-zukan/meta/<encoded ID>` stays true.

## Git workflow

- Branch: `advisor/019-opaque-meta-ids`
- Conventional Commits, e.g. `fix: encode metadata module IDs as hex`, `perf: look catalog entries up from a cached map`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Add the encoding helpers and failing tests

In `virtual.ts`, export two helpers next to `META` and use the first in `generateCatalogModule`:

```ts
/** hex of the UTF-8 ID: the dev server's decodeURI leaves it alone, and it never ends like a file extension */
export const metaId = (path: string) => META + Buffer.from(path, 'utf8').toString('hex');
export const pathOfMeta = (hex: string) =>
  /^(?:[0-9a-f]{2})*$/.test(hex) ? Buffer.from(hex, 'hex').toString('utf8') : null;
```

Replace `META + encodeURIComponent(item.path)` with `metaId(item.path)`. `Buffer` is a Node global; `virtual.ts` only runs in Node.

Add tests to `index.test.ts`:

- In `describe('generateCatalogModule')`: the generated specifier for `@acme/ui/lib/100%.css` is unchanged by `decodeURI`, contains no `%` and no `.` after `meta/`, and `pathOfMeta` turns it back into the ID.
- In `describe('metadata modules')`, replace the `meta` helper with `const meta = (path: string) => '\0' + metaId(path);` (import `metaId` from `./virtual.js`) and change every call to pass the plain ID (`meta('app/A')`, `meta('app/Nope')`, `meta('app/B')`). Replace the `finds an ID with a space` `it.each` with one `it.each(['My Button', '100%', 'theme.css', 'ボタン'])('finds the file %s', …)` that writes `src/<name>.zukan.svelte` and expects `"title":"B"`.
- Update `resolves the metadata of an entry and lists it in the catalog` to expect `p.resolveId(metaId('app/A'))` → `'\0' + metaId('app/A')` and the catalog to contain `` `import("${metaId('app/A')}")` ``.
- Add: `p.load` of `'\0' + META + 'zz'` (not hex) throws `/no catalog file/`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts` → every `metadata modules` test that loads an existing file fails (the `load` hook still decodes URI components); `throws for an unknown ID` and the non-hex test may already pass; the `generateCatalogModule` tests pass.

### Step 2: Decode with `pathOfMeta` and cache the lookup

In `index.ts`:

1. Import `metaId`/`pathOfMeta` as needed from `./virtual.js`.
2. Add a closure variable next to the others at the top of `zukan()`:
   ```ts
   /** path → item, from the last listing; dropped when a catalog file is created or deleted */
   let items: Map<string, CatalogItem> | null = null;
   ```
   (`CatalogItem` from `../types.js`; `CatalogGroup` is already imported from there.)
3. Add a helper inside `zukan()`:
   ```ts
   const relist = () => {
     const all = listCatalog(groups, resolved.suffix);
     items = new Map(all.map((i) => [i.path, i]));
     return all;
   };
   ```
4. In `load`, replace the decode block and the `find` with:
   ```ts
   const path = pathOfMeta(id.slice(META.length + 1));
   // a miss lists again, so that files added after the last listing are found
   const item = path === null ? undefined : (items?.get(path) ?? (relist(), items!.get(path)));
   if (!item) throw new Error(`svelte-zukan: no catalog file for ID "${path ?? id.slice(META.length + 1)}"`);
   ```
   and the catalog module line with `if (id === '\0' + CATALOG) return generateCatalogModule(relist());`.
5. In the `hotUpdate` create/delete branch, add `items = null;` (a deleted file must not be served from the map). Extend the branch's comment by a few words if needed.
6. Reset `items = null` at the start of the `config` handler, so a second config resolution (Vite resolves the config once per environment in a build) never reuses another root's map.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass.

### Step 3: Tests for the cache

In `describe('metadata modules')`:

- A file created after the first load, without an HMR event, is found: boot, `p.load` `meta('app/A')` once, write `src/C.zukan.svelte` with `'<Section title="C"><p>c</p></Section>'`, then `p.load.call({ addWatchFile: vi.fn() }, meta('app/C'))` contains `"title":"C"` (a miss lists again).
- A deleted file is gone after the HMR event: boot, load `meta('app/A')`, delete `src/A.zukan.svelte`, call `p.hotUpdate.call(ctx, { type: 'delete', file: <path>, modules: [], timestamp: 1 })` with a fake `ctx` shaped like the one in `describe('hotUpdate of the catalog list')` (copy its `ctx` object), then loading `meta('app/A')` throws `/no catalog file/`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass, including the two new tests.

### Step 4: Build tests, changeset, checks

The static build names meta chunks from the module ID. Run the build tests to confirm the catalog still contains every ID and section text:

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts` → all pass.

Create `.changeset/opaque-meta-ids.md`:

```md
---
'svelte-zukan': patch
---

fix: the detail page of a catalog file whose name contains `%` loads in dev, and building a large catalog no longer rescans every directory per entry.
```

**Verify**: `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- The encoded specifier is stable under `decodeURI`, has no `%`/`.`, and round-trips.
- File names with a space, `%`, `.css` and Japanese characters load their metadata.
- A non-hex meta ID is rejected with the existing message.
- A file created after the first load is found; a file deleted (with the HMR event) is not served from the cache.
- The build tests still find every ID, section title and `.md` text in the output.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0
- [ ] `pnpm --filter build-tests exec vitest run build.test.ts` exits 0
- [ ] `grep -n "decodeURIComponent(raw)\|META + encodeURIComponent" packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/virtual.ts` prints nothing (the `decodeURIComponent` in `configurePreviewServer` stays)
- [ ] `grep -n "listCatalog(" packages/svelte-zukan/src/lib/vite/index.ts` prints only the line inside `relist`
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The build tests fail because a chunk file name derived from a hex ID is rejected or too long. Report the file name and its length.
- Anything outside `src/lib/vite/` reads the meta module ID format (search: `grep -rn "svelte-zukan/meta" packages/svelte-zukan/src tests/build --include='*.ts' --include='*.svelte'`). Only `virtual.ts`, `index.ts` and the tests should match.
- The `hotUpdate` fake-graph tests fail after Step 2 for a reason other than the id strings.

## Maintenance notes

- Any new place that builds a meta specifier must call `metaId`; `pathOfMeta` is the only decoder.
- The cache is only an optimisation of `load`. The catalog list module still lists from disk every time it loads, so new files show up in the list as before.
- If a future change adds rename handling or watches more file types, check that every path that can make an item stale also clears `items`.
