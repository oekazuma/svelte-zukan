# Plan 009: CI and Renovate settings do what they intend (scoped Pages permissions, required checks on every PR, grouped catalog updates, a cached Windows install)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- .github/workflows renovate.json`
> Plans 001 and 005 add or change steps in `ci.yml` (the `test-windows` build-tests step, the `check` and `test` jobs). Plan 007 edits the description string in `renovate.json`. Those are expected. STOP if the excerpts below differ for any other reason.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: plans/001-dev-prebundle-section-context.md, plans/005-build-tests-check-output.md (same `ci.yml`), plans/007-split-catalog-metadata.md (same `renovate.json`)
- Category: security + dx
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

Four independent configuration problems, each small:

1. `deploy-docs.yml` grants `pages: write` and `id-token: write` to the whole workflow, so the `build` job gets them too. That job installs every dependency and runs the docs and catalog builds, which is third-party code. Only the `deploy` job needs them. Two quick pushes can also run two Pages deployments at once (no `concurrency`), and neither job has a timeout.
2. `ci.yml` ignores `.changeset/**`, `.vscode/**` and `.github/**/*.md` changes on `pull_request`. Branch protection on `main` requires all five CI jobs. A PR that only adds a changeset or edits an issue template never gets those checks and cannot be merged without an admin bypass.
3. In `renovate.json`, the `devDependencies` group matches by dependency type, but every devDependency in this repo is `catalog:`. Renovate reports the versions in `pnpm-workspace.yaml` with the dep type `pnpm.catalog.default`, so the group catches nothing, and those updates arrive as separate PRs.
4. The `test-windows` job installs pnpm with npm (on purpose, see the comment in the job) and therefore has no pnpm store cache. Every run downloads the whole dependency tree.

## Current state

- `.github/workflows/deploy-docs.yml`:
  ```yaml
  permissions:
    contents: read
    pages: write
    id-token: write

  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - name: Checkout your repository using git
          uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        ...
        - name: Configure GitHub Pages
          uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0
        - name: Upload Pages artifact
          uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
          with:
            path: docs/dist

    deploy:
      needs: build
      runs-on: ubuntu-latest
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      steps:
        - name: Deploy to GitHub Pages
          id: deployment
          uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
  ```
- `.github/workflows/ci.yml` top:
  ```yaml
  on:
    push:
      branches:
        - main
      paths-ignore:
        - '.changeset/**'
        - '.vscode/**'
        - '**/.github/**/*.md'
    pull_request:
      paths-ignore:
        - '.changeset/**'
        - '.vscode/**'
        - '**/.github/**/*.md'
    # release.yml starts it on the Version Packages branch: a pull request opened with GITHUB_TOKEN triggers no workflow
    workflow_dispatch:
  ```
- `ci.yml`, job `test-windows`:
  ```yaml
  - name: Setup Node.js
    uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
    with:
      node-version: ${{ steps.versions.outputs.node }}
  - name: Install pnpm and dependencies
    shell: bash
    env:
      PNPM_VERSION: ${{ steps.versions.outputs.pnpm }}
    run: |
      npm install -g "pnpm@${PNPM_VERSION}"
      pnpm install --frozen-lockfile
  ```
  The comment above this job's steps explains why `pnpm/action-setup` is not used there. Keep that comment and that approach.
- `actions/cache` is already used, pinned, in `.github/workflows/setup-playwright/action.yml`: `uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0`. Reuse exactly this pin.
- `renovate.json` rule:
  ```json
      {
        "groupName": "devDependencies",
        "matchDepTypes": ["devDependencies"]
      },
  ```
- Repo rule (AGENTS.md): every action is pinned to a full commit SHA with a `# vX.Y.Z` comment. Never use a bare tag. Renovate keeps the pins up to date.

## Commands you will need

| Purpose       | Command                                                                    | Expected on success                         |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| Format + lint | `pnpm run format && pnpm run lint`                                         | exit 0 (Prettier also checks YAML and JSON) |
| JSON validity | `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8'))"` | exit 0                                      |
| Pin check     | `git diff 30b6d25 -- .github                                               | grep '^+.*uses:'`                           | only the `actions/cache@55cc8345…` line from Step 4 |

## Scope

**In scope**:

- `.github/workflows/deploy-docs.yml`
- `.github/workflows/ci.yml` (the `on:` block, and the install steps of `test-windows`)
- `renovate.json` (the `devDependencies` rule)

**Out of scope**:

- `release.yml` and its permissions.
- The playwright cache action (`setup-playwright/action.yml`).
- No changeset: CI-only change.

## Git workflow

- Branch: `advisor/009-ci-workflow-hygiene`
- One commit per numbered step, for example `ci: give Pages permissions to the deploy job only`, `ci: run the required checks on every pull request`, `chore: group pnpm catalog updates in Renovate`, `ci: cache the pnpm store on Windows`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Scope the Pages permissions

In `deploy-docs.yml`:

- set the workflow-level block to:
  ```yaml
  permissions:
    contents: read

  # one Pages deployment at a time, and a running one is never cancelled
  concurrency:
    group: pages
    cancel-in-progress: false
  ```
- `build` job: add, under `runs-on:` (`configure-pages` reads the Pages settings):
  ```yaml
  permissions:
    contents: read
    pages: read
  timeout-minutes: 15
  ```
- `deploy` job: add
  ```yaml
  permissions:
    pages: write
    id-token: write
  timeout-minutes: 10
  ```

**Verify**: `pnpm run lint` → exit 0, and `grep -n "id-token" .github/workflows/deploy-docs.yml` prints exactly one line, inside the `deploy` job.

### Step 2: Run the required checks on every pull request

In `ci.yml`, delete the `paths-ignore` list under `pull_request:` and leave `pull_request:` with no keys. Keep `paths-ignore` under `push:` unchanged.

**Verify**: `sed -n 1,20p .github/workflows/ci.yml` shows `pull_request:` with nothing nested under it, and `push:` still has its `paths-ignore`.

### Step 3: Group the catalog devDependencies

Change the rule to:

```json
    {
      "description": "Dev dependencies are `catalog:` references, which Renovate reports from pnpm-workspace.yaml as pnpm.catalog.default.",
      "groupName": "devDependencies",
      "matchDepTypes": ["devDependencies", "pnpm.catalog.default"]
    },
```

`pnpm.catalog.default` is the dep type Renovate's npm manager gives entries of the default `catalog:` in `pnpm-workspace.yaml` (see `https://docs.renovatebot.com/modules/manager/npm/`, pnpm catalogs, if you have network access).

**Verify**: the JSON validity command → exit 0, and `pnpm run lint` → exit 0.

### Step 4: Cache the pnpm store on Windows

Split the `Install pnpm and dependencies` step of `test-windows` into three steps:

```yaml
- name: Install pnpm
  shell: bash
  env:
    PNPM_VERSION: ${{ steps.versions.outputs.pnpm }}
  run: |
    npm install -g "pnpm@${PNPM_VERSION}"
    echo "PNPM_STORE=$(pnpm store path --silent)" >> "$GITHUB_ENV"
- name: Cache the pnpm store
  uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
  with:
    path: ${{ env.PNPM_STORE }}
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
- name: Install dependencies
  shell: bash
  run: pnpm install --frozen-lockfile
```

**Verify**: the pin check command prints only the new `actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0` line, and `pnpm run lint` → exit 0.

## Test plan

These files cannot run locally. Verification is lint plus the checks below, and the first CI runs after the operator pushes:

- the PR's CI runs all five jobs; `test-windows` shows a `Cache the pnpm store` step (a miss on the first run, a hit on the next);
- after merge to `main`, the `Deploy for Docs to GitHub Pages` run succeeds.

## Done criteria

- [ ] `pnpm run lint` exits 0
- [ ] `grep -c "id-token: write" .github/workflows/deploy-docs.yml` prints `1`
- [ ] `grep -n "concurrency" .github/workflows/deploy-docs.yml` prints a line
- [ ] `awk '/^  pull_request:/{f=1;next} /^  [^ ]/{f=0} f' .github/workflows/ci.yml` prints nothing
- [ ] `grep -n "pnpm.catalog.default" renovate.json` prints a line
- [ ] The pin check prints only the `actions/cache@55cc8345…` line
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated
- [ ] (operator, after merge) the next Deploy run succeeds

## STOP conditions

- Renovate's docs give a different dep type for catalog entries. Use the documented value only if it is clearly stated; otherwise report.
- After the operator pushes, `Configure GitHub Pages` fails with a permission error under `pages: read`. Then change the `build` job to `pages: write` (still without `id-token`) and report it.
- `pnpm store path --silent` fails on the Windows runner. Report the log; do not switch the job to `pnpm/action-setup`.

## Maintenance notes

- Removing `paths-ignore` from `pull_request` makes doc-only PRs run the full CI (about 15 minutes). If that is too slow, add a cheap always-run job that the required checks map to, instead of restoring the filter.
- If more catalogs are added to `pnpm-workspace.yaml` (`catalogs:` named groups), Renovate reports them as `pnpm.catalog.<name>`. Add them to the rule.
