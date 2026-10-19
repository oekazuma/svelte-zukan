# Plan 022: The build tests open the built SvelteKit catalog in a browser, check it has no local paths, and use the documented plugin order

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- tests/build/`
> Plan 015 is expected to have changed `tests/build/build.test.ts` (an `unloadedCss` helper and a `bundleStrategy inline` test) and `tests/build/monorepo/apps/catalog/vite.config*.ts` (`config()` takes `{ paths, output }`). Those changes are fine; anything else in `tests/build/` is a STOP condition.

## Status

- Priority: P2
- Effort: M
- Risk: LOW
- Depends on: plans/015-catalog-css-code-split.md (same files)
- Category: tests
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

`tests/build/` runs real `vite build`s of two fixtures and checks the written static catalog (`zukan-dist/`). For the SvelteKit fixture those checks are string searches over the output (IDs, leftover `__SVELTEKIT_*__` identifiers, relative URLs). Nothing loads that catalog in a browser. The docs promise exact runtime behaviour for SvelteKit APIs inside the catalog (`docs/content/guides/sveltekit.md`: `page.url.pathname` is `""`, and "the static export behaves the same way"). If a SvelteKit update makes its client runtime throw in the catalog, or a chunk URL resolves wrongly under `paths.base`, every current check still passes. The fixture `PageInfo` was written to render `page.url.pathname`, but no test reads it.

Two smaller gaps in the same files:

- The code keeps absolute local paths out of the static catalog on purpose (see `virtual.ts` and the relative `searched` dirs in `index.ts`). No test checks the output for them, and a published catalog would leak usernames and directory layouts.
- The plain-Vite fixture lists `[svelte(), zukan({ build: true })]`, the reverse of the order the README and quickstart tell users to write. The documented order is never built.

## Current state

- `tests/build/build.test.ts` — Vitest, `environment: 'node'`, `fileParallelism: false` (`tests/build/vitest.config.ts`). Helpers:
  ```ts
  const fixtures = import.meta.dirname;
  /** `vite build` in a child process: SvelteKit takes `process.cwd()` as its project root */
  const build = (dir: string, args: string[] = []) => {
    /* removes zukan-dist, build, dist, .svelte-kit; spawns vite build */
  };
  const catalogJs = (dir: string) =>
    globSync('zukan-dist/_zukan/*.js', { cwd: dir }).map((f) => ({ f, code: readFileSync(join(dir, f), 'utf8') }));
  ```
  The `kit monorepo build under paths.base` test:
  ```ts
  test('kit monorepo build under paths.base', { timeout: 120_000 }, () => {
    const dir = join(fixtures, 'monorepo/apps/catalog');
    build(dir, ['--config', 'vite.config.base.ts']);
    const html = readFileSync(join(dir, 'zukan-dist/index.html'), 'utf8');
    // relative, so the catalog works wherever it is deployed
    expect(html).toContain('src="./_zukan/');
    const all = [html, ...catalogJs(dir).map(({ code }) => code)].join('\n');
    expect(all).not.toContain('/app/_zukan');
  });
  ```
  The `plain vite build` test already starts a real preview server with `preview({ root: dir, configFile: join(dir, 'vite.config.ts'), logLevel: 'error', preview: { port: 0 } })` and fetches `${url}__zukan/` — the pattern for Step 2.
- `tests/build/dev.test.ts` — the pattern for Playwright: `import { chromium, type Browser } from 'playwright';`, `browser = await chromium.launch();`, `page.goto(...)`, `expect.poll(() => page.locator(...).count(), { timeout: 30_000 })`.
- Fixture `tests/build/monorepo/packages/ui/src/lib/PageInfo/PageInfo.zukan.svelte` has one section, `Runtime API`, rendering `PageInfo.svelte`:
  ```svelte
  <dl>
    <dt>page.url.pathname</dt>
    <dd>{JSON.stringify(page.url.pathname)}</dd>
  </dl>
  ```
  Its catalog ID is `@fixture/ui/lib/PageInfo`. `Card.zukan.svelte` has sections `Basic` and `Long title`, and `Card.zukan.md` contains `A card from`. The Card ID is `@fixture/ui/lib/Card`.
- `tests/build/monorepo/apps/catalog/vite.config.base.ts` builds with Kit `paths.base: '/app'`, which also sets Vite's `base` to `/app/`. The plugin's preview server serves the catalog at `<base>__zukan/`, so `/app/__zukan/`.
- `tests/build/vite-svelte/vite.config.ts:21`: `plugins: [svelte(), zukan({ build: true })]`.
- CI (`.github/workflows/ci.yml`): the Linux `test` job installs Chromium and runs `pnpm run test` (all of `tests/build/*.test.ts`), then `build.test.ts` again with `ZUKAN_FROM_DIST=1`. The Windows job runs `pnpm --filter build-tests exec vitest run build.test.ts` **without** Chromium. So a browser check in `build.test.ts` must skip when Chromium is not installed.

## Commands you will need

| Purpose               | Command (from the repo root)                                                                    | Expected on success |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| Install               | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium`             | exit 0              |
| Build tests (slow)    | `pnpm --filter build-tests exec vitest run build.test.ts`                                       | all pass            |
| Build tests from dist | `pnpm run package && ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts` | all pass            |
| All build tests       | `pnpm run package && pnpm --filter build-tests test`                                            | all pass            |
| Lint                  | `pnpm run lint` (fix with `pnpm run format`)                                                    | exit 0              |

## Scope

**In scope**:

- `tests/build/build.test.ts`
- `tests/build/vite-svelte/vite.config.ts`

**Out of scope**:

- The library source. If a check fails because of a real bug, STOP and report; do not fix the library here.
- `tests/build/dev.test.ts` and `.github/workflows/ci.yml`.
- The fixtures' components.

## Git workflow

- Branch: `advisor/022-build-tests-open-catalog`
- Conventional Commits, e.g. `test: open the built SvelteKit catalog in Chromium`
- No changeset (tests only).
- Do not push or open a PR unless told to.

## Steps

### Step 1: Use the documented plugin order in the plain-Vite fixture

Change `tests/build/vite-svelte/vite.config.ts:21` to `plugins: [zukan({ build: true }), svelte()]`.

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts -t "plain vite build"` → passes. Then `pnpm run package && pnpm --filter build-tests exec vitest run dev.test.ts` → passes (the dev test uses the same fixture).

### Step 2: Open the `paths.base` catalog in Chromium

In `build.test.ts`:

1. Add imports: `import { chromium } from 'playwright';` (already a devDependency of `build-tests`).
2. Add `const hasChromium = existsSync(chromium.executablePath());` with a comment: the Windows CI job runs this file without a browser.
3. Extend the existing `kit monorepo build under paths.base` test in place (keep its current assertions and its name, and raise its timeout to `180_000`: the build alone may take up to 110 s). After the build assertions, add a block that runs only `if (hasChromium)`:
   - start `preview({ root: dir, configFile: join(dir, 'vite.config.base.ts'), logLevel: 'error', preview: { port: 0 } })`;
   - launch Chromium, open a page, and collect errors: `const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));`;
   - open `${origin}/app/__zukan/#/preview/@fixture/ui/lib/PageInfo?section=Runtime%20API`, then poll until the `dd` text is `""`:
     ```ts
     await expect.poll(() => page.locator('dd').textContent(), { timeout: 30_000 }).toBe('""');
     ```
   - open `${origin}/app/__zukan/#/@fixture/ui/lib/Card` and poll until both `h2` headings `Basic` and `Long title` and the text `A card from` are visible;
   - `expect(errors).toEqual([])`;
   - close the browser and the server in `finally`.
     `origin` is `new URL(server.resolvedUrls!.local[0]).origin`, so the path is written out once with `/app/`.

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts -t "paths.base"` → passes, and the run time shows the browser part ran (not skipped). Then temporarily break the expectation (`toBe('"x"')`), run again, see it fail within ~30 s, and restore it.

### Step 3: No absolute paths in the output

Add a helper and call it at the end of `kit monorepo build`, `kit monorepo build under paths.base` and `plain vite build`:

```ts
/** text files of the catalog that contain a local absolute path */
const withLocalPaths = (dir: string) =>
  globSync('zukan-dist/**/*.{html,js,css,json}', { cwd: dir }).filter((f) => {
    const text = readFileSync(join(dir, f), 'utf8');
    return [fixtures, normalizePath(fixtures), homedir(), normalizePath(homedir())].some((p) => text.includes(p));
  });
```

(`homedir` from `node:os`; `normalizePath` from `vite`, so Windows paths are checked in both slash styles.) Assert `expect(withLocalPaths(dir)).toEqual([])`.

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts` → all pass. If this check fails, that is a real leak: STOP and report the file and the matching path (see STOP conditions).

### Step 4: Run everything both ways

**Verify**:

- `pnpm --filter build-tests exec vitest run build.test.ts` → all pass.
- `pnpm run package && ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts` → all pass.
- `pnpm --filter build-tests test` → all pass (both files).
- `pnpm run lint` → exit 0.

## Test plan

- Browser: the preview of `PageInfo` under `paths.base` renders `""` for `page.url.pathname` (the runtime starts, the documented value holds, the chunk URLs resolve under `/app/`).
- Browser: the detail page of `Card` shows both section headings and the rendered `.md`.
- Output scan: no file of `zukan-dist/` contains the fixtures' absolute path or the home directory, for both Kit builds and the plain build.
- The plain-Vite fixture builds and serves with the documented plugin order.

## Done criteria

- [ ] `pnpm --filter build-tests exec vitest run build.test.ts` exits 0, and the browser check is not skipped on a machine with Chromium
- [ ] The same command with `ZUKAN_FROM_DIST=1` (after `pnpm run package`) exits 0
- [ ] `grep -n "zukan({ build: true }), svelte()" tests/build/vite-svelte/vite.config.ts` prints one line
- [ ] `pnpm run lint` exits 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `PageInfo` preview shows anything other than `""`, or the page logs an uncaught error: this is a library or docs bug. Report the browser console output (`page.on('console')` / `page.on('pageerror')`) and do not change the expectation.
- `withLocalPaths` finds a match: report the file and the surrounding 80 characters, but do not quote the home directory itself in the report. Do not weaken the check.
- The plain-Vite build or dev test fails only with the documented plugin order: report it. The docs would be wrong.
- `vite preview` with the Kit config does not serve `/app/__zukan/` (404): report the URL that does work.

## Maintenance notes

- The browser check covers what string searches cannot: that the catalog actually starts. Keep its timeouts generous; the first Chromium start in CI is slow.
- When SvelteKit changes its catalog-side defaults on purpose, update `docs/content/guides/sveltekit.md` (both locales) and this expectation together.
- `withLocalPaths` will also catch sourcemaps with absolute `sources` if someone enables them for the catalog environment.
