# Plan 004: A deleted and re-created catalog file is transformed again in dev

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/index.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: none
- Category: bug
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

In dev, when a catalog file (`*.zukan.svelte`) is deleted and created again, which `git checkout`, `git stash` / `git stash pop` and some editors' safe-write do, the catalog keeps showing the old sections and code until the next normal edit or a server restart. The plugin's `hotUpdate` hook handles `create` / `delete` by invalidating only the catalog list module and returns `[]`, which also turns off Vite's default handling. Vite itself does not invalidate a file's own module on add or unlink: in Vite 8.3.2 (`node_modules/vite/dist/node/chunks/node.js`), `onFileAddUnlink` calls `moduleGraph.onFileDelete(file)`, which only removes import edges, and only `change` calls `moduleGraph.onFileChange(file)`, which invalidates. So the cached transform of the old file survives.

## Current state

- `packages/svelte-zukan/src/lib/vite/index.ts:221-240`:
  ```ts
    hotUpdate({ type, file, modules, timestamp }) {
      const { moduleGraph } = this.environment;
      let targets: Iterable<(typeof modules)[number]>;
      if (isDocFile(file)) {
        // the module graph is keyed by normalized paths; the catalog file may not be in it yet
        targets = moduleGraph.getModulesByFile(normalizePath(catalogFileOf(file))) ?? [];
      } else if (type === 'update' && isCatalogFile(file)) {
        targets = modules;
      } else if (isCatalogFile(file) && scanned().some((dir) => isInside(normalizePath(file), dir))) {
        // created or deleted: the list is rebuilt when the module is loaded again
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = list ? [list] : [];
      } else return;

      for (const mod of targets) moduleGraph.invalidateModule(mod, new Set(), timestamp, true);
      if (this.environment.config.consumer !== 'client') return;
      // not `full-reload`: that would also reload the app's tabs on the same dev server
      this.environment.hot.send({ type: 'custom', event: 'zukan:reload' });
      return [];
    }
  ```
- `packages/svelte-zukan/src/lib/vite/index.test.ts:481-523`, `describe('hotUpdate of the catalog list')`. Its `run` helper always passes `modules: []`:
  ```ts
  const run = (type: string, file: string) => p.hotUpdate.call(ctx, { type, file, modules: [], timestamp: 1 });
  ```
  and the test:
  ```ts
    it.each(['create', 'delete'])('invalidates the list on %s inside a scanned dir', async (type) => {
      const { root, ctx, run, catalogMod } = await setup();
      expect(run(type, `${root}/src/lib/New.zukan.svelte`)).toEqual([]);
      expect(ctx.environment.moduleGraph.invalidateModule.mock.calls[0][0]).toBe(catalogMod);
      ...
  ```
- AGENTS.md says HMR must send the custom event `zukan:reload`, never `full-reload`. That stays unchanged.
- Conventions: tests use hand-made fakes typed loosely (`as any` with an eslint-disable comment), see the top of `index.test.ts`.

## Commands you will need

| Purpose           | Command                                                                                  | Expected on success |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`                                                                           | exit 0              |
| Plugin tests      | `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts` | all pass            |
| All library tests | `pnpm --filter svelte-zukan exec vitest run`                                             | all pass            |
| Typecheck         | `pnpm run package && pnpm run check`                                                     | exit 0              |
| Lint              | `pnpm run format && pnpm run lint`                                                       | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/index.ts` (the `hotUpdate` hook only)
- `packages/svelte-zukan/src/lib/vite/index.test.ts` (`describe('hotUpdate of the catalog list')` only)
- `.changeset/hmr-recreated-catalog-file.md` (create)

**Out of scope**:

- The `.md` branch and the `update` branch of `hotUpdate`.
- A real dev-server HMR test. Plan 012 adds one.

## Git workflow

- Branch: `advisor/004-hmr-recreated-catalog-file`
- One commit, for example `fix: transform a re-created catalog file again in dev`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Write the failing test

In `describe('hotUpdate of the catalog list')`:

1. Let the `run` helper take modules: `const run = (type: string, file: string, modules: unknown[] = []) => p.hotUpdate.call(ctx, { type, file, modules, timestamp: 1 });`
2. Add:
   ```ts
   it.each(['create', 'delete'])('also invalidates the file itself on %s', async (type) => {
     const { root, ctx, run, catalogMod } = await setup();
     const own = { id: `${root}/src/lib/New.zukan.svelte` };
     expect(run(type, `${root}/src/lib/New.zukan.svelte`, [own])).toEqual([]);
     const invalidated = ctx.environment.moduleGraph.invalidateModule.mock.calls.map((c: unknown[]) => c[0]);
     expect(invalidated).toEqual(expect.arrayContaining([own, catalogMod]));
   });
   ```

**Verify**: plugin tests → the 2 new cases fail (only `catalogMod` was invalidated); everything else passes.

### Step 2: Invalidate the file's own modules too

In the create/delete branch of `hotUpdate`, change the targets to include `modules`:

```ts
      } else if (isCatalogFile(file) && scanned().some((dir) => isInside(normalizePath(file), dir))) {
        // created or deleted: the list is rebuilt when the module is loaded again, and Vite does not
        // invalidate the file's own module on add or unlink, so a re-created file would keep its old transform
        const list = moduleGraph.getModuleById('\0' + CATALOG);
        targets = list ? [...modules, list] : modules;
      } else return;
```

**Verify**: plugin tests → all pass, including the 2 new cases and the existing `'invalidates the list on %s inside a scanned dir'` (it still finds `catalogMod` at `calls[0][0]`, because `modules` is empty there).

### Step 3: Changeset

Create `.changeset/hmr-recreated-catalog-file.md`:

```md
---
'svelte-zukan': patch
---

fix: in dev, a catalog file that is deleted and created again (for example by `git checkout`) shows its new sections instead of the old ones.
```

**Verify**: `pnpm run format && pnpm run lint` → exit 0.

## Test plan

2 new unit cases (Step 1). The whole server project still passes.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0, with the 2 new cases
- [ ] `pnpm run package && pnpm run check` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `.changeset/hmr-recreated-catalog-file.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `hotUpdate` code no longer matches the excerpt. For example, plan 007 may already have added invalidation of `virtual:svelte-zukan/meta/` modules there. Then merge this change by hand only if the intent is unambiguous; otherwise report.
- TypeScript rejects `[...modules, list]`. Report the error rather than adding casts beyond `as typeof modules`.

## Maintenance notes

- Plan 012 adds a real dev-server test for create/delete/update. It covers this branch end to end.
- If Vite starts invalidating modules on add/unlink by itself, this line becomes redundant but stays harmless.
