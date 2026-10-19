# Plan 010: Contributor docs and user docs match the current code and release process

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- CONTRIBUTING.md AGENTS.md docs/content`
> Earlier plans edit some of these files on other lines: 001/005/007/008 change AGENTS.md lines 14, 56, 68 and 112; 002 changes `quickstart.mdx` and `why.md`; 006 changes the "Code view" paragraph of `catalog-files.md`. Those are expected. STOP if a line quoted below has changed.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: run after 001–009 (several of them edit the same files on other lines; Step 7 depends on whether 007 landed)
- Category: docs
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

`CONTRIBUTING.md` still says the package "has not been released yet" and is `"private": true`. In fact 0.1.0 and 0.2.0 are on npm and `package.json` has no `private` field. It also tells contributors to document changes in `packages/svelte-zukan/README.md`, which is now only a pointer to the docs site, and its "same checks CI runs" list leaves out three builds CI runs. The user docs have a few smaller inaccuracies: the options table says groups are "ordered by key" (they keep declaration order); the rule that catalog files must be plain Svelte markup is not documented; and the docs do not warn that `.zukan.md` HTML is published as is. AGENTS.md also names the SvelteKit plugin it detects imprecisely.

## Current state

- `CONTRIBUTING.md`:
  - line 17: `3. Update / Add Documentation (\`packages/svelte-zukan/README.md\`)`
  - lines 19–26:
    ````md
    5. Run the same checks CI runs before opening a pull request (the first time, install Chromium for the browser tests: see [Browser tests](#browser-tests)):

    ```bash
    pnpm run lint      # Prettier + ESLint
    pnpm run package   # svelte-kit sync && svelte-package && publint (the example app and check use the built package)
    pnpm run check     # svelte-kit sync && svelte-check
    pnpm run test      # Vitest: the library's server and browser tests, and the build tests
    ```
    ````
  - line 36: "`tests/build/` builds the fixtures … with the library's source, and checks the written catalog."
  - line 59: "svelte-zukan has not been released yet: `packages/svelte-zukan/package.json` has `"private": true` so that nothing is published. Before the first release, remove `"private": true` and add the first changeset."
- What CI actually runs (`.github/workflows/ci.yml`): `lint` → `pnpm run lint`; `check` → `pnpm run package`, `pnpm run check`; `test` → `pnpm run package`, `pnpm --filter example build`, `pnpm --filter docs build`, Playwright Chromium, `pnpm run test`; `build` → `pnpm --filter svelte-zukan build`. After plan 001, `tests/build/dev.test.ts` needs `pnpm run package` before `pnpm run test`.
- Release process (AGENTS.md "Releases"): add `.changeset/<slug>.md` for user-facing changes (internal-only changes need none). On push to `main`, `release.yml` opens or updates a "Version Packages" PR. Merging it publishes to npm through trusted publishing with provenance. Versions and `CHANGELOG.md` are never edited by hand.
- `docs/content/options.md:22` (in the `groups` row): "Groups are ordered by key." JA `docs/content/ja/options.md:22`: 「並び順はキー順。」 Code: `discover.ts` keeps `Object.entries` order. The same page's note (line 31 EN / 31 JA) already explains that digit-only keys sort numerically "instead of in declaration order".
- `docs/content/guides/catalog-files.md`:
  - line 7: "Subdirectories such as `zukan/` are not used." JA line 7: 「`zukan/` のようなサブディレクトリは使いません。」 Files in any subdirectory are found, so "not used" reads like "ignored". The intended meaning is that no dedicated directory is needed;
  - rules list (lines 39–40 EN, 39–40 JA) has the `<Section>` bullets only. The extractor rejects other markup languages with "catalog files must be plain Svelte markup; preprocessor languages are only supported inside <style>" (`src/lib/vite/extract.ts`, `parseZukan`);
  - "Markdown description" section: "If it exists, it is rendered as HTML at the top of the detail page." JA: 「あれば詳細ページの上部に HTML として表示します。」 The HTML is not sanitized (`marked`, then `{@html}`), which is fine for the repo's own files but worth saying for public catalogs.
- `docs/content/guides/monorepo.md:12`: "The group name is the `name` in the package's `package.json`." JA line 12: 「グループ名はパッケージの `package.json` の `name` です。」 Code (`discover.ts:46,60`) falls back to the directory name when `name` is missing.
- `docs/content/guides/wrapper.md:28` / JA line 28 claim that the catalog UI "does not load the app's CSS either". That is false before plan 007 (the detail page imports the components) and true after it.
- `AGENTS.md:66` says SvelteKit is detected by "a plugin named `vite-plugin-sveltekit*`". The code (`src/lib/vite/kit.ts`) looks for exactly `vite-plugin-sveltekit-setup` and reads `api.options.outDir` from it.

## Commands you will need

| Purpose       | Command                            | Expected on success |
| ------------- | ---------------------------------- | ------------------- |
| Format + lint | `pnpm run format && pnpm run lint` | exit 0              |
| Docs build    | `pnpm --filter docs build`         | exit 0              |

## Scope

**In scope**: `CONTRIBUTING.md`, `AGENTS.md` (line 66 only), `docs/content/options.md`, `docs/content/ja/options.md`, `docs/content/guides/catalog-files.md`, `docs/content/ja/guides/catalog-files.md`, `docs/content/guides/monorepo.md`, `docs/content/ja/guides/monorepo.md`, and, only under Step 7's condition, `docs/content/guides/wrapper.md` and `docs/content/ja/guides/wrapper.md`.

**Out of scope**: code, READMEs, `why.md`, `quickstart.mdx`. No changeset (docs only). Do not add history ("previously …") or issue references. The docs describe the current state only.

## Git workflow

- Branch: `advisor/010-docs-accuracy`
- Commits, for example `docs: bring CONTRIBUTING up to date with the release flow and CI` and `docs: fix small inaccuracies in the guides`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: CONTRIBUTING — documentation location and checks

1. Line 17 → `3. Update / Add Documentation in \`docs/content/\` and its Japanese mirror \`docs/content/ja/\``
2. Replace the code block of step 5 with the CI order (a subset of `ci.yml`: the published-files check and the second build-test run from plan 005, if present, are left to CI). If plan 001's row in `plans/README.md` is not DONE, drop ", and the build tests" from the `pnpm run package` comment:
   ```bash
   pnpm run lint                      # Prettier + ESLint
   pnpm run package                   # svelte-kit sync && svelte-package && publint (the example app, check and the build tests use the built package)
   pnpm run check                     # svelte-kit sync && svelte-check
   pnpm --filter example build        # the example app, built against the packaged library
   pnpm --filter docs build           # the documentation site
   pnpm run test                      # Vitest: the library's server and browser tests, and the build tests
   pnpm --filter svelte-zukan build   # the library's own site and catalog (zukan-dist/)
   ```
3. Insert a new step after step 5 (renumber "Open pull request" to 7): `6. For a user-facing change, add a changeset: write \`.changeset/<short-slug>.md\` with \`'svelte-zukan': patch\` (or \`minor\` / \`major\`) in the front matter and one English sentence. Tests, CI, docs and the example app need none.`
4. Line 36: after "with the library's source, and checks the written catalog." append, only if the `plans/README.md` row of plan 005 is DONE, " Set `ZUKAN_FROM_DIST=1` to build with the packaged library instead.", and only if the row of plan 001 is DONE, " `dev.test.ts` also starts a dev server with the packaged library, so run `pnpm run package` first."

**Verify**: `grep -n "packages/svelte-zukan/README.md" CONTRIBUTING.md` → nothing; `grep -c "pnpm --filter svelte-zukan build   #" CONTRIBUTING.md` → `1`; `grep -n "add a changeset" CONTRIBUTING.md` → one line.

### Step 2: CONTRIBUTING — releases

Replace line 59 with:

> Add a changeset with every user-facing change. On each push to `main`, the release workflow opens or updates a "Version Packages" pull request that bumps the version and writes `CHANGELOG.md`; merging it publishes to npm with provenance (npm trusted publishing, no token in the repository). Do not bump versions or edit `CHANGELOG.md` by hand.

**Verify**: `grep -n "private" CONTRIBUTING.md` → nothing.

### Step 3: Options table — group order

- `docs/content/options.md:22`: "Groups are ordered by key" → "Groups keep the order of the keys".
- `docs/content/ja/options.md:22`: 「並び順はキー順」→「並び順はキーを書いた順」.

**Verify**: `pnpm run format` realigns the tables; `grep -n "ordered by key" docs/content/options.md` → nothing.

### Step 4: Catalog files guide

1. Line 7 EN: "Subdirectories such as `zukan/` are not used." → "No dedicated directory such as `zukan/` is needed." JA: 「`zukan/` のようなサブディレクトリは使いません。」→「`zukan/` のような専用のディレクトリは要りません。」
2. Add a third bullet to the rules list (after the `title` bullet, line 40 in both locales). EN: "- Write the markup and `<script>` in plain Svelte (TypeScript with `lang="ts"` is fine). Preprocessor languages, such as SCSS, work only inside `<style>`". JA: 「- マークアップと `<script>` は素の Svelte で書きます（`lang="ts"` の TypeScript は使えます）。SCSS などのプリプロセッサの言語は `<style>` の中でだけ使えます」. Append to the sentence after the list (line 42 in both locales, the one about build errors): EN "A file that is not plain Svelte markup also causes a build error with the file name." JA 「素の Svelte として読めないファイルも、ファイル名つきのビルドエラーになります。」
3. "Markdown description": append EN "The HTML is inserted as it is, including any raw HTML in the `.md` file, so review `.md` files like code before you publish the catalog." JA 「`.md` 内の生の HTML も含めてそのまま挿入するので、カタログを公開する前に `.md` もコードと同じようにレビューしてください。」

**Verify**: `pnpm --filter docs build` → exit 0; `grep -c "plain Svelte\|素の Svelte" docs/content/guides/catalog-files.md docs/content/ja/guides/catalog-files.md` → at least 1 per file; `grep -c "review \`.md\` files\|レビューしてください" docs/content/guides/catalog-files.md docs/content/ja/guides/catalog-files.md` → 1 per file.

### Step 5: Monorepo guide — group name fallback

- EN line 12: "The group name is the `name` in the package's `package.json`." → "The group name is the `name` in the package's `package.json`, or the directory name when there is none."
- JA line 12: 「グループ名はパッケージの `package.json` の `name` です。」→「グループ名はパッケージの `package.json` の `name` です。`name` がなければディレクトリ名です。」

**Verify**: `pnpm run lint` → exit 0.

### Step 6: AGENTS.md — Kit detection

In the bullet that starts "SvelteKit runtime APIs are not replaced or mocked" (line 66 at the time of writing; find it by that text), replace "(a plugin named `vite-plugin-sveltekit*` in the awaited, flattened `plugins`)" with "(the plugin named `vite-plugin-sveltekit-setup` in the awaited, flattened `plugins`; its `api.options` gives Kit's `outDir`)".

**Verify**: `grep -n "vite-plugin-sveltekit-setup" AGENTS.md` → one line.

### Step 7: Wrapper guide, only if plan 007 did not land

Read the row for plan 007 in `plans/README.md`.

- If it is DONE, skip this step: the claim is true.
- Otherwise, replace the last sentence of `docs/content/guides/wrapper.md:28` with "The catalog UI is a separate HTML page and does not load the app's entry CSS. CSS that a component imports itself, and `:global` rules in it, also reach the detail page, because the detail page imports the catalog files." JA: 「カタログの UI は独立した HTML で、アプリのエントリーの CSS は読み込みません。ただし、コンポーネント自身が import する CSS や `:global` のルールは、詳細ページがカタログファイルを import するため、詳細ページにも効きます。」

**Verify**: `pnpm --filter docs build` → exit 0.

## Test plan

Docs only: `pnpm run lint` and `pnpm --filter docs build`. Read each changed EN paragraph next to its JA counterpart and check they say the same thing.

## Done criteria

- [ ] `pnpm run lint` exits 0
- [ ] `pnpm --filter docs build` exits 0
- [ ] `grep -n "not been released\|private\": true" CONTRIBUTING.md` prints nothing
- [ ] `grep -n "ordered by key" docs/content/options.md` prints nothing
- [ ] Every changed file under `docs/content/` has its counterpart under `docs/content/ja/` changed too (`git diff --name-only $(git merge-base main HEAD)..HEAD -- docs/content` shows pairs)
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- A sentence quoted here is no longer in the file (another plan rewrote it). Report rather than guessing where the new text goes.
- The docs build fails on a link or front-matter error you did not introduce.

## Maintenance notes

- Every feature plan in `plans/` that changes user-facing behaviour also edits the docs. Keep EN and JA in step.
- The CONTRIBUTING check list mirrors `ci.yml`. Update both together when CI changes.
