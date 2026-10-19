# Plan 001: Previews show only the requested section when Vite prebundles `svelte-zukan` in dev

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/context.ts tests/build .github/workflows/ci.yml AGENTS.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P1
- Effort: M
- Risk: LOW
- Depends on: none
- Category: bug + tests
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

`<Section title="…">` (used in users' catalog files) renders its children only when its title matches the section in the preview URL. It reads that title from a Svelte context whose key is a `Symbol()` created in `src/lib/context.ts`. The catalog app sets the context from its own copy of `context.ts`. When `svelte-zukan` is installed from npm, `@sveltejs/vite-plugin-svelte` prebundles Svelte libraries in dev by default (`prebundleSvelteLibraries` defaults to `!isBuild`). The user's `import { Section } from 'svelte-zukan'` then goes through `node_modules/.vite/deps/svelte-zukan.js`, which contains its own copy of `context.ts`, while the catalog app loads `dist/context.js` directly via `/@fs/`. That gives two different `Symbol()` keys. `getContext` returns `undefined`, and every preview iframe shows every section.

Nobody has noticed because every setup in this repo bypasses the optimizer. Vite does not prebundle linked packages: `example/` uses `workspace:*`, the `tests/build` fixtures use directory junctions, and the library's own dev server aliases `svelte-zukan` to source. This plan adds a dev-server test that forces the prebundled path, and changes the key to `Symbol.for(...)` so that two copies of the module share it.

## Current state

- `packages/svelte-zukan/src/lib/context.ts` — the whole file:

  ```ts
  import { getContext, setContext } from 'svelte';

  export const PREVIEW_SECTION_KEY = Symbol('zukan-preview-section');

  export function setPreviewSection(title: string): void {
    setContext(PREVIEW_SECTION_KEY, title);
  }

  export function getPreviewSection(): string | undefined {
    return getContext<string | undefined>(PREVIEW_SECTION_KEY);
  }
  ```

- `packages/svelte-zukan/src/lib/Section.svelte` reads it with `getPreviewSection()` and renders when `section === undefined || section === title`.
- `packages/svelte-zukan/src/lib/app/Preview.svelte:3,21` imports `../context.js` and calls `setPreviewSection(section)`. The plugin loads the app from its own file path (`appFile('App.svelte')` at `src/lib/vite/index.ts:171`, defined in `src/lib/vite/options.ts:25`), not through the bare `svelte-zukan` specifier.
- `packages/svelte-zukan/src/lib/Section.svelte.test.ts` imports `PREVIEW_SECTION_KEY` and passes it in a `context` Map. It keeps working with `Symbol.for`.
- `tests/build/` (package `build-tests`) — Vitest tests that run real builds of fixtures:
  - `tests/build/vitest.config.ts`:
    ```ts
    export default defineConfig({
      test: {
        expect: { requireAssertions: true },
        environment: 'node',
        include: ['*.test.ts']
      }
    });
    ```
  - `tests/build/build.test.ts` — the existing pattern. It runs `monorepo/setup.mjs` in `beforeAll`, which links `svelte-zukan` into each fixture's `node_modules` as a directory junction to `packages/svelte-zukan`. The setup removes and recreates the links, so two test files running it at the same time can race.
  - `tests/build/package.json` devDependencies: `@sveltejs/adapter-static`, `@sveltejs/kit`, `@sveltejs/vite-plugin-svelte`, `@types/node`, `svelte`, `vite`, `vitest`, all `"catalog:"`. There is no `playwright` yet. The workspace catalog in `pnpm-workspace.yaml` already has `playwright: ^1.64.0`.
  - `tests/build/vite-svelte/vite.config.ts` — plain Vite + Svelte fixture. With `ZUKAN_FROM_DIST` set it imports `svelte-zukan/vite` (the built `dist`) and sets no alias; otherwise it uses the source:
    ```ts
    const { zukan } = process.env.ZUKAN_FROM_DIST
      ? await import('svelte-zukan/vite')
      : await import('../../../packages/svelte-zukan/src/lib/vite/index.js');
    ...
    plugins: [svelte(), zukan({ build: true })]
    ```
  - `tests/build/vite-svelte/src/lib/Counter/Counter.zukan.svelte` — catalog ID `vite-svelte/lib/Counter`, one section:
    ```svelte
    <script lang="ts">
      import { Section } from 'svelte-zukan';
      import Counter from './Counter.svelte';
    </script>

    <Section title="Basic">
      <Counter />
    </Section>
    ```
    `Counter.svelte` renders `<button>count: {count}</button>`.
- `.github/workflows/ci.yml`:
  - the `test` job runs `pnpm run package`, then builds the example and the docs, then `Setup Playwright` (installs Chromium), then `pnpm run test`. The new test therefore has `dist/` and Chromium available.
  - the `test-windows` job runs `pnpm --filter build-tests test` without packaging and without Playwright:
    ```yaml
    - name: Run Vitest (build tests)
      run: pnpm --filter build-tests test
    ```
- `AGENTS.md:14` describes `tests/build/` ("Vitest tests that run `vite build` in a child process on two fixtures …").
- Conventions: Prettier 120 columns, single quotes, no trailing commas. Comments only for a non-obvious WHY. Error messages and tests are in English.

## Commands you will need

| Purpose                                    | Command                                                       | Expected on success                                  |
| ------------------------------------------ | ------------------------------------------------------------- | ---------------------------------------------------- |
| Install                                    | `pnpm install`                                                | exit 0                                               |
| Build the package (needed by the new test) | `pnpm run package`                                            | exit 0, `packages/svelte-zukan/dist/index.js` exists |
| Install Chromium (once)                    | `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0                                               |
| New test only                              | `pnpm --filter build-tests exec vitest run dev.test.ts`       | 1 test passes                                        |
| Build tests                                | `pnpm --filter build-tests test`                              | all pass                                             |
| Library tests                              | `pnpm --filter svelte-zukan exec vitest run`                  | all pass                                             |
| Lint                                       | `pnpm run lint`                                               | exit 0 (run `pnpm run format` first)                 |
| Typecheck                                  | `pnpm run check`                                              | exit 0                                               |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/context.ts`
- `tests/build/dev.test.ts` (create)
- `tests/build/vitest.config.ts`
- `tests/build/package.json` (add `playwright`), `pnpm-lock.yaml` (updated by `pnpm install` only)
- `tests/build/vite-svelte/src/lib/Counter/Counter.zukan.svelte` (add one section)
- `.github/workflows/ci.yml` (the `test-windows` build-tests step only)
- `AGENTS.md` (the `tests/build/` bullet, line 14)
- `.changeset/section-context-prebundle.md` (create)

**Out of scope**:

- Adding `optimizeDeps.exclude` or any other `optimizeDeps` change to the plugin (`src/lib/vite/index.ts`). `Symbol.for` fixes the bug without changing how users' dependencies are bundled.
- `Section.svelte`, `Preview.svelte`: their logic is correct.
- The `tests/build/monorepo` fixture and `build.test.ts`.

## Git workflow

- Branch: `advisor/001-dev-prebundle-section-context`
- Conventional Commits, as in `git log` (for example `ci: run CI on the Version Packages pull request`). Suggested commits: `test: check previews when svelte-zukan is prebundled in dev`, then `fix: share the preview section context between copies of svelte-zukan`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Add a second section to the vite-svelte fixture

Append to `tests/build/vite-svelte/src/lib/Counter/Counter.zukan.svelte`:

```svelte
<Section title="Second">
  <p>second section</p>
</Section>
```

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts` → both tests pass. They only check IDs, so the extra section changes nothing.

### Step 2: Run the build test files one at a time

Both test files will run `monorepo/setup.mjs`, which deletes and recreates symlinks. Add `fileParallelism: false` to `test` in `tests/build/vitest.config.ts`:

```ts
    // both files relink the fixtures with monorepo/setup.mjs
    fileParallelism: false,
```

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts` → pass.

### Step 3: Add `playwright` to the build tests

Add `"playwright": "catalog:"` to `devDependencies` in `tests/build/package.json`, keeping alphabetical order. Then run `pnpm install`.

**Verify**: `pnpm install` exits 0, and `git diff --stat` shows, besides the two files from Steps 1–2, only `tests/build/package.json` and `pnpm-lock.yaml`.

### Step 4: Write the failing dev-server test

Create `tests/build/dev.test.ts`. It must:

1. In `beforeAll` (timeout 60 s):
   - throw `new Error('run \`pnpm run package\` first: this test uses the built package')`if`packages/svelte-zukan/dist/index.js`does not exist (resolve it from`import.meta.dirname`, `../../packages/svelte-zukan/dist/index.js`);
   - run `monorepo/setup.mjs` exactly as `build.test.ts` does (`execFileSync(process.execPath, [join(fixtures, 'monorepo/setup.mjs')])`);
   - set `process.env.ZUKAN_FROM_DIST = '1'` so the fixture config loads the built package;
   - start a dev server for `tests/build/vite-svelte` with Vite's JS API, forcing the prebundled path that npm users get:
     ```ts
     server = await createServer({
       root: dir,
       configFile: join(dir, 'vite.config.ts'),
       logLevel: 'error',
       server: { port: 0 },
       // linked packages are not prebundled by default; an npm install is. `force`: the dist changes
       // without the lockfile changing, and a cached prebundle would hide the change
       optimizeDeps: { include: ['svelte-zukan'], force: true }
     });
     await server.listen();
     ```
   - launch Chromium: `browser = await chromium.launch()` (`import { chromium } from 'playwright'`).
2. In `afterAll`: close the browser and the server if they exist, and `delete process.env.ZUKAN_FROM_DIST`.
3. One test (timeout 60 s), named `'a preview of the prebundled package renders only its section'`:
   - `const url = server.resolvedUrls!.local[0];` (ends with `/`)
   - open `${url}__zukan/#/preview/vite-svelte/lib/Counter?section=Basic` in a new page;
   - `await expect.poll(() => page.locator('button', { hasText: 'count:' }).count(), { timeout: 30_000 }).toBe(1);`
   - `expect(await page.getByText('second section').count()).toBe(0);`

Follow the style of `tests/build/build.test.ts`: `const fixtures = import.meta.dirname;`, `join` from `node:path`.

**Verify**:

1. `pnpm run package` → exit 0.
2. `pnpm --filter build-tests exec vitest run dev.test.ts` → the test **fails**: either the `'second section'` count is 1, or the poll fails. This failure is the bug.

### Step 5: Share the context key between module copies

In `packages/svelte-zukan/src/lib/context.ts`, replace the key with:

```ts
// a global symbol: in dev, Vite may prebundle `svelte-zukan` for the user's catalog files
// while the catalog app imports this file directly, so this module can exist twice
export const PREVIEW_SECTION_KEY = Symbol.for('svelte-zukan:preview-section');
```

**Verify**:

1. `pnpm run package` → exit 0 (the test reads `dist/`).
2. `pnpm --filter build-tests exec vitest run dev.test.ts` → passes.
3. `pnpm --filter svelte-zukan exec vitest run --project client src/lib/Section.svelte.test.ts` → 3 tests pass.

### Step 6: Keep the Windows job to the build test

The Windows job neither packages the library nor installs Chromium. In `.github/workflows/ci.yml`, job `test-windows`, change:

```yaml
- name: Run Vitest (build tests)
  run: pnpm --filter build-tests test
```

to

```yaml
# dev.test.ts needs the packaged library and Chromium, which this job does not set up
- name: Run Vitest (build tests)
  run: pnpm --filter build-tests exec vitest run build.test.ts
```

Do not change anything else in the file. Every `uses:` line stays pinned to its SHA.

**Verify**: `git diff .github/workflows/ci.yml` shows only these lines changed.

### Step 7: Document the new test and add a changeset

1. In `AGENTS.md` line 14 (the `tests/build/` bullet), append: `` `dev.test.ts` starts a dev server on `vite-svelte/` with the built package, forced through Vite's dependency prebundling as an npm install is, and checks a preview in Chromium; it needs `pnpm run package` first. ``
2. Create `.changeset/section-context-prebundle.md`:

   ```md
   ---
   'svelte-zukan': patch
   ---

   fix: show only the requested section in each preview when Vite prebundles `svelte-zukan` in dev (the default for an npm install).
   ```

**Verify**: `pnpm run format && pnpm run lint` → exit 0.

## Test plan

- New: `tests/build/dev.test.ts`, one test. It fails before Step 5 and passes after it.
- Existing: `Section.svelte.test.ts` still passes, since it imports the key itself.
- Full run: `pnpm run package && pnpm --filter build-tests test && pnpm --filter svelte-zukan exec vitest run` → all pass.

## Done criteria

- [ ] `pnpm run package` exits 0
- [ ] `pnpm --filter build-tests test` exits 0 and runs `dev.test.ts` and `build.test.ts`
- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0
- [ ] `pnpm run check` and `pnpm run lint` exit 0
- [ ] `grep -n "Symbol.for('svelte-zukan:preview-section')" packages/svelte-zukan/src/lib/context.ts` prints one line
- [ ] `.changeset/section-context-prebundle.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- In Step 4, the test **passes** before the fix. The simulation does not reproduce the bug; do not apply Step 5 blindly. Report it, together with the output of `ls tests/build/vite-svelte/node_modules/.vite/deps` (it should contain `svelte-zukan.js`).
- `server.resolvedUrls` is null, or the port is `0` in the URL. Report it instead of hard-coding a port.
- Chromium fails to launch, even after `pnpm --filter svelte-zukan exec playwright install chromium`.
- The test passes after Step 5 only with extra changes outside the in-scope files.

## Maintenance notes

- Any future module-level shared state between `Section` (imported by users through `svelte-zukan`) and the catalog app has the same two-copies problem. Use `Symbol.for` or keep the state on the app side.
- `dev.test.ts` is the only test that exercises the published `dist/` in dev. Plan 012 (dev-server HMR test) reuses its `createServer` pattern.
- Reviewers: check that the Windows step still runs `build.test.ts`, and that `fileParallelism: false` stays (both files relink fixtures).
