# Plan 024: The narrow-screen menu closes on every navigation, previews load on hosts without directory indexes, and a catalog inside an iframe still reloads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/app/Sidebar.svelte packages/svelte-zukan/src/lib/app/Detail.svelte packages/svelte-zukan/src/lib/vite/virtual.ts packages/svelte-zukan/src/lib/app/App.svelte.test.ts packages/svelte-zukan/src/lib/vite/index.test.ts`
> Expected earlier changes: plan 017 (`Detail.svelte`: a `noSections` message; `App.svelte.test.ts`: two tests), plan 018 (`App.svelte.test.ts`: two tests), plan 019 (`virtual.ts`: `metaId`/`pathOfMeta`; `index.test.ts`). Any change to the lines quoted below is a STOP condition.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: plans/017, 018, 019 (same files; run after them)
- Category: bug
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

Three small, independent defects in the catalog UI (a hash-routed SPA served at `/__zukan/`):

1. **Menu stays open.** On narrow screens the component list folds under a "Menu" button. Only a click inside the list closes it. The logo link (to the list) and the browser's Back button change the page but leave the panel covering it.
2. **Previews 404 without directory indexes.** Each section's preview iframe has `src="./#/preview/…"`. When the static catalog is opened as `…/zukan/index.html` on a host that does not serve a directory's `index.html` (plain object-storage endpoints, some CDNs), `./` resolves to `…/zukan/`, which 404s, while the catalog page itself works. `location.pathname + '#/preview/…'` resolves to the page's own path, whatever it is (`…/zukan/index.html` stays `…/index.html`). A fragment-only `src` would do the same, but it also keeps the page's query string, and under Vitest's browser mode the test page's query (`?sessionId=…&iframeId=…`) would make every preview iframe load a second Vitest tester. The catalog never uses the query, so dropping it is safe. Nothing in the history records a reason for the `./` (it came in with the first SPA commit).
3. **No reload when the catalog itself is in an iframe.** The generated entry reloads the page on the dev server's `zukan:reload` event only when `window === window.top`, meaning "I am not a preview iframe". Editors that show web pages inside an iframe (for example VS Code's Simple Browser) make the catalog itself non-top, so editing a catalog file never refreshes it. The real question is "is my parent this same catalog page".

## Current state

- `packages/svelte-zukan/src/lib/app/Sidebar.svelte`:
  - line 17: `let open = $state(false);`
  - line 37: `<svelte:window {onkeydown} />`
  - lines 41–47: the logo link `<a class="logo" href="#/">…</a>` (outside `<nav>`)
  - lines 61–63:
    ```svelte
        <!-- following a link closes the panel on narrow screens; the links themselves handle the keyboard -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <nav aria-label={t.nav} onclick={() => (open = false)}>
    ```
- `packages/svelte-zukan/src/lib/app/Detail.svelte:28`:
  ```svelte
  <PreviewFrame src="./{formatHash('preview', entry.path, section.title)}" title={section.title} labels={t} />
  ```
  `formatHash('preview', path, section)` returns `#/preview/<encoded path>?section=<encoded title>` (`src/lib/app/hash.ts:30-33`). `PreviewFrame` uses `src` for both the iframe and the "Open in new tab" link.
- `packages/svelte-zukan/src/lib/vite/virtual.ts:31-32` (in `generateEntryModule`):
  ```ts
      // preview iframes are recreated when the catalog page reloads; a preview opened in its own tab is the top window
      `if (import.meta.hot && window === window.top) import.meta.hot.on('zukan:reload', () => location.reload());`,
  ```
- `packages/svelte-zukan/src/lib/vite/index.test.ts`, `describe('generateEntryModule')`, test `listens for zukan:reload before loading the app and the catalog`:
  ```ts
  const listen = code.indexOf("import.meta.hot.on('zukan:reload'");
  expect(listen).toBeGreaterThan(-1);
  expect(code).toContain('window === window.top');
  ```
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts` — the narrow-screen pattern is `on a narrow screen the menu button shows the navigation` (`await page.viewport(400, 800)`, `screen.getByRole('button', { name: 'Menu' })`, `toHaveAttribute('aria-expanded', 'true')`).
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts` — `links to the preview in a new tab` passes `src: './#/preview/ui/Card?section=One'` as a prop; it tests the prop, not Detail, so it can stay.

## Commands you will need

| Purpose               | Command (from the repo root)                                                        | Expected on success                                  |
| --------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Install               | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0                                               |
| Browser tests         | `pnpm --filter svelte-zukan exec vitest run --project client`                       | all pass                                             |
| Node tests            | `pnpm --filter svelte-zukan exec vitest run --project server`                       | all pass                                             |
| Library catalog build | `pnpm --filter svelte-zukan build`                                                  | writes `packages/svelte-zukan/zukan-dist/index.html` |
| Type check            | `pnpm run package && pnpm run check`                                                | exit 0                                               |
| Lint                  | `pnpm run lint` (fix with `pnpm run format`)                                        | exit 0                                               |

## Suggested executor toolkit

- If available, run the Svelte MCP `svelte-autofixer` on `Sidebar.svelte` and `Detail.svelte` after editing.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/app/Sidebar.svelte`
- `packages/svelte-zukan/src/lib/app/Detail.svelte` (line 28 only)
- `packages/svelte-zukan/src/lib/vite/virtual.ts` (the reload line only)
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
- `packages/svelte-zukan/src/lib/vite/index.test.ts` (the `generateEntryModule` test only)
- `.changeset/catalog-ui-navigation-fixes.md` (create)

**Out of scope**:

- `App.svelte` routing, `hash.ts`, `PreviewFrame.svelte`.
- Focus management after navigation (recorded as investigate-only earlier).

## Git workflow

- Branch: `advisor/024-catalog-ui-navigation-fixes`
- Conventional Commits, one commit per fix, e.g. `fix: close the narrow-screen menu on every navigation`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Close the menu on any hash change

1. Add a test to `App.svelte.test.ts`, next to the narrow-screen test:
   ```ts
   it('on a narrow screen the menu closes when the logo link or Back navigates', async () => {
     await page.viewport(400, 800);
     const { props } = setup('#/ui/Card');
     const screen = await render(App, { props });
     const menu = screen.getByRole('button', { name: 'Menu' });
     await menu.click();
     await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
     await screen.getByRole('link', { name: 'zukan' }).click();
     await expect.element(menu).toHaveAttribute('aria-expanded', 'false');
     await menu.click();
     await expect.element(menu).toHaveAttribute('aria-expanded', 'true');
     history.back();
     await expect.element(menu).toHaveAttribute('aria-expanded', 'false');
   });
   ```
   (`title` is `'zukan'` and `logo` is `null` in `setup`, so the logo link's name is `zukan`.)
2. In `Sidebar.svelte`, change line 37 to `<svelte:window {onkeydown} onhashchange={() => (open = false)} />`. Keep the `nav` click handler: clicking the link of the page that is already open changes no hash.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/App.svelte.test.ts` → all pass (run the new test once before the source change and see it fail).

### Step 2: Build the preview URL from the page's own path

1. In `Detail.svelte:28`, replace `src="./{formatHash('preview', entry.path, section.title)}"` with `src={location.pathname + formatHash('preview', entry.path, section.title)}`. Add a short comment above it: `<!-- the page's own path: "./" drops index.html, and the query is not part of the catalog -->`. The SPA only runs in the browser, so `location` is always defined.
2. Add an App test (detail page with one section, see the metadata override pattern in `a detail page reads the metadata, not the component`) asserting the iframe's `getAttribute('src')` is `` `${location.pathname}#/preview/ui/Card?section=One` ``, and that the "Open in new tab" link has the same `href` attribute (`toHaveAttribute`).
3. Check the static build in a browser: `pnpm --filter svelte-zukan build`, then `pnpm --filter svelte-zukan preview`, and open `http://localhost:4173/__zukan/index.html#/ui/components/Badge` (use the port the command prints). The previews render, and in the devtools console `document.querySelector('iframe').contentWindow.location.pathname` is `/__zukan/index.html` (before this step it would be `/__zukan/`, the directory URL).

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → all pass; the manual check in 3 shows rendered previews and the `index.html` path.

### Step 3: Reload unless the parent is this catalog

1. In `virtual.ts`, replace the reload line and its comment with:
   ```ts
      // a preview iframe is recreated when its catalog page reloads; any other page (a tab, an editor's iframe) reloads itself
      `if (import.meta.hot) import.meta.hot.on('zukan:reload', () => {`,
      `  let preview = false;`,
      `  try { preview = window !== parent && parent.location.pathname === location.pathname; } catch {}`,
      `  if (!preview) location.reload();`,
      `});`,
   ```
   Keep it as the first statement after the imports (the order test checks it comes before the lazy imports). A cross-origin parent throws on `parent.location.pathname`, which leaves `preview` false.
2. In the `generateEntryModule` test, replace `expect(code).toContain('window === window.top')` with `expect(code).toContain('parent.location.pathname === location.pathname')`. The other assertions in that test must still pass.
3. Manual check (dev): `pnpm --filter svelte-zukan dev`, open `/__zukan/#/ui/components/Badge` in a normal tab, edit `packages/svelte-zukan/src/lib/components/Badge/Badge.zukan.md` (add a word), see the tab reload once and the previews not reload on their own before it. Revert the edit.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass; `git status` shows no change to `Badge.zukan.md`.

### Step 4: Changeset, checks

Create `.changeset/catalog-ui-navigation-fixes.md`:

```md
---
'svelte-zukan': patch
---

fix: the narrow-screen menu closes on every navigation, previews load when the catalog is opened as `index.html`, and a catalog shown inside an editor's iframe reloads after edits.
```

**Verify**: `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- Narrow screen: the menu closes after the logo link and after Back.
- Detail: the iframe `src` and the new-tab `href` are the page's path plus the preview hash.
- Entry module: the reload guard checks the parent's path, still registered before the lazy imports.
- Manual: previews render at `/__zukan/index.html`; a dev edit reloads the catalog tab once.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project client` and `--project server` exit 0 with the new tests
- [ ] `grep -n 'src="./' packages/svelte-zukan/src/lib/app/Detail.svelte` prints nothing
- [ ] `grep -n "window.top" packages/svelte-zukan/src/lib/vite/virtual.ts` prints nothing
- [ ] Both manual checks done and reverted
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- With the path-based `src`, the preview iframe does not load (blank, or the browser refuses to nest the same URL). Revert Step 2 and report the browser and what it showed.
- In the dev check, previews reload on their own before the catalog page reloads (the guard does not detect the parent). Report it.
- `history.back()` in the test navigates the test runner page away from the app. If so, replace it with `location.hash = '#/'` and say so in the report.

## Maintenance notes

- The reload guard defines "preview" as "my parent is the same page path". If the preview ever moves to a different HTML path, update the guard.
- Path-based preview URLs depend on the catalog being one HTML document; that is already a documented property ("It has only one HTML file").
