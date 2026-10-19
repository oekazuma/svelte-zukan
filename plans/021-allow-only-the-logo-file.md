# Plan 021: A logo outside the Vite root opens only that file to the dev server, not its whole directory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/index.ts packages/svelte-zukan/src/lib/vite/options.ts packages/svelte-zukan/src/lib/vite/index.test.ts AGENTS.md`
> Plans 015, 019 and 020 are expected to have changed `index.ts` and `index.test.ts` in other hooks. Any change to `index.ts:63-67`, `options.ts:55-62` or the `extendFsAllow` tests is a STOP condition.

## Status

- Priority: P2
- Effort: S
- Risk: LOW
- Depends on: plans/020-catalog-responses-use-configured-headers.md (same files; run after it)
- Category: security
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

Vite's dev server only serves files outside the project root (through `/@fs/…`) when they are inside `server.fs.allow`. The plugin adds what the catalog needs that lies outside the root: the scanned directories, the library's own directory, and the directories of the `wrapper` and `logo` files. For the logo, a single image, that is far more than needed. Example: a SvelteKit app at `apps/web` with `logo: '../../logo.svg'` makes the whole monorepo root readable through `/@fs/` (except what `server.fs.deny` blocks, by default `.env`, certificates and `.git`). This is the same widening that an earlier fix (plan 008) removed for the workspace root, reintroduced by one image. It matters when the dev server is reachable by others (`vite --host`).

Vite accepts single files in `server.fs.allow`. In Vite 8.3.4, `isFileInTargetPath(targetPath, filePath)` is `isSameFilePath(targetPath, filePath) || isParentDirectory(targetPath, filePath)` (`node_modules/.pnpm/vite@8.3.4*/node_modules/vite/dist/node/chunks/node.js:18054`), and allow entries are only `path.resolve`d (`:25185`). So the logo's own path is enough.

The wrapper keeps its directory: a wrapper `.svelte` file usually imports CSS next to it, and that CSS may load fonts or images by relative `url()`. Narrowing it is not traced and could break real setups.

## Current state

- `packages/svelte-zukan/src/lib/vite/index.ts:63-67` (inside the `config` hook):
  ```ts
  // the bundled logo is inside libDir
  const files = [resolved.wrapper, options.logo ? resolved.logo : null].filter((f) => f !== null);
  const allow = extendFsAllow(root, [...scanned(), libDir, ...files.map(dirname)], config.server?.fs?.allow);
  // mutated rather than returned: returned arrays are concatenated to the user's `allow`
  if (allow) ((config.server ??= {}).fs ??= {}).allow = allow;
  ```
- `packages/svelte-zukan/src/lib/vite/options.ts:55-62`:
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
  `isInside(path, parent)` works for file paths as well as directories.
- `packages/svelte-zukan/src/lib/vite/index.test.ts:268-279`:
  ```ts
  it('adds the dirs of a wrapper and a logo outside the root', async () => {
    const { root, outside } = await makeApp();
    const assets = normalizePath(path.join(outside, 'assets'));
    mkdirSync(assets);
    await writeFile(path.join(outside, 'W.svelte'), '');
    await writeFile(path.join(assets, 'logo.svg'), '');
    const ws = searchForWorkspaceRoot(root);
    const { config } = boot(root, { wrapper: '../outside/W.svelte', logo: '../outside/assets/logo.svg' });
    expect(config.server?.fs?.allow).toEqual([ws, libDir, outside, assets]);
    // inside the root, nothing is added for them
    expect(boot(root, { wrapper: 'Wrapper.svelte', logo: 'logo.png' }).config.server?.fs?.allow).toEqual([ws, libDir]);
  });
  ```
- `AGENTS.md:68` (“Behaviors that are easy to break”):
  > - `server.fs.allow` is extended only for scanned directories, the wrapper/logo directories and the library's own directory that lie outside the Vite root, …

## Commands you will need

| Purpose           | Command (from the repo root)                                  | Expected on success |
| ----------------- | ------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`                                                | exit 0              |
| Plugin unit tests | `pnpm --filter svelte-zukan exec vitest run --project server` | all pass            |
| Type check        | `pnpm run package && pnpm run check`                          | exit 0              |
| Lint              | `pnpm run lint` (fix with `pnpm run format`)                  | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/index.ts` (lines 63–67 only)
- `packages/svelte-zukan/src/lib/vite/options.ts` (`extendFsAllow`'s parameter name and doc comment only)
- `packages/svelte-zukan/src/lib/vite/index.test.ts` (the `extendFsAllow` describe block only)
- `AGENTS.md` (line 68 only)
- `.changeset/allow-only-logo-file.md` (create)

**Out of scope**:

- The wrapper's directory entry (see "Why this matters").
- The scanned directories and `libDir`.
- Removing the logo entry entirely: earlier verification (plan 008) found the logo request is checked against `server.fs.allow`.

## Git workflow

- Branch: `advisor/021-allow-only-logo-file`
- Conventional Commits, e.g. `fix: add only the logo file to server.fs.allow`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Change the test first

In the test above, rename it to `'adds the dir of a wrapper and the logo file outside the root'` and expect ``[ws, libDir, outside, `${assets}/logo.svg`]``.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/index.test.ts -t "outside the root"` → this test fails (it still gets `assets`).

### Step 2: Pass the logo file itself

In `index.ts`, replace the two lines building `files` and `allow` with:

```ts
// the wrapper's directory, for CSS and assets imported next to it; the logo is one file (the bundled one is inside libDir)
const extra = [...(resolved.wrapper ? [dirname(resolved.wrapper)] : []), ...(options.logo ? [resolved.logo!] : [])];
const allow = extendFsAllow(root, [...scanned(), libDir, ...extra], config.server?.fs?.allow);
```

Keep the following two lines unchanged. If `resolved.logo` is typed `string | null`, keep the `!` only where `options.logo` is truthy, as above. Avoid other casts.

In `options.ts`, rename `extendFsAllow`'s `dirs` parameter to `paths` and change “the dirs outside the root” to “the paths (directories or files) outside the root” in its comment. No logic change.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass.

### Step 3: Check it on a real dev server (manual, not committed)

Write a throwaway script outside the repo (for example in your temp directory) that:

1. creates `<tmp>/app/src/A.zukan.svelte` (content `<Section title="A"><p>a</p></Section>`), `<tmp>/app/package.json` (`{"name":"app"}`), `<tmp>/assets/logo.svg` (any SVG) and `<tmp>/assets/secret.txt`. Do not create a `pnpm-workspace.yaml`: Vite's default allow list is the workspace root, which would contain `secret.txt` anyway;
2. starts `createServer({ root: '<tmp>/app', configFile: false, logLevel: 'silent', plugins: [zukan({ logo: '../assets/logo.svg' })], server: { port: 0, fs: { allow: ['<tmp>/app'] } } })`, then `await server.listen()`. The explicit `allow` mimics SvelteKit's list. Import both modules by absolute path, since the script is outside the repo: `createServer` from `<repo>/packages/svelte-zukan/node_modules/vite/dist/node/index.js`, and `zukan` from `<repo>/packages/svelte-zukan/dist/vite/index.js` (run `pnpm run package` first);
3. fetches `${url}@fs/<tmp>/assets/logo.svg` and `${url}@fs/<tmp>/assets/secret.txt`.

**Verify**: the logo returns 200 and `secret.txt` returns 403. Delete the script and the temp directory afterwards.

### Step 4: AGENTS.md, changeset, checks

In `AGENTS.md:68`, change “the wrapper/logo directories” to “the wrapper's directory, the logo file”.

Create `.changeset/allow-only-logo-file.md`:

```md
---
'svelte-zukan': patch
---

fix: a `logo` outside the Vite root adds only that file to `server.fs.allow`, not its whole directory.
```

**Verify**: `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- Unit: the allow list contains the logo's file path and the wrapper's directory; nothing is added when both are inside the root (existing assertion).
- Manual: on a real dev server, the logo is served and a sibling file is refused.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0
- [ ] `grep -n "files.map(dirname)" packages/svelte-zukan/src/lib/vite/index.ts` prints nothing
- [ ] Step 3 showed 200 for the logo and 403 for the sibling file
- [ ] `grep -n "logo file" AGENTS.md` prints the updated line
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- In Step 3 the logo returns 403 with the file entry (Vite does not match single files in this version). Revert Step 2 and report.
- In Step 3 the sibling file returns 200: something else allows the directory. Report the final `server.config.server.fs.allow`.

## Maintenance notes

- Any new single-file option that the catalog loads from outside the root should add the file, not its directory, unless it imports relative assets.
- If users report a wrapper whose relative assets fail to load, the wrapper directory entry is the place to look; it is deliberately left as a directory.
