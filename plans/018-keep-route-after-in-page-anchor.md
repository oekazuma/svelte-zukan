# Plan 018: Reloading after an in-page anchor keeps the catalog page that was open

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/app/App.svelte packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW
- Depends on: none
- Category: bug
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

The catalog is a hash-routed SPA: `#/<ID>` is a detail page and `#/preview/<ID>?section=<title>` is a preview (the page each preview iframe loads, and the page "Open in new tab" opens). Components inside a preview, and links inside a rendered `.md` doc, can change the hash too (`<a href="#">`, tabs with `href="#panel-2"`). `App.svelte` already ignores such hash changes while the page is open. But the URL keeps the foreign hash, and on load the app parses `location.hash` without that filter. So after clicking `<a href="#">` in a preview opened in its own tab, the next catalog edit (which reloads that tab through the `zukan:reload` event) or a manual reload shows the component list instead of the preview. After clicking `#usage` in a doc, a reload shows "Not found". Sharing the URL has the same result.

## Current state

- `packages/svelte-zukan/src/lib/app/App.svelte:27-41`:
  ```svelte
    let hash = $state(location.hash);

    const t = $derived(messages[locale]);
    const route = $derived(parseHash(hash));
    const entry = $derived(route.view === 'list' ? undefined : catalog.find((e) => e.path === route.path));

    // components in a preview and links in a doc can change the hash too; only catalog routes navigate
    function onhashchange() {
      const next = location.hash;
      if (next !== '' && !next.startsWith('#/')) return;
      if (route.view === 'preview' && parseHash(next).view !== 'preview') return;
      hash = next;
      // the browser keeps the scroll position on a hash change; the previous page's position means nothing on the next
      if (route.view !== 'preview') tick().then(() => scrollTo(0, 0));
    }
  ```
  `<svelte:window {onhashchange} />` is at line 44.
- `packages/svelte-zukan/src/lib/app/hash.ts` — `parseHash('#details')` returns `{ view: 'detail', path: 'details' }`; `parseHash('')` returns `{ view: 'list' }`. Do not change it.
- `packages/svelte-zukan/src/lib/vite/virtual.ts:32` — the generated entry reloads a top-level catalog tab on `zukan:reload` (`location.reload()`); not in scope, listed so you know why a reload happens in dev.
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts` — browser tests. Patterns to reuse:
  - `setup(hash)` sets `location.hash` and returns `props`; `render(App, { props })` mounts it.
  - `setHash(hash)` (lines 10–16) changes the hash and waits for the `hashchange` to be handled.
  - `afterEach` (lines 33–35) runs `history.replaceState(null, '', location.pathname + location.search)`, which also clears `history.state` between tests.
  - Existing tests `a preview ignores hashes that are not preview routes` (lines 112–121) and `a detail page ignores in-page anchors` (lines 123–129) cover the live case.

## Commands you will need

| Purpose           | Command (from the repo root)                                                                 | Expected on success |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium`          | exit 0              |
| App tests         | `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/App.svelte.test.ts` | all pass            |
| All browser tests | `pnpm --filter svelte-zukan exec vitest run --project client`                                | all pass            |
| Type check        | `pnpm run package && pnpm run check`                                                         | exit 0              |
| Lint              | `pnpm run lint` (fix with `pnpm run format`)                                                 | exit 0              |

## Suggested executor toolkit

- If available, run the Svelte MCP `svelte-autofixer` on `App.svelte` after editing.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/app/App.svelte`
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
- `.changeset/keep-route-after-anchor.md` (create)

**Out of scope**:

- Rewriting the URL back to the catalog route (`history.replaceState` with a URL): that would break the component's own anchor and `:target` behaviour. Only `history.state` is used.
- `hash.ts`, `virtual.ts`, `Preview.svelte`.
- A URL that already has a foreign hash when first opened (for example a shared `…/#usage` with no history state): it keeps showing "Not found". There is nothing to recover it from.

## Git workflow

- Branch: `advisor/018-keep-route-after-anchor`
- Conventional Commits, e.g. `fix: keep the catalog page when reloading after an in-page anchor`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Add failing tests

In `App.svelte.test.ts`, inside `describe('App')`, add:

```ts
it.each(['#details', '#'])('a reload after %s in a preview shows the preview again', async (hash) => {
  const { props } = setup('#/preview/ui/Card?section=Two');
  const first = await render(App, { props });
  await expect.element(first.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
  // the app must be mounted while the hash changes, as on a real page
  await setHash(hash);
  await first.unmount();
  // a reload mounts the app again with the same URL and history entry
  const again = await render(App, { props });
  await expect.element(again.getByTestId('wrapper').getByText('two')).toBeInTheDocument();
});

it('a reload after an in-page anchor in a doc shows the detail page again', async () => {
  const { props } = setup('#/ui/Card');
  const first = await render(App, { props });
  await expect.element(first.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
  await setHash('#usage');
  await first.unmount();
  const again = await render(App, { props });
  await expect.element(again.getByRole('heading', { level: 1, name: /Card/ })).toBeInTheDocument();
});
```

`render` from the installed `vitest-browser-svelte` (2.2.1) returns `unmount()`, which returns a promise: always `await` it. Each case changes the hash while an App is mounted, since only a mounted App can record the route.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/App.svelte.test.ts` → the new tests (three cases) fail (the list or "Not found" is shown); every other test passes.

### Step 2: Remember the catalog route in the history entry

In `App.svelte`:

1. Add a small helper above `let hash`:
   ```ts
   // an ignored hash stays in the URL; the history entry keeps the catalog route so a reload can return to it
   const KEY = 'zukanHash';
   const remembered = () => {
     const state = history.state as Record<string, unknown> | null;
     return typeof state?.[KEY] === 'string' ? (state[KEY] as string) : null;
   };
   ```
2. Initialise with `let hash = $state(remembered() ?? location.hash);`.
3. In `onhashchange`, turn the two early `return`s into one branch that first stores the current catalog hash in the new history entry, without changing its URL:
   ```ts
   const next = location.hash;
   const foreign =
     (next !== '' && !next.startsWith('#/')) || (route.view === 'preview' && parseHash(next).view !== 'preview');
   if (foreign) {
     const state = typeof history.state === 'object' && history.state ? history.state : {};
     history.replaceState({ ...state, [KEY]: hash }, '');
     return;
   }
   ```
   Keep the rest of the function as it is. Keep or adapt the existing comment above the function.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client src/lib/app/App.svelte.test.ts` → all pass, including `follows hashchange`, `an empty hash still shows the list` (an empty hash on a detail page is still a catalog route: the list) and the two existing "ignores" tests.

### Step 3: Check Back and Forward by hand (optional but recommended)

With `pnpm --filter svelte-zukan dev`, open `/__zukan/`, go to a detail page whose `.md` has an in-page link (or add `<a href="#x">x</a>` temporarily to `packages/svelte-zukan/src/lib/components/Badge/Badge.zukan.md` and revert it afterwards), click it, reload: the detail page stays. Press Back: the page stays the same detail page. Do not commit the temporary edit.

**Verify**: `git status` shows no change to `Badge.zukan.md`.

### Step 4: Changeset, checks

Create `.changeset/keep-route-after-anchor.md`:

```md
---
'svelte-zukan': patch
---

fix: reloading the catalog after following an in-page anchor in a preview or a doc shows the same page again.
```

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → all pass; `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- Preview, then `#details` and `#`, then re-mount: the preview is shown.
- Detail, then `#usage`, then re-mount: the detail page is shown.
- Existing tests: hashchange navigation, ignored anchors, empty hash → list, scroll to top.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project client` exits 0 with 3 new test cases
- [ ] `grep -n "replaceState" packages/svelte-zukan/src/lib/app/App.svelte` prints one line, and it passes `''` with no URL argument
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- An existing App test fails after Step 2 and the fix would change `parseHash` or the routing rules.
- The re-mount approach in Step 1 cannot reproduce the bug (the new tests pass before Step 2). Report what the test showed.
- You find that a preview component's own code reads `history.state` in a way this change breaks (for example a test in the repo that asserts `history.state` is `null`).

## Maintenance notes

- `history.state[zukanHash]` is the only state the catalog writes. Any future routing change (for example plan 027, section links on the detail page) must keep reading `remembered()` first on init.
- The stored value is a catalog hash, never a URL; it is only used as the initial `hash`, so it cannot navigate anywhere the catalog would not.
