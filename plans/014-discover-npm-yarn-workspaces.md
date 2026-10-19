# Plan 014: Automatic discovery also finds workspace packages linked at the workspace root (npm, yarn, bun)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/vite/discover.ts packages/svelte-zukan/src/lib/vite/discover.test.ts docs/content/guides/monorepo.md docs/content/ja/guides/monorepo.md`
> Plan 010 changes line 12 of both `monorepo.md` files (the group-name fallback sentence). That is expected. STOP on any other difference.

## Status

- Priority: P3
- Effort: M
- Risk: MED
- Depends on: plans/010-docs-accuracy.md (same docs page)
- Category: direction (feature)
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

Without `groups`, the plugin finds the workspace packages the app depends on through links in the app's own `node_modules/<dependency>`. That is where pnpm puts them. npm, yarn (with the `node-modules` linker) and bun put workspace links in the **workspace root's** `node_modules`, so those users get only the app's own catalog and have to write `groups` by hand. The docs say so (`monorepo.md`: "With npm or yarn workspaces, the links are created in the workspace root's `node_modules`, so they are not found. Use `groups` instead"). The "nothing to configure" promise in `why.md` holds only for pnpm. Falling back to the workspace root's `node_modules` when the app has no link of its own extends zero-config discovery to the other package managers.

Risk: projects that already rely on the current behaviour (npm/yarn/bun, no `groups`) will see new groups. Catalog files in those packages that were never parsed before may now raise build errors. That is why this is a `minor` changeset with a note.

## Current state

- `packages/svelte-zukan/src/lib/vite/discover.ts:45-61`:
  ```ts
  const pkg = readPackage(root);
  const found: { name: string; dir: string }[] = [{ name: pkg.name ?? basename(root), dir: root }];
  // several names may link to one package, or back to the app itself
  const scanned = new Set([realpathSync(root)]);
  const deps = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
  for (const dep of new Set(deps)) {
    const link = join(root, 'node_modules', dep);
    if (!existsSync(link)) continue;
    const real = realpathSync(link);
    // installed packages live under node_modules; only workspace links resolve outside of it
    if (real.split(/[/\\]/).includes('node_modules') || scanned.has(real)) continue;
    const { name } = readPackage(real);
    // a workspace link to this library itself: its own catalog files are not the app's
    if (name === 'svelte-zukan') continue;
    scanned.add(real);
    found.push({ name: name ?? basename(real), dir: real });
  }
  ```
- Vite exports `searchForWorkspaceRoot(current)` (already imported in `options.ts`). It walks up from `current` to the nearest directory with `pnpm-workspace.yaml`, `lerna.json`, or a `package.json` with a `workspaces` field, and returns the package root itself when there is none.
- Tests: `packages/svelte-zukan/src/lib/vite/discover.test.ts`. Helpers: `write(rel, content)`, `pkg(dir, json)`, `p(rel)` (normalized absolute path), `names(groups)`, `paths(root)`. Each test runs in a fresh `tmp` (realpath'd). Exemplar:
  ```ts
  it('workspace dependency', () => {
    pkg('app', { name: 'app', dependencies: { '@acme/ui': 'workspace:*' } });
    pkg('ui', { name: '@acme/ui' });
    write('app/src/a.zukan.svelte');
    write('ui/src/b.zukan.svelte');
    mkdirSync(join(tmp, 'app/node_modules/@acme'), { recursive: true });
    symlinkSync(join(tmp, 'ui'), join(tmp, 'app/node_modules/@acme/ui'), 'dir');
    expect(discoverGroups(join(tmp, 'app'))).toEqual([
      { name: 'app', dirs: [p('app/src')] },
      { name: '@acme/ui', dirs: [p('ui/src')] }
    ]);
  });
  ```
  Other tests cover: skipping installed packages, pnpm-style links into `.pnpm`, and the `svelte-zukan` self-link. They must keep passing.
- Docs (`docs/content/guides/monorepo.md`, "How dependencies are found"):

  > Dependency packages are found through the links in the catalog app's own `node_modules/<dependency name>`, which is how pnpm workspaces link them.
  >
  > - With npm or yarn workspaces, the links are created in the workspace root's `node_modules`, so they are not found. Use `groups` instead
  > - Transitive dependencies are not scanned. …

  JA (`docs/content/ja/guides/monorepo.md`, 「依存パッケージの見つけ方」):

  > 依存パッケージは、カタログ用のアプリ自身の `node_modules/<依存名>` にあるリンクから探します。pnpm のワークスペースはこの形でリンクします。
  >
  > - npm や yarn のワークスペースでは、リンクがワークスペースのルートの `node_modules` にできるので見つかりません。その場合は `groups` で指定してください

- AGENTS.md "Library architecture", Discovery bullet: "Without it, the Vite root's own `src`, then the `src` of each dependency whose `node_modules` link resolves outside `node_modules` (a workspace link), in declaration order."

## Commands you will need

| Purpose          | Command                                                                                     | Expected on success |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| Install          | `pnpm install`                                                                              | exit 0              |
| Discovery tests  | `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/discover.test.ts` | all pass            |
| All tests        | `pnpm --filter svelte-zukan exec vitest run && pnpm --filter build-tests test`              | all pass            |
| Typecheck / lint | `pnpm run package && pnpm run check && pnpm run format && pnpm run lint`                    | exit 0              |
| Docs             | `pnpm --filter docs build`                                                                  | exit 0              |

## Scope

**In scope**: `discover.ts` (`discoverGroups`), `discover.test.ts`, `docs/content/guides/monorepo.md`, `docs/content/ja/guides/monorepo.md`, `AGENTS.md` (the Discovery bullet), `.changeset/discover-root-node-modules.md` (create).

**Out of scope**: Yarn Plug'n'Play (no `node_modules`; `groups` stays the answer). Transitive dependencies. The `groups` option.

## Git workflow

- Branch: `advisor/014-discover-npm-yarn-workspaces`
- One commit, for example `feat: discover workspace packages linked at the workspace root`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Tests first

Add to `describe('discoverGroups')`:

1. `'workspace dependency linked at the workspace root (npm, yarn, bun)'`: `pkg('', { name: 'root', private: true, workspaces: ['app', 'ui'] })` (this writes `tmp/package.json`), `pkg('app', { name: 'app', dependencies: { '@acme/ui': '*' } })`, `pkg('ui', { name: '@acme/ui' })`, write both catalog files, `mkdirSync(join(tmp, 'node_modules/@acme'), { recursive: true })`, `symlinkSync(join(tmp, 'ui'), join(tmp, 'node_modules/@acme/ui'), 'dir')` → same two groups as `'workspace dependency'`.
2. `'a hoisted installed package at the workspace root is skipped'`: same root `package.json`; `pkg('app', { name: 'app', dependencies: { lodash: '^4' } })`; `pkg('node_modules/lodash', { name: 'lodash' })` with `node_modules/lodash/src/x.zukan.svelte` → `names(...)` is `['app']`.
3. `'the app's own link wins over the workspace root'`: the same root `package.json` with `workspaces` as tests 1 and 2 (without it the workspace root is the app itself and the test proves nothing), `pkg('app', { name: 'app', dependencies: { '@acme/ui': '*' } })`, and both `app/node_modules/@acme/ui` (to `ui`) and `node_modules/@acme/ui` (to a second dir `ui2` with its own `package.json` `{ name: '@acme/ui' }` and catalog file) → the group's dirs are `[p('ui/src')]`.
4. `'no workspace root: nothing changes'`: no root `package.json`; `pkg('app', { name: 'app', dependencies: { '@acme/ui': '*' } })` and `pkg('ui', { name: '@acme/ui' })` with catalog files; a link only at `tmp/node_modules/@acme/ui` → `['app']` (the workspace root falls back to `tmp/app`).

**Verify**: test 1 fails; tests 2, 3 and 4 pass (they pin behaviour that must not change).

### Step 2: Fall back to the workspace root's `node_modules`

In `discoverGroups`, compute the workspace root once (`const ws = searchForWorkspaceRoot(root);`, imported from `vite`), and look up each dependency's link in the app first, then at the workspace root:

```ts
// pnpm links workspace packages in the app's node_modules; npm, yarn and bun in the workspace root's
const link = [join(root, 'node_modules', dep), join(ws, 'node_modules', dep)].find((l) => existsSync(l));
if (!link) continue;
```

When `ws` equals `root`, both candidates are the same path, which is harmless. Keep every existing filter unchanged: the real path must be outside `node_modules`, deduplication by real path, and skipping `svelte-zukan`.

**Verify**: discovery tests → all pass, old and new.

### Step 3: Docs, AGENTS.md, changeset

1. `monorepo.md` EN: change the first paragraph of "How dependencies are found" to "Dependency packages are found through the links in the catalog app's own `node_modules/<dependency name>` (pnpm), or in the workspace root's `node_modules/<dependency name>` (npm, yarn and bun)." Replace the npm/yarn bullet with "- Yarn Plug'n'Play has no `node_modules`, so packages are not found there. Use `groups` instead".
2. JA, same meaning: 「依存パッケージは、カタログ用のアプリ自身の `node_modules/<依存名>`（pnpm）か、ワークスペースのルートの `node_modules/<依存名>`（npm、yarn、bun）にあるリンクから探します。」 and the bullet 「- Yarn の Plug'n'Play には `node_modules` がないので見つかりません。その場合は `groups` で指定してください」.
3. AGENTS.md Discovery bullet: replace "each dependency whose `node_modules` link resolves outside `node_modules` (a workspace link)" with "each dependency whose link in the app's `node_modules`, or else in the workspace root's `node_modules`, resolves outside `node_modules` (a workspace link)".
4. Create `.changeset/discover-root-node-modules.md`:
   ```md
   ---
   'svelte-zukan': minor
   ---

   feat: without `groups`, workspace packages linked in the workspace root's `node_modules` (npm, yarn and bun workspaces) are discovered too. Catalog files in those packages now appear in the catalog; set `groups` to keep the previous result.
   ```

**Verify**: `pnpm run format && pnpm run lint` → exit 0, `pnpm --filter docs build` → exit 0.

## Test plan

Four new discovery tests (Step 1). The existing discovery, build and dev tests stay green; the monorepo build fixture uses app-local links (pnpm style), so its result must not change.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0, with the 4 new tests
- [ ] `pnpm --filter build-tests test` exits 0
- [ ] `pnpm run package && pnpm run check` and `pnpm run lint` exit 0
- [ ] `pnpm --filter docs build` exits 0
- [ ] `.changeset/discover-root-node-modules.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- `searchForWorkspaceRoot` does not detect the `workspaces` field in the test layout (test 1 still fails after Step 2). Report what it returns; do not write your own workspace-root search.
- The Windows CI job (`test-windows`, server tests) fails on the new symlink tests. The existing tests use `symlinkSync(..., 'dir')`, so the new ones should behave the same; if not, report.
- An existing test changes its result.

## Maintenance notes

- The maintainer may prefer to keep pnpm-only discovery (smaller surface, no surprise groups). If so, mark this plan REJECTED in `plans/README.md` and leave the docs as they are.
- Transitive dependencies are still not scanned, by design.
