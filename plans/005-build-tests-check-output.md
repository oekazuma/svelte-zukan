# Plan 005: The build tests check what the catalog contains, under a subpath and from the published files

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- tests/build .github/workflows/ci.yml AGENTS.md`
> Plan 001 changes `tests/build/vitest.config.ts`, adds `tests/build/dev.test.ts`, and edits the `test-windows` job and AGENTS.md line 14. Those changes are expected. Any other change to these paths is drift: compare with "Current state" and STOP on a mismatch.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: plans/001-dev-prebundle-section-context.md (same files: `tests/build/`, `ci.yml`, AGENTS.md line 14)
- Category: tests
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

`tests/build` is the only suite that runs a real `vite build`, but it checks little of the result:

- It only greps for quoted catalog IDs. IDs come from the list module, so a build where every section or doc is missing still passes.
- AGENTS.md promises that the catalog works under any subpath (its URLs are relative). The fixture written for that, `vite.config.base.ts`, is not referenced anywhere (`git grep vite.config.base` finds nothing).
- AGENTS.md says the fixtures can use the built `dist` with `ZUKAN_FROM_DIST=1`, but `build.test.ts` deletes that variable from the child's environment, so it never takes effect.
- The rule "discovery skips a dependency named `svelte-zukan`" is never exercised end to end, because the fixture app does not declare `svelte-zukan`.
- Nothing checks that the published tarball leaves out tests and the library's own `*.zukan.*` files (AGENTS.md "Published files").

## Current state

- `tests/build/build.test.ts` (62 lines). Key parts:
  ```ts
  const fixtures = import.meta.dirname;
  const vite = join(fixtures, 'node_modules/vite/bin/vite.js');
  // a production build from the package's source: none of vitest's variables, and not the dist
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { NODE_ENV, VITEST, TEST, ZUKAN_FROM_DIST, ...env } = process.env;

  /** `vite build` in a child process: SvelteKit takes `process.cwd()` as its project root */
  const build = (dir: string) => {
    for (const out of ['zukan-dist', 'build', 'dist', '.svelte-kit'])
      rmSync(join(dir, out), { recursive: true, force: true });
    const r = spawnSync(process.execPath, [vite, 'build'], { cwd: dir, env, encoding: 'utf8', timeout: 110_000 });
    expect(r.status, [r.error?.message, r.stderr, r.stdout?.slice(-4000)].filter(Boolean).join('\n')).toBe(0);
  };

  /** the IDs (and group names) missing from the built catalog; the minifier picks the quotes */
  const missing = (dir: string, ids: string[]) => { ... };

  const catalogJs = (dir: string) =>
    globSync('zukan-dist/_zukan/*.js', { cwd: dir }).map((f) => ({ f, code: readFileSync(join(dir, f), 'utf8') }));
  ```
  Test `'kit monorepo build'` builds `monorepo/apps/catalog` and ends with
  ```ts
  const ids = ['@fixture/ui', '@fixture/ui/lib/Card', '@fixture/ui/lib/forms/Button', '@fixture/ui/lib/nav/Button'];
  expect(missing(dir, ids)).toEqual([]);
  ```
  Test `'plain vite build'` builds `vite-svelte`.
- `tests/build/monorepo/apps/catalog/vite.config.ts` exports `config(paths?)`, and `vite.config.base.ts` is:
  ```ts
  import { config } from './vite.config.js';

  // SvelteKit sets Vite's `base` from `paths.base`
  export default config({ base: '/app' });
  ```
- `tests/build/monorepo/apps/catalog/package.json`:
  ```json
  {
    "name": "catalog",
    "private": true,
    "type": "module",
    "dependencies": {
      "@fixture/ui": "workspace:*"
    }
  }
  ```
  The fixture is not a pnpm workspace member; `discover.ts` only reads its dependency names. `setup.mjs` already links `apps/catalog/node_modules/svelte-zukan` to `packages/svelte-zukan`, with the comment on line 8: ``// `svelte-zukan` is linked but not declared in the catalog app's package.json (discovery skips it either way)``.
- If discovery did not skip it, the library's own catalog files (`packages/svelte-zukan/src/lib/components/Badge/Badge.zukan.svelte` and others) would appear under group `svelte-zukan`, for example as ID `svelte-zukan/lib/components/Badge`.
- Fixture contents to assert on: `monorepo/packages/ui/src/lib/Card/Card.zukan.svelte` has sections `Basic` and `Long title`. `Card.zukan.md` is "A card from `@fixture/ui`. The label comes from `#lib/label.js`." (rendered by `marked` into HTML).
- `packages/svelte-zukan/package.json` `files`:
  ```json
    "files": [
      "dist",
      "!dist/**/*.test.*",
      "!dist/**/*.spec.*",
      "!dist/**/*.zukan.svelte",
      "!dist/**/*.zukan.svelte.d.ts",
      "!dist/**/*.zukan.md"
    ],
  ```
- `.github/workflows/ci.yml`: the `check` job runs `pnpm run package` then `pnpm run check`. The `test` job runs `pnpm run package`, the example and docs builds, `Setup Playwright`, then `pnpm run test`. All actions are pinned to SHAs. Do not add or change any `uses:` line.
- `AGENTS.md:14` contains the sentence "The fixtures use the library's **source** unless `ZUKAN_FROM_DIST=1` is set." (plan 001 appends another sentence after it).

## Commands you will need

| Purpose              | Command                                                                     | Expected on success |
| -------------------- | --------------------------------------------------------------------------- | ------------------- |
| Install              | `pnpm install`                                                              | exit 0              |
| Package              | `pnpm run package`                                                          | exit 0              |
| Build tests (source) | `pnpm --filter build-tests exec vitest run build.test.ts`                   | all pass            |
| Build tests (dist)   | `ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts` | all pass            |
| Pack listing         | `cd packages/svelte-zukan && npm pack --dry-run --json --ignore-scripts`    | JSON array printed  |
| Lint                 | `pnpm run format && pnpm run lint`                                          | exit 0              |

## Scope

**In scope**:

- `tests/build/build.test.ts`
- `tests/build/monorepo/apps/catalog/package.json`
- `tests/build/monorepo/setup.mjs` (the comment on line 8 only)
- `.github/workflows/ci.yml` (one new step in `check`, one new step in `test`)
- `AGENTS.md` (line 14 only)

**Out of scope**:

- The plugin source (`packages/svelte-zukan/src/**`). This plan only adds checks. If a check fails because of a real bug, STOP.
- `tests/build/dev.test.ts` (plan 001).
- No changeset: test and CI changes only.

## Git workflow

- Branch: `advisor/005-build-tests-check-output`
- Commits, for example `test: check sections, docs and relative URLs in the built catalog` and `ci: run the build tests with the packaged library and check the published files`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Let `ZUKAN_FROM_DIST` through and allow extra build arguments

In `build.test.ts`:

- Change the destructuring to `const { NODE_ENV, VITEST, TEST, ...env } = process.env;` and the comment above it to `// a production build: none of vitest's variables (ZUKAN_FROM_DIST=1 builds with the packaged library)`.
- Give `build` a second parameter `args: string[] = []` and pass `[vite, 'build', ...args]` to `spawnSync`.

**Verify**: `pnpm run package && ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts` → both tests pass. Then without the variable → both pass.

### Step 2: Assert sections and docs in the Kit build

At the end of `'kit monorepo build'`, add:

```ts
// sections and the rendered .md come from the catalog files themselves, not from the list
const all = js.map(({ code }) => code).join('\n');
for (const text of ['Long title', 'A card from']) expect(all).toContain(text);
```

**Verify**: build tests → pass.

### Step 3: Exercise the `svelte-zukan` skip rule

1. In `monorepo/apps/catalog/package.json`, add `"devDependencies": { "svelte-zukan": "*" }` after `dependencies`.
2. In `setup.mjs` line 8, replace the comment with ``// `svelte-zukan` is declared by the catalog app so that the build test covers discovery skipping it``.
3. In `'kit monorepo build'`, add: `expect(missing(dir, ['svelte-zukan/lib/components/Badge'])).toEqual(['svelte-zukan/lib/components/Badge']);` with the comment `// the library's own catalog files are not the app's`.

**Verify**: build tests → pass. Then temporarily delete the `if (name === 'svelte-zukan') continue;` line in `packages/svelte-zukan/src/lib/vite/discover.ts`, rerun → the new assertion fails. Restore the line, and confirm with `git diff packages/svelte-zukan/src` that nothing is left.

### Step 4: Build under a subpath

Add a test after `'kit monorepo build'`:

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

**Verify**: build tests → 3 tests pass (4 when plan 001's `dev.test.ts` is also run with `pnpm --filter build-tests test`).

### Step 5: Run the build tests on the packaged library in CI

In `.github/workflows/ci.yml`, job `test`, add after the `Run Vitest` step:

```yaml
- name: Run the build tests with the packaged library
  run: pnpm --filter build-tests exec vitest run build.test.ts
  env:
    ZUKAN_FROM_DIST: '1'
```

**Verify**: `git diff .github/workflows/ci.yml` shows only this addition (plus Step 6).

### Step 6: Check the published file list in CI

In job `check`, add after `Run svelte-package`:

```yaml
# tests and the library's own catalog files must not reach consumers
- name: Check the published files
  working-directory: packages/svelte-zukan
  run: |
    npm pack --dry-run --json --ignore-scripts > "$RUNNER_TEMP/pack.json"
    node -e '
      const files = require(process.argv[1])[0].files.map((f) => f.path);
      const bad = files.filter((f) => /\.(test|spec)\.|\.zukan\.(svelte|md)$|\.zukan\.svelte\.d\.ts$/.test(f));
      if (bad.length || !files.includes("dist/vite/index.js")) {
        console.error(bad.length ? bad.join("\n") : "dist/vite/index.js is missing");
        process.exit(1);
      }
    ' "$RUNNER_TEMP/pack.json"
```

Run the same two commands locally from `packages/svelte-zukan` after `pnpm run package` (use any temp path instead of `$RUNNER_TEMP`). `--ignore-scripts` keeps the `prepare` script's output out of the JSON.

**Verify**: locally, exit 0. Then temporarily remove `"!dist/**/*.zukan.md",` from `files`, rerun → it prints `dist/components/Badge/Badge.zukan.md` (and others) and exits 1. Restore the line.

### Step 7: Update AGENTS.md

In `AGENTS.md:14`, replace the sentence "The fixtures use the library's **source** unless `ZUKAN_FROM_DIST=1` is set." (not the sentence plan 001 added after it) with: "The fixtures use the library's **source** unless `ZUKAN_FROM_DIST=1` is set; CI runs `build.test.ts` both ways."

**Verify**: `pnpm run format && pnpm run lint` → exit 0.

## Test plan

- Steps 2–4 add three assertion groups and one test to `build.test.ts`.
- Steps 3 and 6 each include a mutation check (temporarily break the code, see the check fail, restore).
- Final run: `pnpm run package && pnpm --filter build-tests test && ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts` → all pass.

## Done criteria

- [ ] `pnpm --filter build-tests test` exits 0, including `'kit monorepo build under paths.base'`
- [ ] `ZUKAN_FROM_DIST=1 pnpm --filter build-tests exec vitest run build.test.ts` exits 0
- [ ] `git grep -n "vite.config.base" tests/build/build.test.ts` prints a line
- [ ] `.github/workflows/ci.yml` has the steps `Check the published files` and `Run the build tests with the packaged library`; `git diff 30b6d25 -- .github/workflows/ci.yml | grep '^[-+].*uses:'` prints nothing
- [ ] `git diff $(git merge-base main HEAD) -- packages/svelte-zukan` is empty
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `pnpm run lint` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 2 or Step 4 fails on unmodified plugin code. That is a real bug in the build output (missing sections, absolute URLs under a base). Report it with the failing output; do not change the plugin.
- `vite build --config vite.config.base.ts` fails inside SvelteKit (for example a `paths.base` validation error). Report it rather than changing the fixture's base.
- `npm pack --dry-run --json --ignore-scripts` fails locally with `EBADDEVENGINES` (likely when your Node is not exactly `devEngines.runtime.version`). That happens when your Node is not the version in `devEngines.runtime`. Run it with that Node version, or skip the local run and say so in the report. CI uses the matching version.

## Maintenance notes

- If plan 007 (metadata split) lands, Step 2's strings move to separate meta chunks. They are still in `_zukan/*.js`, so the assertion keeps working.
- Adding new published file types (for example `*.zukan.ts`) needs the regex in Step 6 and `files` in `package.json` updated together.
- The extra dist build adds about a minute to the `test` job.
