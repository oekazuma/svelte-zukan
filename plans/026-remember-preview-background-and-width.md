# Plan 026: The preview background and widths survive a reload, and a preview opened in its own tab uses the chosen background

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/components/PreviewFrame/ packages/svelte-zukan/src/lib/app/Preview.svelte docs/content/quickstart.mdx docs/content/ja/quickstart.mdx`
> Plan 025 is expected to have changed the `observe` function in `PreviewFrame.svelte` and added tests to `PreviewFrame.svelte.test.ts`. Any other change in these files is a STOP condition.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: plans/025-preview-height-counts-body-spacing.md (same files; run after it)
- Category: direction (small feature)
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

The catalog's main loop is "edit a `*.zukan.svelte` file, look at the result". Every save of a catalog file or its `.md` reloads the catalog page (the dev server sends the custom event `zukan:reload`, and the page calls `location.reload()`). The preview toolbar's choices are plain in-memory state: the light/dark background shared by all previews, and each preview's width preset. So someone checking a dark, 375 px layout has to pick dark and 375 again after every save. Separately, "Open in new tab" opens the preview page alone. The background is pushed into each iframe by the parent page, so a preview opened alone always shows the app's default background.

Browser storage fits this: it is a per-viewer convenience, it needs no new option (the project keeps its option set small), and losing it is harmless.

## Current state

- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte`:
  - Module script (lines 1–7), state shared by every preview on the page:
    ```svelte
    <script lang="ts" module>
      type Background = 'light' | 'dark';

      // shared by every preview on the page, so one click switches them all
      let background = $state<Background>('light');
      const BACKGROUNDS: Record<Background, string> = { light: '#fff', dark: '#0d1117' };
    </script>
    ```
  - Instance script: props `src`, `title`, `labels`; `let width = $state<number | null>(null);` (`null` = 100%), presets `[375, 768, 1024, 1280]`, keyboard and drag resizing set `width`.
  - Lines 90–95 push the background into the iframe:
    ```ts
    // the preview page has no catalog CSS; `color-scheme` also switches `light-dark()` and form controls in it
    $effect(() => {
      if (!doc) return;
      doc.documentElement.style.colorScheme = background;
      doc.documentElement.style.backgroundColor = BACKGROUNDS[background];
    });
    ```
  - Background buttons: `onclick={() => (background = value)}`.
  - `src` is unique per section (`#/preview/<ID>?section=<title>`, plus `./` until plan 024 lands), so it can key the stored width.
- `packages/svelte-zukan/src/lib/app/Preview.svelte` — the preview page itself (inside an iframe, or alone in a tab). It renders the component inside `<div data-zukan-preview>` and has no background logic.
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts` — browser tests; `the background switch applies to every preview on the page` shows how to click `Dark` and read `iframe.contentDocument.documentElement.style.colorScheme`.
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts` — `setup('#/preview/ui/Card?section=Two')` renders the preview page; `afterEach` resets the hash.
- `docs/content/quickstart.mdx:81` and `docs/content/ja/quickstart.mdx:81` describe the toolbar:

  > - Each section has width presets (or drag the right edge), a light or dark background for every preview at once, and a link that opens the preview alone in a new tab

  > - セクションごとに、幅のプリセット（右端のドラッグでも変えられます）、全プレビューに効くライトとダークの背景の切り替え、プレビューだけを新しいタブで開くリンクがあります

Project rules (from `AGENTS.md`): Svelte 5 runes only; no new dependencies for small things; update both docs locales.

## Commands you will need

| Purpose       | Command (from the repo root)                                                        | Expected on success |
| ------------- | ----------------------------------------------------------------------------------- | ------------------- |
| Install       | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0              |
| Browser tests | `pnpm --filter svelte-zukan exec vitest run --project client`                       | all pass            |
| Type check    | `pnpm run package && pnpm run check`                                                | exit 0              |
| Docs build    | `pnpm --filter docs build`                                                          | exit 0              |
| Lint          | `pnpm run lint` (fix with `pnpm run format`)                                        | exit 0              |

## Suggested executor toolkit

- If available, run the Svelte MCP `svelte-autofixer` on `PreviewFrame.svelte` and `Preview.svelte`.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/components/PreviewFrame/storage.ts` (create)
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte`
- `packages/svelte-zukan/src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts`
- `packages/svelte-zukan/src/lib/app/Preview.svelte`
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
- `docs/content/quickstart.mdx`, `docs/content/ja/quickstart.mdx` (the toolbar bullet only)
- `.changeset/remember-preview-toolbar.md` (create)

**Out of scope**:

- A plugin option for any of this.
- Scroll position after reload.
- Storing anything else (search text, menu state).

## Git workflow

- Branch: `advisor/026-remember-preview-toolbar`
- Conventional Commits, e.g. `feat: remember the preview background and widths across reloads`
- Do not push or open a PR unless told to.

## Steps

### Step 1: A tiny storage module

Create `storage.ts` next to `PreviewFrame.svelte`:

```ts
export type Background = 'light' | 'dark';
export const BACKGROUNDS: Record<Background, string> = { light: '#fff', dark: '#0d1117' };

const BACKGROUND_KEY = 'svelte-zukan:background';
const widthKey = (src: string) => `svelte-zukan:width:${src}`;

// storage can throw (blocked site data, some private modes); the toolbar then just forgets
const tryStorage = <T>(fn: () => T, fallback: T) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** shared by every catalog tab, so a preview opened in its own tab gets it too */
export const readBackground = (): Background | null =>
  tryStorage(() => {
    const value = localStorage.getItem(BACKGROUND_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  }, null);
export const writeBackground = (value: Background) =>
  tryStorage(() => localStorage.setItem(BACKGROUND_KEY, value), undefined);

/** per tab: widths only need to survive the reload after an edit */
export const readWidth = (src: string): number | null =>
  tryStorage(() => {
    const value = Number(sessionStorage.getItem(widthKey(src)));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, null);
export const writeWidth = (src: string, value: number | null) =>
  tryStorage(
    () =>
      value === null ? sessionStorage.removeItem(widthKey(src)) : sessionStorage.setItem(widthKey(src), String(value)),
    undefined
  );
```

Format it with Prettier afterwards (`pnpm run format`).

**Verify**: `pnpm run package && pnpm run check` → exit 0.

### Step 2: Use it in `PreviewFrame.svelte`

1. In the module script, import `BACKGROUNDS`, `readBackground`, `writeBackground`, `readWidth`, `writeWidth` and the `Background` type from `./storage.js` (module-script imports are visible in the instance script). Remove the local `type Background` and `BACKGROUNDS`. Initialise `let background = $state<Background>(readBackground() ?? 'light');`.
2. Background buttons: `onclick={() => { background = value; writeBackground(value); }}`.
3. Instance script: initialise `let width = $state<number | null>(readWidth(src));` (add `// svelte-ignore state_referenced_locally` above it if svelte-check warns that `src` is read once; `src` never changes for a mounted frame, since the detail page recreates frames per entry). Add:
   ```ts
   $effect(() => writeWidth(src, width));
   ```
4. Tests in `PreviewFrame.svelte.test.ts`. Add a **file-level** `beforeEach(() => { localStorage.clear(); sessionStorage.clear(); })`, so no test starts from a width an earlier test stored. Put the new tests in a `describe('PreviewFrame storage')`:
   - Clicking `Dark` writes `localStorage['svelte-zukan:background'] === 'dark'`; clicking `Light` writes `'light'`. Click `Light` at the end so other tests start from light.
   - Clicking `375` writes `sessionStorage['svelte-zukan:width:about:blank'] === '375'`; clicking `100%` removes it.
   - With `sessionStorage['svelte-zukan:width:about:blank'] = '768'` set **before** `render`, the frame starts at `768px` (`frameStyle(screen.container).width`).
   - With `localStorage.setItem` throwing (`vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); })`), clicking `Dark` still switches the previews; restore the spy, then click `Light` so the shared background is light again for later tests.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client src/lib/components/PreviewFrame/PreviewFrame.svelte.test.ts` → all pass.

### Step 3: The preview page applies a stored background

In `Preview.svelte`, read the stored background once and apply it to its own document when one exists:

```ts
// a preview opened in its own tab has no catalog page to set it; inside the catalog, the frame sets the same value
const stored = readBackground();
if (stored) {
  document.documentElement.style.colorScheme = stored;
  document.documentElement.style.backgroundColor = BACKGROUNDS[stored];
}
```

(import from `../components/PreviewFrame/storage.js`). With nothing stored, the page is left to the app's own CSS, as today.

Add to `App.svelte.test.ts`: with `localStorage.setItem('svelte-zukan:background', 'dark')` before rendering `setup('#/preview/ui/Card?section=Two')`, `document.documentElement.style.colorScheme` is `dark` after the preview renders. Afterwards remove the key and reset `document.documentElement.style.colorScheme = ''` and `backgroundColor = ''` (in a `finally`), so other tests are unaffected.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → all pass.

### Step 4: Docs and changeset

Append to the toolbar bullet in `docs/content/quickstart.mdx:81`: `. The background and the widths are remembered in this browser across reloads`. Match the punctuation of the surrounding bullets (they have no final period). Japanese, `docs/content/ja/quickstart.mdx:81`: append `。背景と幅は、再読み込みしてもこのブラウザーで保たれます` (no final `。`, like the neighbours).

Create `.changeset/remember-preview-toolbar.md`:

```md
---
'svelte-zukan': minor
---

feat: the preview background and each preview's width are remembered across reloads, and a preview opened in its own tab uses the chosen background.
```

**Verify**: `pnpm --filter docs build` → exit 0; `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

### Step 5: Manual check

`pnpm --filter svelte-zukan dev`, open `/__zukan/#/ui/components/Badge`, choose `Dark` and `375`, then edit `packages/svelte-zukan/src/lib/components/Badge/Badge.zukan.md` (add a word). After the page reloads, `Dark` and `375` are still selected. Click "Open in new tab": the preview has the dark background. Revert the `.md` edit.

**Verify**: `git status` shows no change to `Badge.zukan.md`.

## Test plan

- Storage writes for background (local) and width (session), including removal at 100%.
- A stored width is used at mount.
- Storage that throws does not break the toolbar.
- The standalone preview page applies a stored background.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project client` exits 0 with the new tests
- [ ] `grep -rn "localStorage\|sessionStorage" packages/svelte-zukan/src/lib --include=*.svelte --include=*.ts | grep -v test` lists only `storage.ts`
- [ ] Both quickstart pages mention that the choices are remembered
- [ ] Manual check done and reverted
- [ ] `pnpm run package && pnpm run check && pnpm run lint && pnpm --filter docs build` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- svelte-check or the Svelte compiler rejects reading storage in a module script (`<script module>`) during the library build (`pnpm run package`): report the message.
- Any existing PreviewFrame test fails because state now persists between tests through storage, and clearing storage in `beforeEach` does not fix it.

## Maintenance notes

- Keys are namespaced `svelte-zukan:`; all catalogs on one origin share the background, which is intended.
- Width keys include the full `src`, so renaming a section simply forgets its width.
- If plan 027 (section links) or later work changes the preview `src` format, stored widths are forgotten once; nothing breaks.
