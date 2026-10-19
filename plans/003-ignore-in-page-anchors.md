# Plan 003: In-page anchors inside a preview or a doc no longer replace the catalog view

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/app/App.svelte packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW
- Depends on: none
- Category: bug
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

The catalog is a hash-routed SPA: `#/<ID>` is a detail page, `#/preview/<ID>?section=<title>` is the preview page loaded in each iframe, and an empty hash is the list. The app follows every `hashchange`. A user component in a preview with a link such as `<a href="#">` or `<a href="#details">` (very common in UI examples) changes the iframe's hash. The iframe then renders the full catalog UI (sidebar plus "Not found", or the list) inside the preview. A `[see below](#usage)` link in a `.zukan.md` doc does the same to the whole catalog page. After this plan, hashes that are not catalog routes are ignored, and inside a preview only preview routes are followed.

## Current state

- `packages/svelte-zukan/src/lib/app/App.svelte` (Svelte 5 runes):
  ```svelte
    let hash = $state(location.hash);

    const t = $derived(messages[locale]);
    const route = $derived(parseHash(hash));
    const entry = $derived(route.view === 'list' ? undefined : catalog.find((e) => e.path === route.path));
  </script>

  <svelte:window onhashchange={() => (hash = location.hash)} />
  ```
  (lines 27–34). `{#if route.view === 'preview'}` renders `<Preview>` only; otherwise it renders the sidebar and `<main>`.
- `packages/svelte-zukan/src/lib/app/hash.ts` — `parseHash(hash)` strips a leading `#/` or `#`. `''` and `'#/'` parse to `{ view: 'list' }`. Anything else that does not start with `preview/` parses to `{ view: 'detail', path }`, so `'#usage'` becomes the detail page for ID `usage`. Leave this file unchanged: its tests (`hash.test.ts`) pin that behaviour.
- Route hashes produced by the app always start with `#/`: see `formatHash` in `hash.ts:30-33`, and the logo link `href="#/"` in `Sidebar.svelte:38`.
- An empty hash must keep meaning "list": with the browser's back button from `#/ui/Card` to the initial `/__zukan/`, `location.hash` becomes `''`, and the list must show.
- Tests: `packages/svelte-zukan/src/lib/app/App.svelte.test.ts` (Vitest browser mode, Chromium). Pattern to copy, from the existing `'follows hashchange'` test:
  ```ts
  it('follows hashchange', async () => {
    const { props } = setup('');
    const screen = await render(App, { props });
    location.hash = '#/ui/Card';
    await expect.element(screen.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  });
  ```
  and `'a preview renders only the section inside the wrapper'`, which renders `setup('#/preview/ui/Card?section=Two')` and expects `screen.getByTestId('wrapper').getByText('two')`. `Catalog.test.svelte` has sections `One` (`<p>one</p>`) and `Two` (`<p>two</p>`).
- Conventions: Svelte 5 runes only, no `$:`. Comments only for a non-obvious WHY.

## Commands you will need

| Purpose           | Command                                                                                      | Expected on success |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`                                                                               | exit 0              |
| Chromium (once)   | `pnpm --filter svelte-zukan exec playwright install chromium`                                | exit 0              |
| App tests         | `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/App.svelte.test.ts` | all pass            |
| All library tests | `pnpm --filter svelte-zukan exec vitest run`                                                 | all pass            |
| Typecheck         | `pnpm run package && pnpm run check`                                                         | exit 0              |
| Lint              | `pnpm run format && pnpm run lint`                                                           | exit 0              |

## Suggested executor toolkit

- If available, use the `svelte:svelte-file-editor` agent or the Svelte MCP `svelte-autofixer` on `App.svelte` after editing.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/app/App.svelte`
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
- `.changeset/ignore-in-page-anchors.md` (create)

**Out of scope**:

- `hash.ts` and `hash.test.ts`.
- Scrolling or focus after navigation. Plan 011 handles that and edits the same handler afterwards.
- Making anchors in `.zukan.md` docs scroll to headings (`marked` emits no heading ids).

## Git workflow

- Branch: `advisor/003-ignore-in-page-anchors`
- One commit, for example `fix: ignore in-page anchors inside previews and docs`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Write the failing tests

Add three tests to the `describe('App')` block in `App.svelte.test.ts`:

1. `'a preview ignores hashes that are not preview routes'`: `setup('#/preview/ui/Card?section=Two')`, render, and wait for `screen.getByTestId('wrapper').getByText('two')`. Then for each of `'#'`, `'#details'` and `'#/ui/Card'`: wait for the change to be handled (`const changed = new Promise((r) => addEventListener('hashchange', r, { once: true }));`, then set `location.hash`, then `await changed; await tick();` with `tick` from `svelte`; a negative assertion needs the event to have run, and a 0 ms timer does not guarantee that), and assert `screen.getByTestId('wrapper').getByText('two')` is still in the document and `screen.container.querySelector('nav')` is `null`.
2. `'a detail page ignores in-page anchors'`: `setup('#/ui/Card')`, render, wait for the `Card` heading. Set `location.hash = '#usage'` with the same `changed` / `tick()` wait as test 1, and assert the level-1 heading named `/Card/` is still there (not `'Not found'`).
3. `'an empty hash still shows the list'`: `setup('#/ui/Card')`, render, wait for the `Card` heading. Set `location.hash = ''` and assert the level-1 heading `'Components'` appears.

**Verify**: run the App tests → tests 1 and 2 fail, test 3 passes.

### Step 2: Filter hash changes in `App.svelte`

Replace the inline handler with a function in the instance script:

```ts
// components in a preview and links in a doc can change the hash too; only catalog routes navigate
function onhashchange() {
  const next = location.hash;
  if (next !== '' && !next.startsWith('#/')) return;
  if (route.view === 'preview' && parseHash(next).view !== 'preview') return;
  hash = next;
}
```

and use `<svelte:window {onhashchange} />`.

**Verify**: the App tests → all pass, including the three new ones and `'follows hashchange'`.

### Step 3: Changeset

Create `.changeset/ignore-in-page-anchors.md`:

```md
---
'svelte-zukan': patch
---

fix: links such as `href="#"` inside a previewed component, or anchors in a `.zukan.md` doc, no longer replace the preview or the page with the catalog UI.
```

**Verify**: `pnpm run format && pnpm run lint` → exit 0.

## Test plan

Three new browser tests in `App.svelte.test.ts` (Step 1). Every existing App test must still pass, especially `'follows hashchange'`, `'uses the Japanese dictionary'` (it sets `#/ui/Nope`) and the narrow-screen menu test (it clicks entry links).

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0, with the 3 new tests
- [ ] `pnpm run package && pnpm run check` exits 0
- [ ] `pnpm run lint` exits 0
- [ ] `.changeset/ignore-in-page-anchors.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- Setting `location.hash = ''` in the test does not fire `hashchange`, or leaves `'#'` in `location.hash` (Step 2 assumes `''`). Report what `location.hash` holds.
- An existing App test fails after Step 2 and the cause is not obvious.

## Maintenance notes

- Any new route the app links to must start with `#/`, or this filter drops it.
- Plan 011 adds scroll-to-top to this same handler. Keep the filter at the top of the function.
