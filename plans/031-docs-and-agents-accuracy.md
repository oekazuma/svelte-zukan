# Plan 031: The static-export guide lists every output rule, and AGENTS.md / CONTRIBUTING.md / the ESLint comment match the code

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- docs/content/guides/static-export.md docs/content/ja/guides/static-export.md AGENTS.md CONTRIBUTING.md eslint.config.js .github/workflows/ci.yml packages/svelte-zukan/src/lib/vite/index.ts`
> Run this plan **last**. Plan 021 changes `AGENTS.md:68` and plan 028 may change `AGENTS.md:101`; those lines are not edited here. Read the live `index.ts` before writing any sentence about it: plans 015, 019, 020, 021 and 024 change it, and every claim below must match the live code, not this plan.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: all other plans in this batch (run last)
- Category: docs
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

- **User docs.** The static-export guide invites users to pick any output directory (`build: { outDir }`) and mentions one rule, a warning. The plugin has three hard build errors the guide never states: the outDir must not be or contain the Vite root, must not overlap the app's `build.outDir` (default `dist`), and must not overlap SvelteKit's `outDir` (`.svelte-kit`). An obvious choice such as `build: { outDir: 'dist/zukan' }` fails the build. Two more silent cases are undocumented: `vite build --ssr` does not write the catalog, and neither does Vite's JS `build()` function (it builds one environment and skips the `buildApp` hooks where the catalog is written; `createBuilder().buildApp()` and the `vite build` CLI do write it).
- **AGENTS.md** is what coding agents read before editing this repository. It has no line on the `vite preview` middleware (path containment check, content-type map, runs before SvelteKit's middleware). It says options are "validated in `options.ts`", but `suffix` and `groups` are validated elsewhere. It says the catalog outDir "must not overlap the Vite root", while the code allows (and defaults to) an outDir inside the root. Its CI summary leaves out two steps and says the Windows job runs all of `tests/build`. An agent that "fixes" code to match these lines would break it.
- **CONTRIBUTING.md:23** says "the build tests use the built package". Only `dev.test.ts`, and CI's `ZUKAN_FROM_DIST=1` rerun, do. Line 40 of the same file states this correctly.
- **`eslint.config.js:37`** says "no rule in use needs type information" for the fixtures and the example. The recommended `eslint-plugin-svelte` rule `svelte/no-unused-props` silently turns off without type information.

## Current state

- `docs/content/guides/static-export.md:14-20`:

  ```md
  The catalog is written to `zukan-dist/`, separately from the app build. You can choose another directory with `build: { outDir: 'docs/zukan' }`. Because it is separate from the app's build output, an adapter's output step does not delete it. Add `/zukan-dist` to `.gitignore`.

  - Output paths are relative, so the catalog works under any subpath (for example, `/docs/zukan/`). No server-side rewrites are needed
  - When `build` is enabled, `vite build` runs in Vite's builder mode (Environment API), and all environments are built in one run
  - `vite preview` serves the exported catalog at `/__zukan/` (under `base` when it is set), so you can check it before you deploy it
  - `vite build --watch` does not write the catalog. It prints a warning and skips it
  - Before writing, only the previous catalog (`_zukan/` and `index.html` in the output directory) is removed. In SvelteKit, adapters often empty `build/`, so a warning is printed if the output directory overlaps with `build/`
  ```

  `docs/content/ja/guides/static-export.md:14-20` is the same list in Japanese; its `--watch` bullet is:

  ```md
  - `vite build --watch` ではカタログを書き出しません。警告を出して飛ばします
  ```

  Bullets have no final period (English) and no final `。` (Japanese).

- The code (`packages/svelte-zukan/src/lib/vite/index.ts`, `config` hook, at `293f5a4` lines 68–85):

  ```ts
  // `config.build.ssr` is the server half of an SSR build (`vite build --ssr`)
  if (command !== 'build' || !resolved.build || config.build?.ssr) return;
  // …
  if (isInside(root, out))
    throw new Error(
      `svelte-zukan: build.outDir of the catalog (${out}) must not be the Vite root (${root}) or contain it`
    );
  for (const [what, dir] of [
    ["the app's build.outDir", dirOf(config.build?.outDir ?? 'dist')],
    ...(kit ? [["SvelteKit's kit.outDir", dirOf(kit.api?.options?.outDir ?? '.svelte-kit')]] : [])
  ])
    if (overlaps(dir))
      throw new Error(`svelte-zukan: build.outDir of the catalog (${out}) must not overlap ${what} (${dir})`);
  ```

  `configurePreviewServer` (at `293f5a4` lines 243–271): installed only when `build` is set; GET/HEAD only; `<base>__zukan` redirects to `<base>__zukan/`; a file is served only if `isInside(file, out)`; its type comes from `CONTENT_TYPES` (lines 19–30), falling back to `application/octet-stream`, which browsers refuse for module scripts. It is installed directly (not in a returned hook), so it runs before SvelteKit's preview middleware.

- Validation lives in `src/lib/vite/options.ts` (`locale`, `wrapper`, `logo`), `src/lib/vite/matchers.ts:2-3` (`suffix`) and `src/lib/vite/discover.ts:6-11,33-34` (reserved group names, missing `groups` directories).
- Vite 8.3.4's `build()` (`node_modules/.pnpm/vite@8.3.4*/node_modules/vite/dist/node/chunks/node.js:34566-34570`):

  ```js
  async function build(inlineConfig = {}) {
    const builder = await createBuilder(inlineConfig, true);
    const environment = Object.values(builder.environments)[0];
    if (!environment) throw new Error('No environment found');
    return builder.build(environment);
  }
  ```

- `AGENTS.md`, the passages to edit (find them by text; line numbers are from `293f5a4`, and Step 3 inserts a line, so later numbers shift):
  - line 50 ends the options list with ``(validated in `options.ts`)``;
  - line 58 is the bullet starting `- Build (`;
  - line 67 contains `Its outDir must not overlap the Vite root, the app's`;
  - line 97 is the bullet starting ``- `ci.yml` runs on every PR:``.
- `.github/workflows/ci.yml`: the `check` job has a step `Check the published files` (`npm pack --dry-run --json` plus a Node check) between `pnpm run package` and `pnpm run check`; the `test` job ends with `Run the build tests with the packaged library` (`pnpm --filter build-tests exec vitest run build.test.ts` with `ZUKAN_FROM_DIST: '1'`); `test-windows` runs `pnpm --filter build-tests exec vitest run build.test.ts` only.
- `CONTRIBUTING.md:23`:
  ```
  pnpm run package                   # svelte-kit sync && svelte-package && publint (the example app, check and the build tests use the built package)
  ```
- `eslint.config.js:36-40` (the comment is line 37):
  ```js
    {
      // the build fixtures and the example have no tsconfig of their own ready at lint time; no rule in use needs type information
      files: ['tests/build/**/*.svelte', 'example/**/*.svelte'],
      languageOptions: { parserOptions: { projectService: false } }
    }
  ```

Rules for docs (from `AGENTS.md`): update both `docs/content/` and `docs/content/ja/`; docs describe the current behaviour only, with no history or issue references.

## Commands you will need

| Purpose    | Command (from the repo root)             | Expected on success |
| ---------- | ---------------------------------------- | ------------------- |
| Install    | `pnpm install`                           | exit 0              |
| Docs build | `pnpm --filter docs build`               | exit 0              |
| Lint       | `pnpm run lint` (fix: `pnpm run format`) | exit 0              |

## Scope

**In scope**:

- `docs/content/guides/static-export.md`, `docs/content/ja/guides/static-export.md`
- `AGENTS.md` (the four passages listed above, plus one inserted bullet)
- `CONTRIBUTING.md` (line 23 only)
- `eslint.config.js` (the comment on line 37 only)

**Out of scope**:

- Code changes of any kind, including turning type information on for the example (that needs a `prepare` script there; a separate decision).
- `docs/content/why.md` (the install-size numbers are measured in plan 029).
- The `server.fs.allow` bullet of `AGENTS.md` (plan 021) and the SHA-pinning bullet (plan 028).

## Git workflow

- Branch: `advisor/031-docs-accuracy`
- Conventional Commits, e.g. `docs: list the catalog output rules`, `docs: bring AGENTS.md in line with the plugin`
- No changeset (docs only).
- Do not push or open a PR unless told to.

## Steps

### Step 1: Re-read the live code

Open the live `packages/svelte-zukan/src/lib/vite/index.ts` and confirm, by reading, each fact you are about to write: the three outDir errors and their wording, the `config.build?.ssr` early return, the preview middleware's behaviour, and whether `setHeaders` exists (plan 020). If any differs from "Current state", write the docs from the live code and mention the difference in your report.

**Verify**: a short list in your notes: fact → line in the live file.

### Step 2: Static-export guide (both locales)

In `docs/content/guides/static-export.md`, add these two bullets right after the `--watch` bullet:

```md
- The output directory must not be Vite's root or contain it, and must not overlap the app's `build.outDir` (`dist` by default) or SvelteKit's `outDir` (`.svelte-kit`). Each of these is a build error
- The catalog is written by `vite build` (and by `createBuilder().buildApp()` from Vite's JavaScript API). `vite build --ssr` and Vite's `build()` function build a single environment and do not write it
```

In `docs/content/ja/guides/static-export.md`, right after the `--watch` bullet:

```md
- 出力先は、Vite の root そのものや root を含むディレクトリにできません。アプリの `build.outDir`（既定は `dist`）や SvelteKit の `outDir`（`.svelte-kit`）と重なってもいけません。どれもビルドエラーになります
- カタログを書き出すのは `vite build`（Vite の JavaScript API なら `createBuilder().buildApp()`）です。`vite build --ssr` と Vite の `build()` 関数は 1 つの環境だけをビルドするので、カタログは書き出しません
```

**Verify**: `pnpm --filter docs build` → exit 0.

### Step 3: AGENTS.md

Edit bottom-up (4, 3, 2, 1) so earlier line numbers stay valid, or match by text.

1. In the options sentence (line 50), replace

   ```md
   (validated in `options.ts`)
   ```

   with

   ```md
   (validated in `options.ts`; `suffix` in `matchers.ts`, group names and `groups` directories in `discover.ts`)
   ```

2. After the Build bullet (line 58), insert this bullet. If plan 020 has landed (`setHeaders` exists in `index.ts`), append the sentence ``It sends `preview.headers` like Vite's own responses.`` to it.

   ```md
   - Preview (`build: true`): `configurePreviewServer` serves `<outDir>` at `<base>__zukan/` under `vite preview`, before SvelteKit's preview middleware (installed directly, not in a returned hook). GET/HEAD only; a resolved path outside the outDir falls through (`isInside`); content types come from `CONTENT_TYPES` in `index.ts`, so add an entry when the catalog build emits a new asset type (octet-stream breaks module scripts).
   ```

3. In the static-output bullet (line 67), replace

   ```md
   Its outDir must not overlap the Vite root, the app's `build.outDir` or SvelteKit's `kit.outDir` (errors)
   ```

   with

   ```md
   Its outDir must not be or contain the Vite root (inside the root is fine, and the default), and must not overlap the app's `build.outDir` or SvelteKit's `kit.outDir` (errors)
   ```

4. In the `ci.yml` bullet (line 97), make three replacements:

   ```md
   `check` (`pnpm run package` then `pnpm run check`)
   ```

   becomes

   ```md
   `check` (`pnpm run package`, a check of the files `npm pack` would publish, then `pnpm run check`)
   ```

   and the `test (…)` parenthesis gets `` , then `build.test.ts` again with `ZUKAN_FROM_DIST=1` `` appended before its closing `)`. Finally,

   ```md
   `test-windows` (the library's `server` tests and `tests/build`,
   ```

   becomes

   ```md
   `test-windows` (the library's `server` tests and `tests/build/build.test.ts` (not `dev.test.ts`, which needs the packaged library and Chromium),
   ```

**Verify**: `pnpm run lint` → exit 0 (Prettier also checks Markdown).

### Step 4: CONTRIBUTING.md and the ESLint comment

1. In `CONTRIBUTING.md:23`, replace `the build tests use the built package` with the text below, keeping the column alignment of the `#` comments:

   ```
   dev.test.ts use the built package
   ```

   so the parenthesis reads `(the example app, check and dev.test.ts use the built package)`.

2. In `eslint.config.js:37`, replace `no rule in use needs type information` with `rules that need type information (such as svelte/no-unused-props) are skipped there`.

**Verify**: `pnpm run lint` → exit 0.

## Test plan

Docs only: the docs build and Prettier are the checks. A reviewer compares each new sentence with the cited code lines.

## Done criteria

- [ ] `grep -c 'must not be Vite' docs/content/guides/static-export.md` and `grep -c 'root を含む' docs/content/ja/guides/static-export.md` each print `1`
- [ ] `grep -n "configurePreviewServer" AGENTS.md` prints the new Preview bullet
- [ ] `grep -n "must not be or contain the Vite root" AGENTS.md` prints one line
- [ ] `grep -n "again with" AGENTS.md` prints the CI line
- [ ] `grep -n "dev.test.ts use the built package" CONTRIBUTING.md` prints one line
- [ ] `grep -n "no rule in use needs type information" eslint.config.js` prints nothing
- [ ] `pnpm --filter docs build` and `pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The live `index.ts` no longer has one of the three outDir errors, or has a new one: write what the code does and report the difference; do not document rules the code does not have.
- `vite build --ssr` now writes the catalog in the live code: drop that half of the second bullet and report it.

## Maintenance notes

- Every new build error or warning in `index.ts` needs a bullet in both static-export pages.
- AGENTS.md's CI line should be updated in the same PR as any change to `ci.yml` job steps.
