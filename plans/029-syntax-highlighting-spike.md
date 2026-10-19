# Plan 029 (spike): Decide whether the code view can get syntax highlighting without breaking the size promise

> **Executor instructions**: This is an investigation, not a feature. Follow
> the steps, write the report described in Step 5, and do not merge any
> prototype code into the library. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row for this
> plan in `plans/README.md` — unless a reviewer dispatched you and told you
> they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/components/CodeBlock/ docs/content/why.md packages/svelte-zukan/package.json`
> If any of these changed, read the live versions before measuring; the numbers in "Current state" may be stale (that is not a STOP condition for a spike).

## Status

- Priority: P3
- Effort: M (time-boxed: stop after one working day)
- Risk: LOW (nothing ships)
- Depends on: none
- Category: direction (spike)
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

The catalog's detail page shows each example's code (the "Code" disclosure under every preview), as plain monochrome text. Side-by-side comparisons with Storybook and Histoire make that the most visible gap. But the project positions itself on size and simplicity:

- `docs/content/why.md:13` claims an install size of "**1.0 MB, 4 packages**" against Storybook's 78 MB.
- `AGENTS.md` says: "No new dependencies for small things".
- The original design spec listed "No syntax highlighting" as out of scope. Other items from that list were later added when they cost no dependency and no option (search, dark theme, narrow-screen layout).

The maintainer wants a decision with numbers: is there a way that keeps the size promise and adds no option? If not, the answer "not worth doing" gets recorded so nobody re-audits it.

## Current state

- `packages/svelte-zukan/src/lib/components/CodeBlock/CodeBlock.svelte` (81 lines) renders:
  ```svelte
  <div class="code-block">
    <details>
      <summary>{labels.code}</summary>
      <pre><code>{code}</code></pre>
    </details>
    <button type="button" onclick={copy} aria-live="polite">…</button>
  </div>
  ```
  `code` is a string produced at build/dev time by `src/lib/vite/extract.ts`: a section's markup, optionally preceded by `<script module>` / `<script>` blocks (JS or TS) and `{#snippet}` blocks. So the languages are Svelte markup, HTML, JS and TS.
- Colours come from the catalog's internal CSS variables in `src/lib/app/App.svelte` (`--_text`, `--_muted`, `--_accent`, `--_code-bg`, with a dark variant under `prefers-color-scheme: dark`).
- Runtime dependency of the published package: only `marked` (`packages/svelte-zukan/package.json`). `marked` runs in the Vite plugin (Node), not in the browser.
- The catalog SPA bundle measured on the live demo (https://oekazuma.github.io/svelte-zukan/demo/) at planning time: entry 1.7 KB gzip, App chunk 4.3 KB gzip, Svelte runtime 18.8 KB gzip.
- The `why.md` footnote describes how the size is measured: `npm install` in an empty directory, leaving out the shared peer dependencies (`svelte`, `vite`, `@sveltejs/kit`).

## Candidates to measure

1. **shiki** (a TextMate-grammar highlighter) as a runtime dependency, highlighting in the browser.
2. **shiki at build/dev time in the plugin** (Node side): the `code` string becomes pre-highlighted HTML in the metadata module. That adds no browser JS, but still adds an install dependency.
3. **A small in-house tokenizer** (regexes for tags, attributes, strings, comments, keywords and `{…}` expressions), rendering `<span>`s.
4. **The CSS Custom Highlight API** (`CSS.highlights` + `::highlight()`), fed by the same small tokenizer, with no extra DOM. Check browser support at the time of the spike; if a browser lacks it, the code stays plain there, which is acceptable.

## Steps

### Step 1: Baseline

In a temp directory outside the repo: `npm init -y && npm install --omit=peer svelte-zukan` (the current published version), then count the packages in `node_modules` (`find node_modules -name package.json -not -path '*/node_modules/*/node_modules/*/node_modules/*' | wc -l` is a start; list them with `npm ls --all --omit=peer`) and the size with `du -sh node_modules`. Record the numbers. Note whether they match "1.0 MB, 4 packages"; if not, record what the 4 packages are or the real count.

**Verify**: a short table in your notes: packages, MB.

### Step 2: Measure shiki (candidates 1 and 2)

In another temp directory: `npm install shiki`, and record the added packages and MB. Write a 10-line Node script that highlights a sample `code` string (take one from the library's own catalog: run `pnpm --filter svelte-zukan dev`, open `/__zukan/#/ui/components/Badge`, copy the code view) with the `svelte` language and two themes (`github-light` and `github-dark`). Use the fine-grained setup: `createHighlighterCore` from `shiki/core`, `createJavaScriptRegexEngine` from `shiki/engine/javascript`, and `import('shiki/langs/svelte.mjs')` (it pulls in the languages it embeds). Record the time per call. For candidate 1, also note the browser-side cost of that same setup: bundle a one-file demo with `npx vite build` in a scratch project and record the gzip size of the output.

**Verify**: numbers recorded for install size, browser bundle size (candidate 1), and time per highlight (candidate 2).

### Step 3: Prototype the small tokenizer (candidates 3 and 4)

On a scratch branch `spike/029-highlight` (never merged), write at most ~120 lines:

- `tokenize(code: string): { start: number; end: number; kind: 'tag' | 'attr' | 'string' | 'comment' | 'keyword' | 'expr' }[]`
- a `CodeBlock.svelte` variant that either wraps the ranges in `<span class="tok-…">` (candidate 3) or registers `Highlight` ranges on the `<code>` text node (candidate 4), coloured with the existing CSS variables.
  Try it on the library's own catalog (`pnpm --filter svelte-zukan dev`) and on the samples in `src/lib/vite/extract.test.ts`. Record: lines of code, gzip size added to the App chunk (`pnpm --filter svelte-zukan build`, compare `zukan-dist/_zukan/*.js` gzip sizes before and after with `gzip -c <file> | wc -c`), and visible mistakes (for example, a `<` inside a string highlighted as a tag).

**Verify**: the scratch branch exists locally; `git log main..spike/029-highlight` shows your prototype commits; the main branch is unchanged.

### Step 4: Check the copy button and accessibility

For each prototype, confirm the copy button still copies plain text, and that screen readers still read the code as one text block. With candidate 4 the DOM text is unchanged; with candidate 3, check that the spans add no extra announcements (spans are fine, but no `role`s).

**Verify**: notes per candidate.

### Step 5: Write the report

Create `plans/029-syntax-highlighting-report.md` with:

- the measurements from Steps 1–4 in one table (install MB / packages added, browser gzip added, lines of code, quality notes);
- a recommendation: **adopt candidate N** only if it adds **no runtime dependency** and **under ~3 KB gzip** to the catalog UI, with acceptable quality; otherwise **"not worth doing: conflicts with the size claim in why.md"**;
- if adopting, a rough outline of the production change (files, tests, docs in both locales, a `minor` changeset) for a follow-up plan;
- the Step 1 finding about "1.0 MB, 4 packages".

**Verify**: the report exists and has a recommendation line.

## Scope

**In scope**:

- `plans/029-syntax-highlighting-report.md` (create)
- the scratch branch `spike/029-highlight` (local only, never merged or pushed)
- temp directories outside the repo

**Out of scope**:

- Any change to the library, docs or dependencies on `main` or on the plan branch.
- Adding an option to toggle highlighting.

## Git workflow

- Report branch: `advisor/029-highlight-spike`, containing only the report file. Commit message: `docs: report on the syntax highlighting spike`.
- Prototype branch: `spike/029-highlight`, local only.
- Do not push or open a PR unless told to.

## Done criteria

- [ ] `plans/029-syntax-highlighting-report.md` exists with the table and a recommendation
- [ ] `git diff main --stat` on the report branch shows only the report file (and `plans/README.md`)
- [ ] No new dependency in any `package.json` on the report branch
- [ ] `plans/README.md` status row updated, with the recommendation in one line

## STOP conditions

- The time box (one working day) runs out: write the report with what you have, and mark missing measurements as missing.
- `npm install` needs network access you do not have: report that and measure what you can from the lockfile and the npm registry metadata you can reach.

## Maintenance notes

- If the recommendation is "not worth doing", the index's rejected list should get one line pointing at the report, so later audits skip it.
- Whatever is chosen, the copy button must keep copying the original `code` string.
