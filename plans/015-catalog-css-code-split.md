# Plan 015: The static catalog loads its CSS under every SvelteKit bundle strategy, and leaves no `version.json` behind

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/index.test.ts tests/build/build.test.ts tests/build/monorepo/apps/catalog/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW
- Depends on: none
- Category: bug
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

`svelte-zukan` is a Vite plugin. With `zukan({ build: true })`, `vite build` also builds a separate Vite environment named `zukan` and writes a static component catalog to `zukan-dist/`. That environment inherits the app's top-level `build` options. SvelteKit 3 sets `build.cssCodeSplit: !inline` at the top level, where `inline` means `kit.output.bundleStrategy === 'inline'`. With `cssCodeSplit: false`, Vite merges all CSS into one file, and only Vite's HTML transform writes the `<link>` that loads it. The catalog writes its own `index.html` without that transform. The result: under `bundleStrategy: 'inline'` (or a plain-Vite app that sets `build.cssCodeSplit: false`), the catalog and every preview render unstyled, with no error. The audit traced this through the sources but did not build it, so Step 1 reproduces it first.

A smaller issue in the same area: after building, the plugin deletes the `version.json` that SvelteKit writes into every client environment. It looks for that file under a hardcoded `_app/`, but SvelteKit writes it to `<kit.appDir>/version.json`. A custom `appDir` leaves a stray file in the published catalog.

## Current state

- `packages/svelte-zukan/src/lib/vite/index.ts` — the plugin.
  - Lines 70–72 detect SvelteKit (the `vite-plugin-sveltekit-setup` plugin; its `api.options` is the resolved Kit config, with `outDir`, `appDir`, `output`, … at the top level, since Kit 3 has no `kit` key):
    ```ts
    // set here, not in configResolved: a define added there does not reach the build
    const kit = await detectSvelteKit(config.plugins ?? []);
    const out = resolved.build;
    ```
  - Lines 131–137:
    ```ts
    configEnvironment(name, config) {
      if (name !== 'zukan' || !config.build) return;
      // the environment starts from the app's top-level `build`; mutated, since a returned value would be merged into it
      // `emptyOutDir: false` also because Kit sets it for the whole build; buildApp removes only the catalog's own files
      Object.assign(config.build, { ssr: false, lib: false, emptyOutDir: false });
      config.build.rolldownOptions = { ...config.build.rolldownOptions, input: { zukan: ENTRY } };
    },
    ```
  - Lines 172–176 (end of `buildApp`):
    ```ts
    writeFileSync(join(resolved.build, 'index.html'), html);
    // SvelteKit's plugins also write _app/version.json here
    const kitDir = join(resolved.build, '_app');
    rmSync(join(kitDir, 'version.json'), { force: true });
    if (existsSync(kitDir) && readdirSync(kitDir).length === 0) rmSync(kitDir, { recursive: true });
    ```
  - Module-level state lives in closure variables at the top of `zukan()` (lines 43–49: `let root = ''`, `let appBuilder = false`, `let warning: string | null = null`). Add new state the same way.
- SvelteKit 3.0.1 sources (read-only, for reference): find them with `ls -d node_modules/.pnpm/@sveltejs+kit@3.0.1_*/node_modules/@sveltejs/kit`.
  - `src/exports/vite/build/index.js:217`: `const inline = kit.output.bundleStrategy === 'inline';`, and `:239`: `cssCodeSplit: !inline,` inside the top-level `build` of the config that Kit returns.
  - `src/exports/vite/build/index.js:430-435`: ``this.emitFile({ type: 'asset', fileName: `${kit.appDir}/version.json`, … })`` for every client-consumer environment.
  - `src/exports/vite/index.js:286-290`: `name: 'vite-plugin-sveltekit-setup', api: { options: svelte_config }`.
  - `src/core/config/options.js:71`: `appDir` defaults to `'_app'`; `:166`: `bundleStrategy: list(['split', 'single', 'inline'])`.
- Vite 8.3.4 (`node_modules/.pnpm/vite@8.3.4*/node_modules/vite/dist/node/chunks/node.js`): `:30162` emits one merged CSS asset when `!cssCodeSplit`; `:32025` adds the `<link>` for it only in the HTML transform.
- `packages/svelte-zukan/src/lib/vite/index.test.ts:670-691` checks the exact result of `configEnvironment`:
  ```ts
  p.configEnvironment('zukan', env);
  expect(env.build).toEqual({
    ssr: false,
    lib: false,
    emptyOutDir: false,
    rolldownOptions: { input: { zukan: ENTRY } }
  });
  ```
  `index.test.ts:743-771` are the `version.json` tests (`writes index.html with a relative script`, `removes only version.json from _app when other files are there`). `kitPlugins(options)` at `:586-588` builds a fake Kit setup plugin whose `api.options` is `options`.
- `tests/build/monorepo/apps/catalog/vite.config.ts` — the SvelteKit fixture. Its `config(paths?)` export is reused by `vite.config.base.ts` (`export default config({ base: '/app' });`). The fixture's `Card.svelte` (`tests/build/monorepo/packages/ui/src/lib/Card/Card.svelte`) has a `<style>` block, so its catalog build emits CSS.
  ```ts
  export const config = (paths?: { base: '' | `/${string}` }) =>
    defineConfig({
      resolve: { alias: /* … */ },
      plugins: [zukan({ build: true }), sveltekit({ adapter: adapter(), paths })]
    });
  ```
- `tests/build/build.test.ts` — `build(dir, args)` runs `vite build` in a child process; `catalogJs(dir)` reads `zukan-dist/_zukan/*.js`. The `kit monorepo build under paths.base` test (`:68-76`) is the pattern for a config variant: `build(dir, ['--config', 'vite.config.base.ts'])`.

Conventions: comments state only the non-obvious why (see the existing comments above); Prettier 120 columns, single quotes, no trailing commas; tests use `it`/`expect` from Vitest.

## Commands you will need

| Purpose                      | Command (from the repo root)                                  | Expected on success |
| ---------------------------- | ------------------------------------------------------------- | ------------------- |
| Install                      | `pnpm install`                                                | exit 0              |
| Plugin unit tests            | `pnpm --filter svelte-zukan exec vitest run --project server` | all pass            |
| Build tests (slow, ~1–2 min) | `pnpm --filter build-tests exec vitest run build.test.ts`     | all pass            |
| Type check                   | `pnpm run package && pnpm run check`                          | exit 0              |
| Lint                         | `pnpm run lint` (fix with `pnpm run format`)                  | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/index.ts`
- `packages/svelte-zukan/src/lib/vite/index.test.ts`
- `tests/build/monorepo/apps/catalog/vite.config.ts`
- `tests/build/monorepo/apps/catalog/vite.config.base.ts`
- `tests/build/monorepo/apps/catalog/vite.config.inline.ts` (create)
- `tests/build/build.test.ts`
- `.changeset/catalog-css-code-split.md` (create)

**Out of scope**:

- Any other inherited build option (sourcemaps, minify, target). Only `cssCodeSplit` has a traced failure.
- `kit.ts` (`detectSvelteKit`) — its return value already carries `api.options`.
- The docs: this is a fix with no new user-visible rule.

## Git workflow

- Branch: `advisor/015-catalog-css-code-split`
- Conventional Commits, e.g. `fix: load the catalog's CSS when the app disables CSS code splitting`, `test: …`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Reproduce with a SvelteKit `bundleStrategy: 'inline'` build

1. Change `config` in `tests/build/monorepo/apps/catalog/vite.config.ts` to take Kit options instead of only `paths`:
   ```ts
   export const config = (
     kit: { paths?: { base: '' | `/${string}` }; output?: { bundleStrategy: 'split' | 'single' | 'inline' } } = {}
   ) =>
     defineConfig({
       // …unchanged resolve…
       plugins: [zukan({ build: true }), sveltekit({ adapter: adapter(), ...kit })]
     });
   ```
2. Update `vite.config.base.ts` to `export default config({ paths: { base: '/app' } });` (keep its comment).
3. Create `vite.config.inline.ts` next to it:
   ```ts
   import { config } from './vite.config.js';

   // Kit sets the top-level build.cssCodeSplit to false for this strategy, and the catalog environment inherits it
   export default config({ output: { bundleStrategy: 'inline' } });
   ```
4. In `tests/build/build.test.ts`, add `basename` to the `node:path` import (it imports only `join` today; `basename` also handles Windows separators), then add a helper and a test after `kit monorepo build under paths.base`:
   ```ts
   /** CSS files of the catalog that neither index.html nor any catalog JS file names */
   const unloadedCss = (dir: string) => {
     const all = [
       readFileSync(join(dir, 'zukan-dist/index.html'), 'utf8'),
       ...catalogJs(dir).map(({ code }) => code)
     ].join('\n');
     return globSync('zukan-dist/_zukan/*.css', { cwd: dir }).filter((f) => !all.includes(basename(f)));
   };

   test('kit monorepo build with bundleStrategy inline', { timeout: 120_000 }, () => {
     const dir = join(fixtures, 'monorepo/apps/catalog');
     build(dir, ['--config', 'vite.config.inline.ts']);
     expect(globSync('zukan-dist/_zukan/*.css', { cwd: dir }).length).toBeGreaterThan(0);
     expect(unloadedCss(dir)).toEqual([]);
   });
   ```
   Also add `expect(unloadedCss(dir)).toEqual([]);` at the end of the existing `kit monorepo build` test (default strategy; it must already pass).

**Verify**: `pnpm --filter build-tests exec vitest run build.test.ts -t "inline"` → the new test **fails**, and the failure lists at least one `zukan-dist/_zukan/*.css` file. Then `pnpm --filter build-tests exec vitest run build.test.ts -t "kit monorepo build$"` → passes.

### Step 2: Force CSS code splitting in the catalog environment

In `configEnvironment` (`index.ts:135`), add `cssCodeSplit: true` to the `Object.assign`, and extend the comment above it with why, for example:

```ts
// `cssCodeSplit`: index.html is written without Vite's HTML transform, which is the only thing that links merged CSS
Object.assign(config.build, { ssr: false, lib: false, emptyOutDir: false, cssCodeSplit: true });
```

Update the `toEqual` in `index.test.ts:682-687` to include `cssCodeSplit: true`, and add `cssCodeSplit: false` to the `inherited()` build object in that test so the override is visible.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass. `pnpm --filter build-tests exec vitest run build.test.ts` → all pass, including the inline test.

### Step 3: Remove `version.json` from Kit's `appDir`

1. Add a closure variable next to `appBuilder` (set it to `null` at the very start of the `config` handler, before the early `return`, so a serve or SSR config never keeps an old value): `let kitAppDir: string | null = null;` with a one-line comment (“where SvelteKit writes version.json into every client environment”).
2. In the `config` handler, after `const kit = await detectSvelteKit(...)`, set `kitAppDir = kit ? (kit.api?.options as { appDir?: string } | undefined)?.appDir ?? '_app' : null;`. If the `KitSetup` type in `kit.ts` rejects the property access, widen the cast locally here; do not edit `kit.ts`.
3. In `buildApp`, replace the hardcoded `'_app'` block with one that runs only when `kitAppDir` is set, using `join(resolved.build, kitAppDir)`. Keep the "remove only version.json, then the directory if it is empty" behaviour.
4. Tests in `index.test.ts`:
   - The two existing `version.json` tests build without Kit (`bootBuild(root, { build: true })`). Pass `{ plugins: kitPlugins() }` as the third argument so they keep testing the `_app` default.
   - Add a test: with `kitPlugins({ appDir: 'kit-app' })`, a `zukan-dist/kit-app/version.json` is removed and the empty `kit-app/` too.
   - Add a test: without Kit, an existing `zukan-dist/_app/version.json` is left alone.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass. `pnpm --filter build-tests exec vitest run build.test.ts -t "kit monorepo build$"` → passes (it checks `zukan-dist/_app` does not exist).

### Step 4: Changeset, type check, lint

Create `.changeset/catalog-css-code-split.md`:

```md
---
'svelte-zukan': patch
---

fix: load the static catalog's CSS when the app disables CSS code splitting (for example SvelteKit's `bundleStrategy: 'inline'`), and remove SvelteKit's `version.json` from a custom `appDir`.
```

**Verify**: `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- Build test `kit monorepo build with bundleStrategy inline`: every catalog CSS file is referenced (fails before Step 2).
- The same CSS assertion on the default Kit build (guards against a regression in the normal case).
- Unit: `configEnvironment` output includes `cssCodeSplit: true` even when the inherited value is `false`.
- Unit: `version.json` removal under the default `_app`, under a custom `appDir`, and not at all without Kit.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0
- [ ] `pnpm --filter build-tests exec vitest run build.test.ts` exits 0, with the new inline test
- [ ] `grep -n "cssCodeSplit: true" packages/svelte-zukan/src/lib/vite/index.ts` prints one line
- [ ] `grep -n "'_app'" packages/svelte-zukan/src/lib/vite/index.ts` prints only the default fallback
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1's inline test **passes** before the fix: the bug does not reproduce. Report what CSS files exist and where they are referenced; do not apply Step 2.
- The inline build fails for a reason other than the assertion (for example a Kit error about the strategy). Report the error.
- Before Step 2, the default `kit monorepo build` already has unloaded CSS (`unloadedCss` is non-empty): report the files; the bug is wider than this plan.
- After Step 2 the inline test still fails: some other inherited option (for example Kit forcing a single chunk) is involved. Report the built file list (`ls tests/build/monorepo/apps/catalog/zukan-dist/_zukan`).
- `kit.api.options.appDir` is not a string in the real plugin (check by logging once in a build, then remove the log).

## Maintenance notes

- Any further option inherited from the app build that the catalog cannot tolerate belongs in the same `Object.assign` in `configEnvironment`, with a test in the same `keeps the app build settings out of the zukan environment` case.
- The `unloadedCss` assertion is generic: if a future change emits CSS that nothing loads, it fails in the default build too.
- A reviewer should check that `kitAppDir` is reset on each `config` call (the hook runs once per build, but the variable must not leak a Kit value into a later non-Kit config in tests).
