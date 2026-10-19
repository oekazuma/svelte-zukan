# Plan 023: The real-dev-server HMR tests check fresh metadata, delete-then-recreate, and directories outside the root

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/hmr.test.ts packages/svelte-zukan/src/lib/vite/virtual.ts packages/svelte-zukan/src/lib/vite/index.ts`
> Plan 019 is expected to have added `metaId` / `pathOfMeta` to `virtual.ts` and changed `load` / `hotUpdate` in `index.ts`. `hmr.test.ts` should be unchanged; a change there is a STOP condition.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: plans/019-opaque-meta-ids-and-lookup-cache.md (uses `metaId`)
- Category: tests
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

The catalog's detail page reads, for each entry, a virtual module `virtual:svelte-zukan/meta/<id>` holding its sections and its rendered `.md`. That module has no file of its own, so Vite never invalidates it. The plugin's `hotUpdate` hook does it, by scanning the module graph for meta modules on every catalog or `.md` change. On a real dev server, that path has only ever run with zero meta modules loaded. `hmr.test.ts` checks that the `zukan:reload` event is sent, and never loads a meta module. Delete-then-recreate (what `git checkout` and safe-write editors do) and directories outside the Vite root are tested only against hand-made fakes in `index.test.ts`. If a Vite update changes invalidation, the detail page can keep showing old sections, and CI stays green.

## Current state

- `packages/svelte-zukan/src/lib/vite/hmr.test.ts` (105 lines) — Vitest, node environment, part of the `server` project. `beforeEach` (lines 14–47):
  - creates `tmp` with `realpathSync(await mkdtemp(join(tmpdir(), 'zukan-hmr-')))`, writes `pnpm-workspace.yaml`, `app/package.json` (`{"name":"app"}`) and `app/src/A.zukan.svelte` (`<Section title="A"><p>a</p></Section>`);
  - `server = await createServer({ root: join(tmp, 'app'), configFile: false, logLevel: 'silent', plugins: [zukan()], server: { middlewareMode: true, ws: false } })`;
  - waits for the watcher's `ready` (bounded by 3 s), then a 500 ms quiet period (`settle`);
  - `send = vi.spyOn(server.environments.client.hot, 'send')`.
    `afterEach` closes the server and removes `tmp`.
    Helpers:
  ```ts
  const list = async () => (await server.environments.client.transformRequest('virtual:svelte-zukan/catalog'))!.code;
  const reloaded = () => send.mock.calls.some(([p]: unknown[]) => (p as { event?: string })?.event === 'zukan:reload');
  const fullReloads = () =>
    send.mock.calls.filter(([p]: unknown[]) => (p as { type?: string })?.type === 'full-reload').length;
  const waitForReload = () => expect.poll(reloaded, { timeout: 10_000 }).toBe(true);
  ```
  Each test calls `send.mockClear()` right before its file action, then `await waitForReload()`.
- The group name without `groups` is the package name, so the ID of `app/src/A.zukan.svelte` is `app/A`.
- After plan 019, `packages/svelte-zukan/src/lib/vite/virtual.ts` exports `metaId(path)`, which returns the full specifier `virtual:svelte-zukan/meta/<hex>`. Run `grep -n "export const metaId" packages/svelte-zukan/src/lib/vite/virtual.ts` to confirm.
- The meta module's code is `export default {"sections":[{"title":…,"code":…}],"doc":…};` (`index.ts` `load`), so `transformRequest(metaId('app/A'))!.code` contains `"title":"A"`.
- Without a Svelte plugin, the catalog file itself does not parse as JS (the existing test notes this). Check the meta module and the list only, never the catalog file's own transform.

## Commands you will need

| Purpose          | Command (from the repo root)                                                | Expected on success |
| ---------------- | --------------------------------------------------------------------------- | ------------------- |
| Install          | `pnpm install`                                                              | exit 0              |
| This file        | `cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/hmr.test.ts` | all pass            |
| Flake check      | the same command 5 times in a row                                           | 5/5 pass            |
| All server tests | `pnpm --filter svelte-zukan exec vitest run --project server`               | all pass            |
| Lint             | `pnpm run lint` (fix with `pnpm run format`)                                | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/hmr.test.ts`

**Out of scope**:

- Library source. If a new test shows stale metadata, STOP and report; that is a bug to plan separately.
- `index.test.ts` (its fake-based tests stay as unit tests).

## Git workflow

- Branch: `advisor/023-hmr-tests-metadata`
- Conventional Commits, e.g. `test: check fresh metadata after edits on a real dev server`
- No changeset (tests only).
- Do not push or open a PR unless told to.

## Steps

### Step 1: Make the server setup reusable

Move the body of `beforeEach` after the file writes into `async function start(options: Parameters<typeof zukan>[0] = {})`, which assigns `server` and `send`, and call `await start()` from `beforeEach`. Keep the `ready` race, `settle` and the comment lines as they are. A test that needs other options calls `await server.close()` and then `await start({ … })`; `afterEach` still closes the last server.

Add a helper:

```ts
const meta = async (id: string) => (await server.environments.client.transformRequest(metaId(id)))!.code;
```

(`import { metaId } from './virtual.js';`.)

**Verify**: `cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/hmr.test.ts` → the 6 existing tests pass.

### Step 2: Add the new cases

Each test follows the existing shape: prepare, `send.mockClear()`, act, `await waitForReload()`, assert. Use `{ timeout: 15_000 }` like the others.

1. `editing a section title updates the metadata`: `expect(await meta('app/A')).toContain('"title":"A"')`; rewrite `A.zukan.svelte` with `title="A2"`; wait; `expect(await meta('app/A')).toContain('"title":"A2"')`.
2. `editing an .md updates the metadata`: write `app/src/A.zukan.md` = `# One` **before** `start()` runs (write it in the test, then `await server.close(); await start();`, so it is not a create event), `expect(await meta('app/A')).toContain('<h1>One</h1>')`; rewrite it to `# Two`; wait; expect `<h1>Two</h1>`.
3. `a deleted and re-created file has its new content`: load `meta('app/A')`; `rmSync` the file; wait for the reload; `send.mockClear()`; write it again with `title="B"`; wait; expect `meta('app/A')` to contain `"title":"B"` and `list()` to contain `A.zukan.svelte`.
4. `a group outside the root is watched`: create `join(tmp, 'outside')` with `O.zukan.svelte`; `await server.close(); await start({ groups: { app: 'src', out: '../outside' } })`; `expect(await list()).toContain('O.zukan.svelte')`; `send.mockClear()`; write `join(tmp, 'outside/P.zukan.svelte')`; wait; `expect(await list()).toContain('P.zukan.svelte')`; `expect(fullReloads()).toBe(0)`.

**Verify**: `cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/hmr.test.ts` → 10 tests pass.

### Step 3: Prove each new test can fail, then check for flakiness

For test 1, temporarily change the expected title to `"A3"` and confirm it fails, then restore it. Then run the file 5 times:

**Verify**: `cd packages/svelte-zukan && for i in 1 2 3 4 5; do pnpm exec vitest run src/lib/vite/hmr.test.ts || break; done` → 5 passing runs. Then `pnpm --filter svelte-zukan exec vitest run --project server` → all pass; `pnpm run lint` → exit 0.

## Test plan

- Fresh metadata after editing a section title and after editing an existing `.md`.
- Delete-then-recreate yields the new content.
- A `groups` directory outside the Vite root is listed and watched, and only `zukan:reload` is sent.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0 with 4 new tests in `hmr.test.ts`
- [ ] 5 consecutive runs of `hmr.test.ts` pass
- [ ] `pnpm run lint` exits 0
- [ ] `git status` shows only `hmr.test.ts` changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- Test 1, 2 or 3 sees the old content after the reload: a real staleness bug. Report which case. Do not change library code.
- Test 4 never receives a reload: the watcher does not cover the outside directory. Report it.
- Any test fails in 1 of the 5 runs: report which and how (flaky), instead of adding sleeps.
- `metaId` does not exist in `virtual.ts` (plan 019 not landed): STOP.

## Maintenance notes

- If the meta ID format changes again, only the `meta` helper changes.
- These tests share one temp directory layout with the existing ones; keep new fixtures inside `tmp` so `afterEach` removes them.
