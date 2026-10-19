# Plan 028: Release runs never overlap, `marked`'s published range only moves on majors, and action updates get a human review

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- .github/workflows/release.yml renovate.json AGENTS.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 021 changes `AGENTS.md:68`; that line is not touched here.)

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: none
- Category: dx / security
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

Three small CI/dependency settings, each with a concrete cost:

1. **Overlapping releases.** `.github/workflows/release.yml` runs `changesets/action` on every push to `main`. It has no `concurrency` group and no `timeout-minutes`, while every other workflow has both. Two quick merges start two runs that race on force-pushing the `changeset-release/main` branch or on `changeset publish`. A hung run holds `id-token: write` (npm trusted publishing) for GitHub's 6-hour default. changesets/action's own README recommends a concurrency group.
2. **`marked`'s range creeps up.** `marked` is the published package's only runtime dependency. Renovate's global `"rangeStrategy": "bump"` rewrites `"marked": "^18.1.1"` to `^18.x.y` on every minor or patch. That raises the floor for every consumer for no reason, which can give them duplicate `marked` copies. The change also ships without a changeset, quietly, in the next unrelated release. `"update-lockfile"` keeps in-range updates lockfile-only and changes the range only when a new major needs it.
3. **Action updates are auto-merged into the publishing workflow.** All actions are pinned to commit SHAs (a repository rule), but the first package rule auto-merges every non-major update, including `github-actions` digests and versions. A merged action update runs at once in `release.yml` with `id-token: write` and `contents: write`, after only the 3-day `minimumReleaseAge`. SHA pins only protect while a human reviews the bumps.

## Current state

- `.github/workflows/release.yml` (36 lines). Top of the file:
  ```yaml
  name: Release

  on:
    push:
      branches:
        - main

  permissions: {}
  jobs:
    release:
      permissions:
        contents: write # to create release (changesets/action)
        id-token: write # OpenID Connect token needed for provenance
        pull-requests: write # to create pull request (changesets/action)
        actions: write # to start CI on the Version Packages branch
      name: Release
      runs-on: ubuntu-latest
      steps:
  ```
- `.github/workflows/deploy-docs.yml:17` has a top-level `concurrency:` block and `timeout-minutes:` on each job (lines 27 and 52): the style to match.
- `renovate.json` (57 lines). Relevant parts:
  ```json
    "rangeStrategy": "bump",
    "platformAutomerge": true,
    "packageRules": [
      {
        "description": "Auto-merge everything except major updates (those need review) — CI still has to pass first.",
        "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
        "automerge": true
      },
      {
        "description": "marked ships as a runtime dependency of the published package, so its updates reach every consumer — keep them manually reviewed.",
        "groupName": "dependencies",
        "matchDepTypes": ["dependencies"],
        "automerge": false
      },
  ```
  Later rules win in Renovate, so a rule appended at the end overrides the first one.
- `AGENTS.md:101` says actions are SHA-pinned "(Renovate keeps them updated)"; `AGENTS.md:112` says "Renovate does not auto-merge its updates" for `marked`.
- At planning time the repository showed no Renovate activity at all. The maintainer enabled the Renovate GitHub App on 2026-10-20, after the audit, so its first PRs (and a Dependency Dashboard issue) may already exist when you run this plan.

## Commands you will need

| Purpose                  | Command (from the repo root)                                                                                                                                                                           | Expected on success                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Validate Renovate config | `(cd "$(mktemp -d)" && npx --yes --package renovate@latest -- renovate-config-validator "$OLDPWD/renovate.json")` (run from the repo root; npx refuses to run inside the repo because of `devEngines`) | `Config validated successfully` (needs network; skip if unavailable and say so) |
| Lint                     | `pnpm run lint` (Prettier also formats JSON and YAML)                                                                                                                                                  | exit 0                                                                          |

## Scope

**In scope**:

- `.github/workflows/release.yml`
- `renovate.json`
- `AGENTS.md` (lines 101 and 112 only, if wording needs it)

**Out of scope**:

- Any other workflow, any action version or SHA.
- Renovate rules for devDependencies or the catalog.

## Git workflow

- Branch: `advisor/028-release-and-renovate`
- Conventional Commits, e.g. `ci: never run two release jobs at once`, `chore: keep marked's range and review action updates in Renovate`
- No changeset (CI/config only).
- Do not push or open a PR unless told to.

## Steps

### Step 1: Concurrency and timeout for the release workflow

In `release.yml`, add after `permissions: {}`:

```yaml
# two pushes in a row would race on the Version Packages branch or on publishing
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
```

and `timeout-minutes: 10` on the `release` job (next to `runs-on`). `cancel-in-progress: false` queues the second run instead of killing a publish halfway.

**Verify**: `pnpm run lint` → exit 0; `git diff .github/workflows/release.yml` shows only these additions.

### Step 2: Range strategy for runtime dependencies

In the `dependencies` package rule of `renovate.json`, add `"rangeStrategy": "update-lockfile"` and extend its `description` with: `In-range updates touch only the lockfile, so the published range does not narrow.`

**Verify**: run the config validator (see Commands) → validated, or note that it could not run.

### Step 3: Review action updates by hand

Append a package rule at the end of `packageRules`:

```json
{
  "description": "Actions run in release.yml with publishing rights; a pinned SHA only helps if someone reads the bump.",
  "matchManagers": ["github-actions"],
  "automerge": false
}
```

In `AGENTS.md:101`, change "(Renovate keeps them updated)" to "(Renovate opens update PRs; they are reviewed by hand)".

**Verify**: run the config validator → validated, or note that it could not run. `pnpm run lint` → exit 0.

## Test plan

No automated tests cover workflow or Renovate config. The checks are the validator, Prettier, and a reviewed diff.

## Done criteria

- [ ] `grep -n "concurrency:" .github/workflows/release.yml` and `grep -n "timeout-minutes: 10" .github/workflows/release.yml` each print one line
- [ ] `grep -n '"update-lockfile"' renovate.json` prints one line, inside the `dependencies` rule
- [ ] `grep -n '"matchManagers": \["github-actions"\]' renovate.json` prints one line, in the last rule
- [ ] `pnpm run lint` exits 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The validator rejects `rangeStrategy` inside a package rule, or `matchManagers`: report the message. Do not restructure other rules.
- `release.yml` already has a `concurrency` key (someone added it since): STOP and report.

## Maintenance notes

- If the maintainer later wants fewer manual PRs, scope the last rule to the actions used in `release.yml` (`matchPackageNames`) instead of removing it.
- `cancel-in-progress: false` never cancels a running release. GitHub keeps at most one pending run per group, so a burst of merges may skip queued runs; the last one covers all of them.
