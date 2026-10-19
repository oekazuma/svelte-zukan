# Plan 012: HMR is tested against a real Vite dev server, not only hand-made fakes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts`
> Plans 004 and 007 change `hotUpdate` (invalidating the file's own modules on create/delete, and metadata modules). Those are expected. STOP if `hotUpdate` no longer sends `{ type: 'custom', event: 'zukan:reload' }`.

## Status

- Priority: P3
- Effort: M
- Risk: LOW
- Depends on: plans/004-hmr-recreated-catalog-file.md, plans/007-split-catalog-metadata.md (the behaviour under test)
- Category: tests
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

AGENTS.md lists HMR as easy to break:

> creating/removing catalog files invalidates the list module; changing a catalog or `.md` file sends the custom event `zukan:reload`, never `full-reload` (that would also reload the app's tabs on the same dev server).

Every HMR test today calls `hotUpdate` with a hand-made `moduleGraph` and `hot.send`. They never check that Vite actually calls the hook for created and deleted files, that `return []` stops Vite's default update, or that no `full-reload` reaches the app's tabs. A Vite minor that changed any of this would pass the suite. This plan adds one test file that runs a real dev server on a temporary app.

## Current state

- `packages/svelte-zukan/src/lib/vite/index.ts`, `hotUpdate`. For a `.md` file, an `update` of a catalog file, or a create/delete of a catalog file in a scanned dir, it invalidates modules, calls `this.environment.hot.send({ type: 'custom', event: 'zukan:reload' })` for the client environment, and returns `[]`.
- The list module is the virtual module `virtual:svelte-zukan/catalog` (resolved id `\0virtual:svelte-zukan/catalog`). Its code contains `import("<absolute path of each catalog file>")`.
- Test conventions (`src/lib/vite/index.test.ts`), copied by the new file:
  ```ts
  // a temporary app: <tmp>/app/src/A.zukan.svelte, <tmp>/outside/B.zukan.svelte
  const makeApp = async () => {
    const tmp = realpathSync(await mkdtemp(path.join(tmpdir(), 'zukan-app-')));
    const root = normalizePath(path.join(tmp, 'app'));
    ...
    await writeFile(path.join(tmp, 'pnpm-workspace.yaml'), '');
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app' }));
    await writeFile(path.join(root, 'src/A.zukan.svelte'), source);
  ```
  `realpathSync` matters on macOS (`/var` → `/private/var`).
  Browser tests use `expect.poll`; there are no fixed sleeps in the suite.
- The library's Vitest config (`packages/svelte-zukan/vite.config.ts`) runs `src/**/*.{test,spec}.{js,ts}` (except `*.svelte.test.*`) in the `server` project, in Node. Its `test.expect.requireAssertions: true` makes a test without assertions fail. The default test timeout is 5 s, so every HMR test needs its own `{ timeout: 15_000 }`.
- `hotUpdate`'s `update` branch (`type === 'update' && isCatalogFile(file)`) has no scanned-dir check, unlike the create/delete branch. A `change` event right after `add` for a file outside the scanned dirs would therefore send `zukan:reload`.

## Commands you will need

| Purpose                   | Command                                                                                                      | Expected on success |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| Install                   | `pnpm install`                                                                                               | exit 0              |
| New test                  | `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/hmr.test.ts`                       | all pass            |
| Same, 5 times (flakiness) | `for i in 1 2 3 4 5; do pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/hmr.test.ts |                     | break; done` | 5 passes |
| All library tests         | `pnpm --filter svelte-zukan exec vitest run`                                                                 | all pass            |
| Lint / typecheck          | `pnpm run format && pnpm run lint && pnpm run package && pnpm run check`                                     | exit 0              |

## Scope

**In scope**: `packages/svelte-zukan/src/lib/vite/hmr.test.ts` (create).

**Out of scope**: any change to `index.ts` or the existing tests. If the real server disagrees with the unit tests, STOP and report. No changeset.

## Git workflow

- Branch: `advisor/012-dev-server-hmr-test`
- One commit, for example `test: check HMR of catalog files on a real dev server`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Start a dev server on a temporary app

Create `src/lib/vite/hmr.test.ts`. Imports: `once` from `node:events`; `mkdtemp` from `node:fs/promises`; `realpathSync`, `rmSync`, `writeFileSync` from `node:fs`; `tmpdir` from `node:os`; `join` from `node:path`; `createServer` and `type ViteDevServer` from `vite`; `afterEach`, `beforeEach`, `expect`, `it`, `vi` from `vitest`; `zukan` from `./index.js`.

- `beforeEach`: make `tmp = realpathSync(await mkdtemp(join(tmpdir(), 'zukan-hmr-')))`, write `pnpm-workspace.yaml` (empty), `app/package.json` (`{ "name": "app" }`) and `app/src/A.zukan.svelte` (`<Section title="A"><p>a</p></Section>`). Start
  ```ts
  server = await createServer({
    root: join(tmp, 'app'),
    configFile: false,
    logLevel: 'silent',
    plugins: [zukan()],
    // no HTTP or WebSocket server: payloads are read from the spy on hot.send
    server: { middlewareMode: true, ws: false }
  });
  ```
  Then wait for the watcher: `await Promise.race([once(server.watcher, 'ready'), new Promise((r) => setTimeout(r, 3000))]);` (`once` from `node:events`). The race bounds the wait in case `ready` already fired.
  Then wait until the watcher is quiet: the files written just before the server started can still be reported as `change` events after `ready`, and such a late event on `A.zukan.svelte` sends a real `zukan:reload` that a test would wrongly count as its own.
  ```ts
  // files written just before the watcher started can still arrive as late `change` events
  const settle = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        server.watcher.off('all', reset);
        resolve();
      };
      let timer = setTimeout(done, 500);
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(done, 500);
      };
      server.watcher.on('all', reset);
    });
  await settle();
  ```
  Spy: `send = vi.spyOn(server.environments.client.hot, 'send');`. In every test, call `send.mockClear()` right before the test's own file operation, so only events caused by that operation are counted.
- `afterEach`: `await server.close()`, then `rmSync(tmp, { recursive: true, force: true })`.
- Helpers:
  - `list = async () => (await server.environments.client.transformRequest('virtual:svelte-zukan/catalog'))!.code;`
  - `reloaded = () => send.mock.calls.some(([p]) => (p as { event?: string })?.event === 'zukan:reload');`
  - `fullReloads = () => send.mock.calls.filter(([p]) => (p as { type?: string })?.type === 'full-reload').length;`

**Verify**: a first test `'lists the catalog files'` that expects `await list()` to contain `A.zukan.svelte` → passes.

### Step 2: Create, update and delete catalog files

Add these tests, each declared as `it('…', { timeout: 15_000 }, async () => { … })`. Each one waits with `await expect.poll(reloaded, { timeout: 10_000 }).toBe(true)`, then asserts `fullReloads()` is `0`:

1. `'a new catalog file is listed after zukan:reload'`: call `await list()` once (so the module is in the graph), write `app/src/B.zukan.svelte`, wait for `zukan:reload`, then `await list()` contains `B.zukan.svelte`.
2. `'editing a catalog file sends zukan:reload'`: `await list()`, load the file once (`await server.environments.client.transformRequest(join(tmp, 'app/src/A.zukan.svelte'))`; without a Svelte plugin this fails to parse as JS, so wrap it in `.catch(() => {})`: only the module graph entry matters), then rewrite `A.zukan.svelte` with different content and wait.
3. `'a deleted catalog file leaves the list'`: `await list()`, `rmSync` `A.zukan.svelte`, wait, then `await list()` does not contain `A.zukan.svelte`.
4. `'a new .md file sends zukan:reload'`: write `app/src/A.zukan.md` (`# A`), wait.
5. `'files outside the scanned dirs are ignored'`: write `app/other.zukan.svelte` (outside `src`), then `await new Promise((r) => setTimeout(r, 1000))` (a negative check needs a bounded wait), and `expect(reloaded()).toBe(false)`.

**Verify**: the new test file → all pass. Then run it 5 times in a row (the loop in the commands table) → 5 passes.

### Step 3: Prove the test catches a regression

Temporarily change `'custom'` / `'zukan:reload'` in `hotUpdate` to `this.environment.hot.send({ type: 'full-reload' })`, rerun → tests 1–4 fail. Restore the line, and check `git diff packages/svelte-zukan/src/lib/vite/index.ts` is empty.

**Verify**: after restoring, the new file passes again.

## Test plan

One new file with 6 tests (Steps 1–2), plus a mutation check (Step 3).

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0, including `hmr.test.ts`
- [ ] The 5-run loop passes
- [ ] `pnpm run lint` and `pnpm run package && pnpm run check` exit 0
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only `packages/svelte-zukan/src/lib/vite/hmr.test.ts` and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- `hotUpdate` is never called on the real server (no `zukan:reload` within 10 s for test 1) even though the file was written. Report, including whether `server.watcher` emits `add` (attach `server.watcher.on('add', console.log)` while debugging).
- Test 5 fails because `zukan:reload` was sent for `app/other.zukan.svelte`. That comes from the `update` branch noted in "Current state" (an `add` followed by a `change`), not from timing. Report it as a finding; do not change `index.ts` in this plan.
- The tests are flaky in the 5-run loop. Report the failing test and timing. Do not raise timeouts above 10 s or add more sleeps.
- `ws: false` makes `server.environments.client.hot` undefined. Report; do not start a real WebSocket server on a fixed port.

## Maintenance notes

- This file is the end-to-end check for the HMR rules in AGENTS.md. When those rules change, update it together with the unit tests in `index.test.ts`.
- If CI on Windows becomes flaky on file-watch timing, the server project also runs there (`test-windows` runs `--project server`). Prefer raising the poll timeout to 10 s over skipping the file.
