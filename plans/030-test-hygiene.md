# Plan 030: The plugin tests clean up their temp directories, pure helpers have their own test files, and two small UI gaps are covered

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/index.test.ts packages/svelte-zukan/src/lib/app/App.svelte.test.ts packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts`
> Plans 015–027 add tests to these files; that is expected. This plan moves and wraps existing code, so work from the live file, not from the line numbers below. Run it **after** every other plan that edits `index.test.ts`.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: run after plans 015–027 (they all add tests to the same files)
- Category: tests / dx
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

- `packages/svelte-zukan/src/lib/vite/index.test.ts` creates a temp directory in `beforeAll` and one more per `makeApp()` call (38 calls at planning time). It never removes any of them. On the planning machine `os.tmpdir()` held 2,228 `zukan-*` directories from one day of runs. The other test files that use temp dirs (`hmr.test.ts`, `discover.test.ts`) remove theirs.
- The same 855-line file also holds the unit tests of three small pure modules that have no test file of their own: `createMatchers` (`matchers.ts`), `generateCatalogModule` / `generateEntryModule` (`virtual.ts`), and `detectSvelteKit` (`kit.ts`). `discover.ts`, `extract.ts` and `html.ts` already have colocated `*.test.ts` files. Moving these blocks puts each test next to its module.
- Two UI branches have no test at all: the sidebar logo image (`<img alt={title}>`, only rendered when `logo` is set; every App test passes `logo: null`), and `PreviewFrame`'s multi-preview test removes its extra DOM targets only on success (not in `finally`), so one failed assertion leaves DOM behind for the next tests.

## Current state

- `index.test.ts` (at `293f5a4`):
  ```ts
  let dir: string;
  // …
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'zukan-'));
    zukanFile = path.join(dir, 'Foo.zukan.svelte');
    docFile = path.join(dir, 'Foo.zukan.md');
    await writeFile(zukanFile, source);
    await writeFile(docFile, '# Foo');
  });
  // …
  // a temporary app: <tmp>/app/src/A.zukan.svelte, <tmp>/outside/B.zukan.svelte
  const makeApp = async () => {
    const tmp = realpathSync(await mkdtemp(path.join(tmpdir(), 'zukan-app-')));
    const root = normalizePath(path.join(tmp, 'app'));
    // …writes pnpm-workspace.yaml, app/package.json, app/src/A.zukan.svelte, outside/B.zukan.svelte, Wrapper.svelte, logo.png
    return { tmp: normalizePath(tmp), root, outside };
  };
  ```
  Each `makeApp()` needs its **own** directory with its own `pnpm-workspace.yaml`, because some tests assert `searchForWorkspaceRoot(root)` equals `tmp`.
- Describe blocks to move (find them by name in the live file):
  - `describe('createMatchers', …)` → `src/lib/vite/matchers.test.ts` (it also calls `zukan({ suffix })` once to check the plugin rejects a bad suffix; import `zukan` from `./index.js` in the new file so the test count stays the same).
  - `describe('generateCatalogModule', …)` and `describe('generateEntryModule', …)` → `src/lib/vite/virtual.test.ts`. After plan 019 there may also be `metaId` / `pathOfMeta` tests inside `generateCatalogModule`; move them along.
  - `describe('detectSvelteKit', …)` → `src/lib/vite/kit.test.ts`.
  - **Not** moved: `resolveOptions` and `extendFsAllow` (they use `makeApp` and `boot`, which belong to the plugin tests).
- Exemplar for a small colocated test file: `src/lib/vite/html.test.ts` (24 lines; `import { describe, expect, it } from 'vitest';` then one `describe`).
- The `server` Vitest project includes `src/**/*.{test,spec}.{js,ts}` except `*.svelte.test.ts`, so new `*.test.ts` files run automatically (`packages/svelte-zukan/vite.config.ts`).
- `src/lib/app/Sidebar.svelte:41-47`:
  ```svelte
  <a class="logo" href="#/">
    {#if logo}
      <img src={logo} alt={title} />
    {:else}
      {title}
    {/if}
  </a>
  ```
- `src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts`, test `the background switch applies to every preview on the page`: creates two `div` targets on `document.body` and removes them on its last line (`for (const target of targets) target.remove();`). The test `shows no width before the stage is measured` does the same with one `hidden` div.

## Commands you will need

| Purpose            | Command (from the repo root)                                                        | Expected on success                                   |
| ------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Install            | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0                                                |
| Node tests         | `pnpm --filter svelte-zukan exec vitest run --project server`                       | all pass                                              |
| Browser tests      | `pnpm --filter svelte-zukan exec vitest run --project client`                       | all pass                                              |
| Count tests        | the summary line `Tests  N passed` of each command                                  | same N before and after the moves (plus the new ones) |
| Leftover temp dirs | `ls "$(node -p 'require("os").tmpdir()')" \| grep -c '^zukan-'`                     | unchanged after a test run                            |
| Lint               | `pnpm run lint` (fix with `pnpm run format`)                                        | exit 0                                                |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/index.test.ts`
- `packages/svelte-zukan/src/lib/vite/matchers.test.ts`, `virtual.test.ts`, `kit.test.ts` (create)
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts`

**Out of scope**:

- Any non-test source file.
- Rewriting tests; moves must be verbatim apart from imports.
- `hmr.test.ts`, `discover.test.ts`, `extract.test.ts`.

## Git workflow

- Branch: `advisor/030-test-hygiene`
- Conventional Commits, e.g. `test: remove the plugin tests' temp directories`, `test: move the helper tests next to their modules`
- No changeset (tests only).
- Do not push or open a PR unless told to.

## Steps

### Step 1: Record the baseline

Run both test projects and write down the `Tests  N passed` numbers. Count the leftover dirs: `ls "$(node -p 'require("os").tmpdir()')" | grep -c '^zukan-'`, run the server project once more, and count again (it grows by about 39).

**Verify**: you have two test counts and the growth number.

### Step 2: One temp root, removed after the file

In `index.test.ts`:

1. Add `let tmpRoot: string;` and in `beforeAll` create it first: `tmpRoot = realpathSync(await mkdtemp(path.join(tmpdir(), 'zukan-')));`. Put the `Foo.zukan.svelte` / `Foo.zukan.md` fixture in `tmpRoot` (set `dir = tmpRoot`, or a subdirectory of it).
2. Make `makeApp` create its directory inside: `const tmp = await mkdtemp(path.join(tmpRoot, 'app-'));` (no second `realpathSync` needed, since `tmpRoot` is already real).
3. Add `afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));` (import `afterAll` from `vitest` and `rmSync` from `node:fs`).

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → same count as the baseline, all pass; the leftover-dir count does not grow after another run.

### Step 3: Move the pure helper tests

Create `matchers.test.ts`, `virtual.test.ts` and `kit.test.ts` next to their modules and move the describe blocks listed in "Current state" verbatim, with the imports they need. Remove now-unused imports from `index.test.ts` (ESLint will flag them). Split import lines rather than moving them whole: for example `ENTRY` from `./virtual.js` is still used by the `build` tests that stay in `index.test.ts`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → the same total count as after Step 2, all pass; `pnpm run lint` → exit 0.

### Step 4: Cover the logo, and make DOM cleanup unconditional

1. In `App.svelte.test.ts`, add:
   ```ts
   it('shows the logo image with the title as its alt text', async () => {
     const { props } = setup('');
     props.logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E';
     props.title = 'My UI';
     const screen = await render(App, { props });
     await expect.element(screen.getByRole('img', { name: 'My UI' })).toBeInTheDocument();
   });
   ```
   `setup` infers `logo: null`, so this assignment is a type error until you widen it in `setup` the way `locale` is widened there: `logo: null as string | null`. Vitest does not type-check, but `pnpm run check` (CI's `check` job) does.
2. In `PreviewFrame.svelte.test.ts`, wrap the bodies of `the background switch applies to every preview on the page` and `shows no width before the stage is measured` in `try { … } finally { …remove() }` so the targets are removed even when an assertion fails.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → baseline count + 1, all pass.

### Step 5: Final checks

**Verify**: both test projects pass; `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0; `git status` shows only in-scope files.

## Test plan

- No behaviour change: the server test count after Step 3 equals the count after Step 2.
- One new client test (logo).
- The temp-dir count stays flat across runs.

## Done criteria

- [ ] Both test projects exit 0; the server count is unchanged by the moves; the client count grew by 1
- [ ] `grep -n "describe('createMatchers'\|describe('generateCatalogModule'\|describe('generateEntryModule'\|describe('detectSvelteKit'" packages/svelte-zukan/src/lib/vite/index.test.ts` prints nothing
- [ ] `ls packages/svelte-zukan/src/lib/vite/{matchers,virtual,kit}.test.ts` lists three files
- [ ] Running the server project twice does not increase `ls "$(node -p 'require("os").tmpdir()')" | grep -c '^zukan-'`
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- A test that uses `searchForWorkspaceRoot` fails after Step 2: the nested layout changed which workspace root is found. Report it rather than changing the assertion.
- The test count changes after Step 3: something was lost or duplicated in the move.
- A moved block depends on `makeApp`, `boot` or `plugin` in a way that forces copying those helpers: leave that block in `index.test.ts` and say so.

## Maintenance notes

- New plugin tests should use `makeApp()`; it now cleans up after itself through `tmpRoot`.
- Pure helpers get their tests in a file next to them; `index.test.ts` is for the plugin hooks.
