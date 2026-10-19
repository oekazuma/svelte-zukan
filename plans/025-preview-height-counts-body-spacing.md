# Plan 025: A preview iframe's height includes the page's body spacing and a horizontal scrollbar

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/components/PreviewFrame/ packages/svelte-zukan/src/lib/app/Preview.svelte`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P3
- Effort: S
- Risk: MED
- Depends on: none
- Category: bug
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

Each section of a catalog entry is previewed in a same-origin iframe whose height follows its content. The height is measured from the wrapper element `[data-zukan-preview]` only. The catalog sets `body { margin: 0 }`, but the user's wrapper component (an option that wraps every preview, often importing the app's global CSS) loads later and can set `body { padding: 1rem }` or a margin. That spacing is not counted, so every preview gets an inner vertical scrollbar and is cut off by twice the spacing. Content wider than the frame (for example at the 375 px width preset) adds a horizontal scrollbar. On systems with classic scrollbars, its height is not counted either, which adds a vertical scrollbar too. The audit read this from the code and did not run it, so Step 1 reproduces it first.

The risk is MED because changing the measurement can bring back a growth loop: content with `min-height: 100vh` grows with the iframe. The current code already measures that element, so the loop does not get worse as long as the new measurement is "the element plus fixed spacing". Step 3 checks this.

## Current state

- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte:74-88`:
  ```ts
  // the preview mounts after the iframe's load event, so watch the body and pick up the wrapper element when it appears
  function observe(doc: Document) {
    observer?.disconnect();
    let target: Element | null = null;
    observer = new ResizeObserver(() => {
      const found = doc.querySelector('[data-zukan-preview]');
      if (!found) return;
      if (found !== target) {
        target = found;
        observer!.observe(found);
      }
      height = Math.max(MIN_HEIGHT, found.getBoundingClientRect().height);
    });
    observer.observe(doc.body);
  }
  ```
  `MIN_HEIGHT` is 80. `height` is a `$state` applied as `style:height="{height}px"` on the `<iframe>`.
- `packages/svelte-zukan/src/lib/app/Preview.svelte:37-41` — the wrapper element is `display: flow-root`, which keeps child margins inside it:
  ```css
  /* keeps child margins inside, so the measured height covers them */
  div {
    display: flow-root;
  }
  ```
- `packages/svelte-zukan/src/lib/app/App.svelte:74-77`: `:global(body) { margin: 0; }` (the catalog's own rule, also loaded in the preview page).
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts:111-121` — the pattern for the new tests:
  ```ts
  it('height follows the preview', async () => {
    const screen = await render(PreviewFrame, { props });
    const iframe = screen.container.querySelector('iframe')!;
    await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
    const doc = iframe.contentDocument!;
    const target = doc.createElement('div');
    target.setAttribute('data-zukan-preview', '');
    target.style.height = '300px';
    doc.body.append(target);
    await expect.poll(() => iframe.style.height).toBe('300px');
  });
  ```
  `props` is `{ src: 'about:blank', title: 'preview' }`, so the iframe document is a blank same-origin page the test can write into.

## Commands you will need

| Purpose           | Command (from the repo root)                                                                                              | Expected on success |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium`                                       | exit 0              |
| This file's tests | `pnpm --filter svelte-zukan exec vitest run --project client src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts` | all pass            |
| All browser tests | `pnpm --filter svelte-zukan exec vitest run --project client`                                                             | all pass            |
| Type check        | `pnpm run package && pnpm run check`                                                                                      | exit 0              |
| Lint              | `pnpm run lint` (fix with `pnpm run format`)                                                                              | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte` (the `observe` function only)
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts`
- `.changeset/preview-height-body-spacing.md` (create)

**Out of scope**:

- Absolutely positioned overflow (dropdowns, popovers) that extends past the wrapper: measuring it needs a different approach. Leave it.
- Creating the `ResizeObserver` from the iframe's own window (`doc.defaultView.ResizeObserver`): a Firefox/Safari question that is not verified.
- `Preview.svelte` and `App.svelte` CSS.

## Git workflow

- Branch: `advisor/025-preview-height-body-spacing`
- Conventional Commits, e.g. `fix: count body spacing and a horizontal scrollbar in the preview height`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Reproduce with tests

Add to `describe('PreviewFrame resizing')`:

```ts
it('height includes the body padding and margin of the preview page', async () => {
  const screen = await render(PreviewFrame, { props });
  const iframe = screen.container.querySelector('iframe')!;
  await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
  const doc = iframe.contentDocument!;
  doc.body.style.margin = '8px';
  doc.body.style.padding = '16px';
  const target = doc.createElement('div');
  target.setAttribute('data-zukan-preview', '');
  target.style.height = '300px';
  doc.body.append(target);
  await expect.poll(() => iframe.style.height).toBe('348px');
  const scroller = doc.scrollingElement!;
  expect(scroller.scrollHeight).toBeLessThanOrEqual(scroller.clientHeight);
});

it('height includes a horizontal scrollbar', async () => {
  const screen = await render(PreviewFrame, { props });
  screen.container.style.width = '400px';
  const iframe = screen.container.querySelector('iframe')!;
  await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
  const doc = iframe.contentDocument!;
  const target = doc.createElement('div');
  target.setAttribute('data-zukan-preview', '');
  target.style.cssText = 'height: 300px; width: 2000px';
  doc.body.append(target);
  const win = doc.defaultView!;
  await expect.poll(() => win.innerHeight - doc.documentElement.clientHeight).toBeGreaterThanOrEqual(0);
  await expect.poll(() => doc.documentElement.scrollHeight <= doc.documentElement.clientHeight).toBe(true);
});
```

348 = 300 + 2×16 (padding) + 2×8 (margin).

Also add the `min-height: 100vh` test from Step 3 now, so its result on the old code is known.

**Verify**: run this file's tests → the first new test fails (height stays `300px`). Note whether the second and the 100vh test fail. If headless Chromium uses overlay scrollbars (`win.innerHeight - doc.scrollingElement.clientHeight` is `0` with the wide content), the second test passes before and after: keep it as a guard and say so in your report.

### Step 2: Measure from the top of the document to the bottom of the body box

Replace the height line in `observe` with a measurement that covers the wrapper's position plus the body's bottom spacing and a horizontal scrollbar:

```ts
const win = doc.defaultView!;
const body = win.getComputedStyle(doc.body);
// the app's CSS (loaded by the wrapper) may pad the body; a horizontal scrollbar takes height too
const bottom = found.getBoundingClientRect().bottom + win.scrollY;
const spacing = parseFloat(body.paddingBottom) + parseFloat(body.marginBottom);
// scrollingElement: in quirks mode (an about:blank test page) documentElement.clientHeight is the content height
const scrollbar = win.innerHeight - (doc.scrollingElement ?? doc.documentElement).clientHeight;
height = Math.max(MIN_HEIGHT, Math.ceil(bottom + spacing + scrollbar));
```

`bottom` already includes the top margin and padding, because the wrapper's top edge sits below them.

The test iframes load `about:blank`, whose body has the browser's default `margin: 8px` (the real preview page has `margin: 0` from the catalog's CSS). With the new formula, the existing `height follows the preview` test would measure `316px`. Add `doc.body.style.margin = '0';` to that test, next to the other `doc` setup, so it keeps expecting `300px` and matches the real page.

**Verify**: run this file's tests → all pass, including `height follows the preview` (`300px`).

### Step 3: Check that 100vh content does not grow without bound

Add a test:

```ts
it('content with min-height: 100vh does not keep growing', async () => {
  const screen = await render(PreviewFrame, { props });
  const iframe = screen.container.querySelector('iframe')!;
  await expect.poll(() => iframe.contentDocument?.readyState).toBe('complete');
  const doc = iframe.contentDocument!;
  const target = doc.createElement('div');
  target.setAttribute('data-zukan-preview', '');
  target.style.minHeight = '100vh';
  doc.body.append(target);
  await new Promise((r) => setTimeout(r, 500));
  const first = parseFloat(iframe.style.height);
  await new Promise((r) => setTimeout(r, 500));
  expect(parseFloat(iframe.style.height)).toBe(first);
});
```

To know whether the old code was stable, write this test **before** Step 2 (add it in Step 1 and note its result), then run it again now.

**Verify**: with Step 2 applied, the test passes. If it passed in Step 1 and fails now, see STOP conditions.

### Step 4: Changeset, checks

Create `.changeset/preview-height-body-spacing.md`:

```md
---
'svelte-zukan': patch
---

fix: a preview's height includes the body padding and margin set by the app's CSS, and a horizontal scrollbar.
```

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → all pass; `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- Body padding and margin are included (fails before the fix).
- A horizontal scrollbar does not cause an inner vertical scrollbar.
- `min-height: 100vh` content settles at a fixed height.
- Existing: `height follows the preview`.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project client` exits 0 with 3 new tests
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- The 100vh test passes on the old code and fails with Step 2: the new measurement creates a growth loop. Revert Step 2 and report the heights you saw.
- The padding test still fails after Step 2 with a different value: report the value. Do not tune numbers to match.
- `doc.defaultView` is `null` at measurement time in any test.
- `doc.scrollingElement` is `null` in a test document.

## Maintenance notes

- The measurement assumes the wrapper is the last thing in the body. Content placed after `[data-zukan-preview]` by the app (for example portals appended to `body`) is still not counted. That is the absolutely-positioned case left out of scope.
- If the observer moves to the iframe's own window, keep this measurement function as it is.
