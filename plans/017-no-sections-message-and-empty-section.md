# Plan 017: A catalog file without sections says so, and an empty `<Section />` no longer crashes its preview

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/Section.svelte packages/svelte-zukan/src/lib/Section.svelte.test.ts packages/svelte-zukan/src/lib/app/Detail.svelte packages/svelte-zukan/src/lib/app/i18n.ts packages/svelte-zukan/src/lib/app/App.svelte.test.ts docs/content/guides/catalog-files.md docs/content/ja/guides/catalog-files.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW
- Depends on: plans/016-extract-crlf-and-module-alias.md (soft: run after it; no shared files)
- Category: bug
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

A catalog file (`Button.zukan.svelte`) is a Svelte component made of `<Section title="...">` blocks; the detail page shows one preview and one code view per section. Two cases fail silently today:

1. **No sections.** A new user who writes `<Button />` straight into the file, or whose sections were all removed, gets a detail page with only a heading: no preview, no code, no message. The extractor returns `[]` without an error, by design (a file may be work in progress), so the page has to explain it.
2. **An empty section.** `<Section title="TODO" />` (no children) passes every build check, but in dev the preview throws Svelte's `invalid_snippet` error and stays blank. A preview without `?section` loses every section of the file. Compiled with `dev: true`, `{@render children()}` becomes `$.snippet(node, () => $$props.children)`, and Svelte 5.57's `snippet()` calls `e.invalid_snippet()` when the snippet is null in DEV.

## Current state

- `packages/svelte-zukan/src/lib/Section.svelte` — the only public component (`import { Section } from 'svelte-zukan'`):
  ```svelte
  <script lang="ts">
    import { getContext, type Snippet } from 'svelte';
    import { PREVIEW_SECTION_KEY } from './context.js';

    let { title, children }: { title: string; children: Snippet } = $props();

    // no context (outside the catalog, or a preview without ?section) -> always render
    const section = getContext<string | undefined>(PREVIEW_SECTION_KEY);
  </script>

  {#if section === undefined || section === title}
    {@render children()}
  {/if}
  ```
- `packages/svelte-zukan/src/lib/Section.svelte.test.ts` — browser tests with `render(Section, { props: { title: 'A', children } })` and `createRawSnippet`; the pattern for the new test.
- `packages/svelte-zukan/src/lib/app/Detail.svelte:19-34` — the detail page body:
  ```svelte
  {#key entry.path}
    {#await entry.meta() then { default: meta }}
      {#if meta.doc}
        <!-- the HTML comes from the user's own .md file, rendered by the plugin -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="doc">{@html meta.doc}</div>
      {/if}
      {#each meta.sections as section (section.title)}
        <h2>{section.title}</h2>
        <PreviewFrame src="./{formatHash('preview', entry.path, section.title)}" title={section.title} labels={t} />
        <CodeBlock code={section.code} labels={t} />
      {/each}
    {:catch error}
      <p>{t.loadFailed} {error instanceof Error ? error.message : String(error)}</p>
    {/await}
  {/key}
  ```
- `packages/svelte-zukan/src/lib/app/i18n.ts` — the UI dictionary. `Messages` is a type with one key per string, and `messages` has `en` and `ja` objects with the same keys. `i18n.test.ts` fails if the key sets differ or a value is empty. Existing style, e.g. `empty: 'No catalog files found. Searched:'` / `empty: 'カタログファイルが見つかりません。探した場所:'`.
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts` — browser tests of the whole SPA. `setup(hash)` builds one entry `ui/Card` whose `meta()` resolves `{ sections: [], doc: null }`. Tests override `props.catalog[0].meta` to change the metadata (see `a detail page reads the metadata, not the component`, lines 95–103).
- `docs/content/guides/catalog-files.md:43` (and the same paragraph in `docs/content/ja/guides/catalog-files.md:43`) lists which mistakes are build errors.

Project rules that apply (from `AGENTS.md`):

- UI strings come from the two-language dictionary in `i18n.ts`; add every new key to both `en` and `ja`.
- When documenting a feature, update both `docs/content/` and its Japanese mirror `docs/content/ja/`.
- Svelte 5 runes only.

## Commands you will need

| Purpose           | Command (from the repo root)                                                        | Expected on success |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0              |
| Browser tests     | `pnpm --filter svelte-zukan exec vitest run --project client`                       | all pass            |
| Node tests (i18n) | `pnpm --filter svelte-zukan exec vitest run --project server`                       | all pass            |
| Type check        | `pnpm run package && pnpm run check`                                                | exit 0              |
| Docs build        | `pnpm --filter docs build`                                                          | exit 0              |
| Lint              | `pnpm run lint` (fix with `pnpm run format`)                                        | exit 0              |

## Suggested executor toolkit

- If available, use the `svelte:svelte-file-editor` agent or the Svelte MCP `svelte-autofixer` on `Section.svelte` and `Detail.svelte` after editing.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/Section.svelte`
- `packages/svelte-zukan/src/lib/Section.svelte.test.ts`
- `packages/svelte-zukan/src/lib/app/Detail.svelte`
- `packages/svelte-zukan/src/lib/app/i18n.ts`
- `packages/svelte-zukan/src/lib/app/App.svelte.test.ts`
- `docs/content/guides/catalog-files.md`, `docs/content/ja/guides/catalog-files.md`
- `.changeset/no-sections-message.md` (create)

**Out of scope**:

- `src/lib/vite/extract.ts`: an empty file stays valid (no build error and no warning).
- A preview with a `?section=` title that no longer exists (a renamed section): left as is.
- `PreviewFrame.svelte`.

## Git workflow

- Branch: `advisor/017-no-sections-message`
- Conventional Commits, e.g. `fix: allow an empty <Section>`, `fix: explain an empty detail page`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Make `children` optional

In `Section.svelte`, type `children` as `children?: Snippet` and render with `{@render children?.()}`.

Add to `Section.svelte.test.ts`:

```ts
it('renders nothing and does not throw without children', async () => {
  const screen = await render(Section, { props: { title: 'A' } });
  expect(screen.container.textContent).toBe('');
});
```

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client src/lib/Section.svelte.test.ts` → all pass. (Run the new test once before the source change to see it fail with `invalid_snippet`. If it does not fail, note it in your report and continue.)

### Step 2: Add the dictionary entry

In `i18n.ts`, add `noSections: string;` to `Messages`, and:

- `en`: `noSections: 'This file has no <Section>, so there is nothing to preview.'`
- `ja`: `noSections: 'このファイルには <Section> がないため、プレビューするものがありません。'`

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server src/lib/app/i18n.test.ts` → passes.

### Step 3: Show it on the detail page

In `Detail.svelte`, inside `{#await … then}` after the `{#if meta.doc}` block, add:

```svelte
{#if !meta.sections.length}
  <p class="empty">{t.noSections}</p>
{/if}
```

Style `.empty` with `color: var(--_muted);` in the component's `<style>` (the catalog's internal theme variables are defined in `App.svelte`).

Add to `App.svelte.test.ts`:

```ts
it('a file without sections says so', async () => {
  const { props } = setup('#/ui/Card');
  const screen = await render(App, { props });
  await expect
    .element(screen.getByText('This file has no <Section>, so there is nothing to preview.'))
    .toBeInTheDocument();
});

it('a file with sections shows no such message', async () => {
  const { props } = setup('#/ui/Card');
  props.catalog[0].meta = () =>
    Promise.resolve({ default: { sections: [{ title: 'One', code: '<p>one</p>' }], doc: null } });
  const screen = await render(App, { props });
  await expect.element(screen.getByRole('heading', { level: 2, name: 'One' })).toBeInTheDocument();
  await expect.element(screen.getByText(/has no <Section>/)).not.toBeInTheDocument();
});
```

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → all pass.

### Step 4: Document both cases

In `docs/content/guides/catalog-files.md`, after the paragraph at line 43, add:

> A file with no `<Section>` is not an error: its detail page says that there is nothing to preview. A `<Section>` without content renders nothing.

In `docs/content/ja/guides/catalog-files.md`, after line 43:

> `<Section>` が 1 つもないファイルはエラーになりません。詳細ページに、プレビューするものがないと表示します。中身のない `<Section>` は何も表示しません。

**Verify**: `pnpm --filter docs build` → exit 0.

### Step 5: Changeset, type check, lint

Create `.changeset/no-sections-message.md`:

```md
---
'svelte-zukan': patch
---

fix: a catalog file without `<Section>` explains its empty detail page, and a `<Section>` without content no longer throws in dev.
```

**Verify**: `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- `Section.svelte.test.ts`: no children → no throw, empty output.
- `App.svelte.test.ts`: message shown for `sections: []`, absent when there is a section.
- `i18n.test.ts` (existing): both locales have `noSections`.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project client` exits 0 with 3 new tests
- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0
- [ ] `grep -c noSections packages/svelte-zukan/src/lib/app/i18n.ts` prints `3`
- [ ] Both `catalog-files.md` pages mention the empty file
- [ ] `pnpm run package && pnpm run check && pnpm run lint && pnpm --filter docs build` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- svelte-check reports a type error in user-facing types (`dist/Section.svelte.d.ts`) that makes `children` required somewhere else.
- Making `children` optional changes how `<Section title="x">content</Section>` renders (an existing Section or App test fails).
- The empty-section test in Step 1 cannot be made to pass by the source change alone.

## Maintenance notes

- `extract.ts` returning `[]` is now a visible state; plan 016 removes one accidental way to reach it (an alias in `<script module>`).
- If a future change adds a "whole file" preview for files without sections, replace this message rather than adding a second one.
