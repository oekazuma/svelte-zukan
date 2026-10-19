# Plan 008: Extending `server.fs.allow` no longer widens an explicit allow list to the whole workspace

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/vite/options.ts packages/svelte-zukan/src/lib/vite/index.test.ts AGENTS.md`
> Earlier plans edit other parts of `index.test.ts` and `AGENTS.md`. Only `describe('extendFsAllow')` in the test file, `extendFsAllow` in `options.ts` and `AGENTS.md:68` matter here; STOP if those differ from "Current state".

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: none (run after 004 and 007, which edit the same test file)
- Category: security
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

Vite's dev server serves files outside the root through `/@fs/` only when they are under `server.fs.allow`. Without an explicit list, Vite's default is the workspace root. SvelteKit sets an explicit, narrower list (its `src`, `lib`, `routes`, output dirs, runtime and `node_modules` dirs, but not the workspace root). The plugin needs to add a few directories outside the root (scanned catalog dirs, the wrapper/logo dirs, the library's own dir). When it does, it also prepends `searchForWorkspaceRoot(root)`, even when the list was already explicit. For SvelteKit apps in a monorepo, which covers most monorepo users because the library dir itself is outside the app root under pnpm, this silently lets `/@fs/` read any file in the monorepo. It matters when the dev server is reachable by others (`--host`). The workspace root is only needed to keep Vite's default when no list was set.

Files reached through imports are not affected: Vite allows modules it resolved itself, independent of `fs.allow`. This plan only removes the extra workspace-root entry when a list already exists.

## Current state

- `packages/svelte-zukan/src/lib/vite/options.ts:58-65`:
  ```ts
  /**
   * `server.fs.allow` with the dirs outside the root added, or undefined when nothing has to be added.
   * Compared with the root, not the workspace root: SvelteKit sets an explicit allow list, so Vite's default is not used there.
   */
  export function extendFsAllow(root: string, dirs: string[], allow: string[] | undefined): string[] | undefined {
    const outside = dirs.filter((dir) => !isInside(normalizePath(dir), normalizePath(root)));
    return outside.length ? [searchForWorkspaceRoot(root), ...(allow ?? []), ...outside] : undefined;
  }
  ```
- `packages/svelte-zukan/src/lib/vite/index.ts:46-48` calls it in the `config` hook (`order: 'post'`, so SvelteKit's list is already in `config.server.fs.allow`):
  ```ts
  const allow = extendFsAllow(root, [...scanned(), libDir, ...files.map(dirname)], config.server?.fs?.allow);
  // mutated rather than returned: returned arrays are concatenated to the user's `allow`
  if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
  ```
- Tests: `packages/svelte-zukan/src/lib/vite/index.test.ts`, `describe('extendFsAllow')` (starts around line 335). These assertions encode the current behaviour and change in this plan:
  ```ts
    it('adds the workspace root, the existing allow and the dirs outside the root', async () => {
      const { tmp, root, outside } = await makeApp();
      const ws = searchForWorkspaceRoot(root);
      // inside the workspace still counts: SvelteKit sets an explicit allow list without the workspace root
      expect(normalizePath(ws)).toBe(tmp);
      expect(extendFsAllow(root, [`${root}/src`, outside], ['/x'])).toEqual([ws, '/x', outside]);
      expect(extendFsAllow(root, [outside], undefined)).toEqual([ws, outside]);
    });

    it('is applied in the config hook', async () => {
      ...
      expect(boot(root).config.server?.fs?.allow).toEqual([ws, libDir]);
      const { config } = boot(root, { groups: { a: 'src', b: '../outside' } }, ['/x']);
      expect(config.server?.fs?.allow).toEqual([ws, '/x', outside, libDir]);
    });
  ```
  The other cases in that describe (no `allow` passed, or nothing outside the root) keep their expectations.
- `AGENTS.md:68`: "`server.fs.allow` is extended only for scanned directories, the wrapper/logo directories and the library's own directory that lie outside the Vite root, together with `searchForWorkspaceRoot(root)` and the user's own `allow`."

## Commands you will need

| Purpose      | Command                                                                                  | Expected on success |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------- |
| Install      | `pnpm install`                                                                           | exit 0              |
| Plugin tests | `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts` | all pass            |
| All tests    | `pnpm --filter svelte-zukan exec vitest run && pnpm --filter build-tests test`           | all pass            |
| Typecheck    | `pnpm run package && pnpm run check`                                                     | exit 0              |
| Lint         | `pnpm run format && pnpm run lint`                                                       | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/options.ts` (`extendFsAllow` and its doc comment)
- `packages/svelte-zukan/src/lib/vite/index.test.ts` (`describe('extendFsAllow')` only)
- `AGENTS.md` (line 68)
- `.changeset/narrow-fs-allow.md` (create)

**Out of scope**:

- The list of dirs passed in `index.ts`.
- `server.fs.deny` and any other server option.

## Git workflow

- Branch: `advisor/008-narrow-fs-allow`
- One commit, for example `fix: keep an explicit server.fs.allow list instead of widening it to the workspace root`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Update the tests to the intended behaviour

In `describe('extendFsAllow')`:

- rename the first changed test to `'keeps an explicit allow list and adds the dirs outside the root'`, replace its comment with `// an explicit list (SvelteKit's, or the user's) is kept as it is; the workspace root stands in only for Vite's default`, and expect `extendFsAllow(root, [`${root}/src`, outside], ['/x'])` to equal `['/x', outside]`. Keep the `undefined` case as `[ws, outside]`;
- in `'is applied in the config hook'`, expect `['/x', outside, libDir]` for the case with `['/x']`. Keep `[ws, libDir]` for `boot(root)`.

**Verify**: plugin tests → exactly these 2 tests fail.

### Step 2: Prepend the workspace root only for Vite's default

```ts
/**
 * `server.fs.allow` with the dirs outside the root added, or undefined when nothing has to be added.
 * Without a list, Vite's default (the workspace root) is kept; an explicit list, such as SvelteKit's, is not widened.
 */
export function extendFsAllow(root: string, dirs: string[], allow: string[] | undefined): string[] | undefined {
  const outside = dirs.filter((dir) => !isInside(normalizePath(dir), normalizePath(root)));
  return outside.length ? [...(allow ?? [searchForWorkspaceRoot(root)]), ...outside] : undefined;
}
```

**Verify**: plugin tests → all pass. `pnpm --filter build-tests test` → all pass. (Plan 001's dev-server test uses plain Vite without an allow list, so it does not exercise the narrowed path; Step 3 does.)

### Step 3: Check a SvelteKit dev server by hand

Run `pnpm run package`, then `pnpm --filter example dev`. Open `http://localhost:5173/__zukan/` and `http://localhost:5173/__zukan/#/example/lib/Counter`.

**Verify**: both render (the list, then the Counter detail with its preview), and the browser console has no `403` responses. Without a browser, check the one request Vite tests against `fs.allow`, the bundled logo: `curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:5173/@fs$(pwd)/packages/svelte-zukan/dist/app/logo.svg?url"` → `200`. Stop the server.

### Step 4: Docs and changeset

1. `AGENTS.md:68`: replace "together with `searchForWorkspaceRoot(root)` and the user's own `allow`" with "added to the existing `allow` list (SvelteKit's or the user's), or to `searchForWorkspaceRoot(root)` when there is none, which is Vite's default".
2. Create `.changeset/narrow-fs-allow.md`:
   ```md
   ---
   'svelte-zukan': patch
   ---

   fix: when the dev server already has a `server.fs.allow` list (SvelteKit sets one), the plugin adds only the directories it needs instead of allowing the whole workspace.
   ```

**Verify**: `pnpm run format && pnpm run lint` → exit 0.

## Test plan

Two updated unit expectations (Step 1), the build/dev tests (Step 2), and a manual SvelteKit dev check (Step 3).

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0
- [ ] `pnpm --filter build-tests test` exits 0
- [ ] `grep -n "allow ?? \[searchForWorkspaceRoot(root)\]" packages/svelte-zukan/src/lib/vite/options.ts` prints one line
- [ ] `pnpm run package && pnpm run check` and `pnpm run lint` exit 0
- [ ] `.changeset/narrow-fs-allow.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 3 shows a `403` for any catalog file, the wrapper, the logo or a file of the library. That means a directory the catalog needs was only covered by the workspace root. Report the denied path; do not put the workspace root back.
- Any build test fails after Step 2.

## Maintenance notes

- If the plugin starts serving a new kind of file outside the root (for example a theme directory), add its directory to the list passed in `index.ts`. Do not widen the list again.
- Reviewers: the security impact is limited to dev servers exposed with `--host`. The change must not alter behaviour for plain Vite users without an explicit list (the `undefined` case keeps the workspace root).
