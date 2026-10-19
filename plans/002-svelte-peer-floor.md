# Plan 002: The `svelte` peer range starts at the first version that compiles the catalog UI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/package.json docs/content/quickstart.mdx docs/content/ja/quickstart.mdx docs/content/why.md docs/content/ja/why.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW
- Depends on: none
- Category: migration (dependency metadata)
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

The package ships its catalog UI as `.svelte` source, and the consumer's Svelte compiler builds it. `EntryList.svelte` uses the `$props.id()` rune, which Svelte added in 5.20.0. The peer range still says `^5.0.0`, so a project on Svelte 5.0–5.19 installs without a warning and then hits a compile error as soon as `/__zukan/` loads. The maintainer has decided to keep `$props.id()` and raise the floor instead.

## Current state

- `packages/svelte-zukan/package.json`:
  ```json
    "peerDependencies": {
      "svelte": "^5.0.0",
      "vite": "^8.0.0"
    },
  ```
- `packages/svelte-zukan/src/lib/components/EntryList.svelte:14`: `const id = $props.id();`. It is the only use of a post-5.0 Svelte API in `src/lib` (checked with `git grep` for `$props.id`, `@attach`, `$state.eager`, `$state.snapshot`, `$effect.pending`, `$effect.tracking`, `createSubscriber`, `createContext`, `svelte/reactivity`, `svelte/attachments`).
- The docs state the requirement in four places (EN and JA):
  - `docs/content/quickstart.mdx:7`: "It needs Vite 8 or later, Svelte 5, and Node 22.17 or later."
  - `docs/content/ja/quickstart.mdx:7`: 「Vite 8 以上、Svelte 5、Node 22.17 以上が必要です。」
  - `docs/content/why.md:28` table row `| Requirements | Vite 8+, Svelte 5, SvelteKit 3+ (or plain Vite + Svelte) | … |`
  - `docs/content/ja/why.md:28` table row `| 動作条件 | Vite 8 以上、Svelte 5、SvelteKit 3 以上（または素の Vite + Svelte） | … |`
- `pnpm-workspace.yaml` pins the dev version via `svelte: ^5.57.2` in `catalog:`. Do not change that.
- Changesets: write `.changeset/<slug>.md` by hand (the interactive `pnpm exec changeset` is not usable by an agent). Changesets are in English.

## Commands you will need

| Purpose       | Command                            | Expected on success                                                 |
| ------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Install       | `pnpm install`                     | exit 0, lockfile unchanged or only the importer's peer spec changed |
| Package       | `pnpm run package`                 | exit 0 (publint passes)                                             |
| Format + lint | `pnpm run format && pnpm run lint` | exit 0                                                              |
| Docs build    | `pnpm --filter docs build`         | exit 0                                                              |

## Scope

**In scope**:

- `packages/svelte-zukan/package.json` (`peerDependencies.svelte` only)
- `docs/content/quickstart.mdx`, `docs/content/ja/quickstart.mdx` (line 7)
- `docs/content/why.md`, `docs/content/ja/why.md` (the requirements row, line 28)
- `.changeset/svelte-5-20.md` (create)
- `pnpm-lock.yaml`, only if `pnpm install` rewrites it

**Out of scope**:

- `EntryList.svelte`. `$props.id()` stays.
- The `vite` peer range and `engines.node`.
- The `svelte` version in the workspace catalog.

## Git workflow

- Branch: `advisor/002-svelte-peer-floor`
- One commit, for example `fix: require Svelte 5.20 or later, needed by the catalog UI`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Confirm the version that added `$props.id()`

Find the release that added `$props.id()` in the Svelte changelog. The published npm package does not include `CHANGELOG.md`, so read it from GitHub.

**Verify**: `curl -s https://raw.githubusercontent.com/sveltejs/svelte/main/packages/svelte/CHANGELOG.md | awk '/^## /{v=$2} /props\.id/{print v}' | tail -1` → `5.20.0` (the oldest version whose notes mention `props.id`). If the command prints another version, use that version in every step below. Without network access, use `5.20.0` and say so in your report.

### Step 2: Raise the peer floor

In `packages/svelte-zukan/package.json`, set `"svelte": "^5.20.0"` in `peerDependencies`. Then run `pnpm install`.

**Verify**: `pnpm run package` → exit 0.

### Step 3: Update the docs (both locales)

- `docs/content/quickstart.mdx:7`: "Svelte 5" → "Svelte 5.20 or later".
- `docs/content/ja/quickstart.mdx:7`: 「Svelte 5」→「Svelte 5.20 以上」.
- `docs/content/why.md:28`: "Svelte 5," → "Svelte 5.20+," in the svelte-zukan cell only.
- `docs/content/ja/why.md:28`: 「Svelte 5、」→「Svelte 5.20 以上、」 in the svelte-zukan cell only.

Leave the "Svelte 5 | Yes" comparison row (line 14) unchanged. Prettier realigns the table.

**Verify**: `pnpm run format && pnpm run lint` → exit 0, and `pnpm --filter docs build` → exit 0.

### Step 4: Add a changeset

Create `.changeset/svelte-5-20.md`:

```md
---
'svelte-zukan': patch
---

fix: require Svelte 5.20 or later. The catalog UI uses `$props.id()`, so older Svelte 5 versions failed to compile it.
```

**Verify**: `cat .changeset/svelte-5-20.md` shows the file.

## Test plan

No new tests: the change is metadata and docs. `pnpm run package` runs publint over the package metadata.

## Done criteria

- [ ] `grep -n '"svelte": "\^5.20.0"' packages/svelte-zukan/package.json` prints one line
- [ ] `grep -n "Svelte 5.20" docs/content/quickstart.mdx docs/content/why.md docs/content/ja/quickstart.mdx docs/content/ja/why.md` prints four lines
- [ ] `pnpm run package`, `pnpm run lint` and `pnpm --filter docs build` exit 0
- [ ] `.changeset/svelte-5-20.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Step 1 finds `$props.id()` in a version other than 5.20.0 and the changelog is ambiguous.
- `pnpm install` wants to change dependency versions beyond the importer's peer spec.

## Maintenance notes

- Anyone adding a newer Svelte API to `src/lib` (for example `{@attach}`) must raise this floor again and update the same four docs lines.
- CI only tests the catalog version (`^5.57.2`). A job that installs the floor version would keep the range honest. It was left out to keep CI small.
