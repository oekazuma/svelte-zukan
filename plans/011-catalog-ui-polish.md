# Plan 011: Small catalog UI fixes (search shortcut on narrow screens, scroll on navigation, one reload per edit, quieter toolbar)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/app packages/svelte-zukan/src/lib/components/PreviewFrame packages/svelte-zukan/src/lib/vite/virtual.ts packages/svelte-zukan/src/lib/vite/index.test.ts`
> Plan 003 replaces the `onhashchange` handler in `App.svelte`, and plan 007 edits `virtual.ts` (`generateCatalogModule`), `Detail.svelte` and the tests. Those are expected. The excerpts below show the state after them where it matters. STOP on any other difference.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: plans/003-ignore-in-page-anchors.md (same handler), plans/007-split-catalog-metadata.md (same files)
- Category: bug (UX / a11y / perf)
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

Four small problems in the catalog UI:

1. Pressing `/` focuses the search box, except on narrow screens. There the search lives in a panel that is `display: none` until the menu opens. The handler sets `open = true` and calls `focus()` in the same tick, before Svelte has applied the change, so focus does nothing.
2. Moving from the bottom of a long detail page to another entry keeps the old scroll position. The new page opens half-way down.
3. In dev, every preview iframe registers its own `zukan:reload` listener. Saving a catalog file reloads each iframe and then the parent, which recreates the iframes anyway: N+1 reloads per save.
4. The width readout in the preview toolbar is an `<output>`. That element is a live region, so screen readers announce every pixel while dragging, although the resize handle already reports the value (`aria-valuenow`). The width preset buttons ("375", "768", …) have no group label.

## Current state

- `packages/svelte-zukan/src/lib/app/Sidebar.svelte:24-31`:
  ```ts
  function onkeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    e.preventDefault();
    open = true;
    search.focus();
  }
  ```
  CSS at `max-width: 767px` hides `.panel` unless `.panel.open`.
- `packages/svelte-zukan/src/lib/app/App.svelte`. After plan 003, the handler is:
  ```ts
  // components in a preview and links in a doc can change the hash too; only catalog routes navigate
  function onhashchange() {
    const next = location.hash;
    if (next !== '' && !next.startsWith('#/')) return;
    if (route.view === 'preview' && parseHash(next).view !== 'preview') return;
    hash = next;
  }
  ```
  with `<svelte:window {onhashchange} />`.
- `packages/svelte-zukan/src/lib/vite/virtual.ts`, `generateEntryModule`:
  ```ts
      `if (import.meta.hot) import.meta.hot.on('zukan:reload', () => location.reload());`,
  ```
  Its test in `src/lib/vite/index.test.ts`, `'listens for zukan:reload before loading the app and the catalog'`, finds the listener with `code.indexOf("import.meta.hot.on('zukan:reload'")`. Keep that substring.
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte:101-106`:
  ```svelte
    <div class="toolbar">
      {#each PRESETS as preset (preset)}
        <button type="button" aria-pressed={width === preset} onclick={() => (width = preset)}>{preset}</button>
      {/each}
      <button type="button" aria-pressed={width === null} onclick={() => (width = null)}>{labels.fullWidth}</button>
      <output>{stageWidth ? `${current}px` : ''}</output>
      <div class="group" role="group" aria-label={labels.background}>
  ```
  CSS: `output { margin-left: auto; font-family: var(--_mono); font-size: 12px; color: var(--_muted); }` and `.group { display: flex; gap: 4px; }`. Labels come from `labels` (a `Pick` of `Messages` in `src/lib/app/i18n.ts`); `previewWidth` already exists ("Preview width" / 「プレビューの幅」) and is also the handle's `aria-label`.
- Tests:
  - `src/lib/app/App.svelte.test.ts` (browser). Narrow-screen pattern: `await page.viewport(400, 800);` at the start of the test (a `beforeEach` sets 1280×800). The existing `'/ focuses the search'` test runs at 1280.
  - `src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts` (browser), for example `await expect.element(screen.getByText('768px', { exact: true })).toBeInTheDocument();`.
- Conventions: Svelte 5 runes only. UI strings only from `i18n.ts` (no new strings are needed here). Comments only for a non-obvious WHY.

## Commands you will need

| Purpose         | Command                                                       | Expected on success |
| --------------- | ------------------------------------------------------------- | ------------------- |
| Install         | `pnpm install`                                                | exit 0              |
| Chromium (once) | `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0              |
| Client tests    | `pnpm --filter svelte-zukan exec vitest run --project client` | all pass            |
| Server tests    | `pnpm --filter svelte-zukan exec vitest run --project server` | all pass            |
| Typecheck       | `pnpm run package && pnpm run check`                          | exit 0              |
| Lint            | `pnpm run format && pnpm run lint`                            | exit 0              |

## Suggested executor toolkit

- Use the `svelte:svelte-file-editor` agent or the Svelte MCP `svelte-autofixer` on each edited `.svelte` file if available.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/app/Sidebar.svelte`, `app/App.svelte`, `app/App.svelte.test.ts`
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte`, `PreviewFrame.svelte.test.ts`
- `packages/svelte-zukan/src/lib/vite/virtual.ts` (`generateEntryModule` only), `vite/index.test.ts` (`describe('generateEntryModule')` only)
- `.changeset/catalog-ui-polish.md` (create)

**Out of scope**:

- Focus management or a skip link after navigation. That needs new UI strings in both languages and a design decision.
- `CodeBlock.svelte` and the sidebar menu's keyboard behaviour.
- `EntryList.svelte`'s grouping code.

## Git workflow

- Branch: `advisor/011-catalog-ui-polish`
- One commit per step, for example `fix: focus the search with / on narrow screens`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: `/` focuses the search on narrow screens

1. Test in `App.svelte.test.ts`: `'/ opens the menu and focuses the search on a narrow screen'`: `await page.viewport(400, 800);`, `setup('')`, render, `await userEvent.keyboard('/');`, then `await expect.element(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus();` and `await expect.element(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true');`.
2. Run it → fails (no focus).
3. In `Sidebar.svelte`, import `tick` from `svelte`, make `onkeydown` `async`, keep `e.preventDefault()` before any `await`, and focus after the DOM update:
   ```ts
   e.preventDefault();
   open = true;
   // on narrow screens the panel is display: none until `open` is applied
   await tick();
   search.focus();
   ```

**Verify**: client tests → all pass, including the old `'/ focuses the search'`.

### Step 2: Scroll to the top when the catalog page changes

1. Test `'navigating scrolls back to the top'`: `setup('#/ui/Card')`, render, wait for the `Card` heading, set `document.body.style.minHeight = '5000px'`, `window.scrollTo(0, 1000)`, then `location.hash = '#/ui/Nope'`. Expect `await expect.poll(() => window.scrollY).toBe(0)`. Reset `document.body.style.minHeight = ''` at the end of the test, in a `try`/`finally` so a failure does not leak into later tests.
2. Run it → fails.
3. In `App.svelte`, import `tick` and end `onhashchange` with:
   ```ts
   hash = next;
   // the browser keeps the scroll position on a hash change; the previous page's position means nothing on the next
   if (route.view !== 'preview') tick().then(() => scrollTo(0, 0));
   ```

**Verify**: client tests → all pass.

### Step 3: Reload only the top-level catalog page

1. In `generateEntryModule` (`virtual.ts`), change the listener line to:
   ```ts
      // preview iframes are recreated when the catalog page reloads; a preview opened in its own tab is the top window
      `if (import.meta.hot && window === window.top) import.meta.hot.on('zukan:reload', () => location.reload());`,
   ```
   Put the comment above the array element in the TypeScript source, not inside the generated string.
2. In `index.test.ts`, test `'listens for zukan:reload before loading the app and the catalog'`, add `expect(code).toContain('window === window.top');`.

**Verify**: server tests → all pass. Then by hand: `pnpm --filter svelte-zukan dev`, open `http://localhost:5173/__zukan/#/ui/components/Badge` in one tab and that page's "Open in new tab" preview in a second tab, add a space to `packages/svelte-zukan/src/lib/components/Badge/Badge.zukan.svelte`, and check both tabs reload. Revert the edit.

### Step 4: Toolbar semantics

1. In `PreviewFrame.svelte`, wrap the preset buttons and the 100% button in `<div class="group" role="group" aria-label={labels.previewWidth}>…</div>`, and replace `<output>…</output>` with `<span class="width" aria-hidden="true">…</span>`, the same content. Rename the CSS selector `output` to `.width`. Add a comment on the span: `<!-- the handle reports the same value (aria-valuenow); a live region here would announce every pixel while dragging -->`.
2. In `PreviewFrame.svelte.test.ts`, add `'width presets are a labelled group and the readout is not a live region'`: render, `await expect.element(screen.getByRole('group', { name: 'Preview width' }).getByRole('button', { name: '768', exact: true })).toBeInTheDocument();` and `expect(screen.container.querySelector('output')).toBeNull();`.

**Verify**: client tests → all pass, including the existing PreviewFrame tests that find `'768px'` by text.

### Step 5: Changeset

Create `.changeset/catalog-ui-polish.md`:

```md
---
'svelte-zukan': patch
---

fix: `/` focuses the search on narrow screens too, moving to another page of the catalog starts at the top, saving a catalog file reloads the catalog once instead of once per preview, and screen readers no longer announce the preview width on every drag step.
```

**Verify**: `pnpm run format && pnpm run lint` → exit 0, and `pnpm run package && pnpm run check` → exit 0.

## Test plan

Three new browser tests (Steps 1, 2, 4) and one new assertion in a server test (Step 3). All existing tests pass unchanged.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0, with the new tests
- [ ] `pnpm run package && pnpm run check` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `grep -n "<output" packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte` prints nothing
- [ ] `.changeset/catalog-ui-polish.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Plan 003 has not landed (the inline `onhashchange={() => (hash = location.hash)}` is still there). Do 003 first.
- The Step 2 test is flaky (passes and fails on reruns). Report instead of adding sleeps.
- A preview opened directly in its own tab no longer reloads after a catalog edit (manual check with `pnpm --filter svelte-zukan dev`).

## Maintenance notes

- If the catalog page ever embeds itself (for example the docs site showing the catalog in an iframe), `window === window.top` turns reloads off there. That is acceptable in dev only.
- Focus management after navigation (moving focus to the new `<h1>`, a skip link) is deferred. It needs new i18n keys in `en` and `ja`.
