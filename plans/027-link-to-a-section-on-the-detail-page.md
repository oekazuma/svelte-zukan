# Plan 027: A detail-page URL can point at one section (`#/<ID>?section=<title>`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/app/ docs/content/guides/catalog-ids.md docs/content/ja/guides/catalog-ids.md`
> Expected earlier changes in `src/lib/app/`: plan 017 (`Detail.svelte` `noSections`, `i18n.ts`), plan 018 (`App.svelte` `remembered()` and `replaceState`), plan 024 (`Detail.svelte` path-based preview `src`, `Sidebar.svelte`), plan 026 (`Preview.svelte`), and their tests. Compare the excerpts below with the live code; re-apply the steps to the live shape of `onhashchange` and `Detail.svelte`. If `hash.ts` changed, STOP.

## Status

- Priority: P3
- Effort: S
- Risk: LOW
- Depends on: plans/018 and plans/024 (same files; run after them)
- Category: direction (small feature)
- Planned at: commit `293f5a4`, 2026-10-20

## Why this matters

The catalog is pitched for reviewing examples in pull requests and publishing them as a static site. A reviewer can share a whole detail page (`#/<ID>`) or a bare preview without docs or code (`#/preview/<ID>?section=<title>`), but not "the Disabled section of Button, with its code". In-page anchors cannot help: the hash router owns the hash. The router already parses a `?section=` query for previews, so the same query on a detail URL is a backward-compatible extension. Old detail URLs keep working, and today a `?section=` on a detail URL is dropped. No option is needed.

## Current state

- `packages/svelte-zukan/src/lib/app/hash.ts` (33 lines):
  ```ts
  export type Route =
    { view: 'list' } | { view: 'detail'; path: string } | { view: 'preview'; path: string; section: string | null };
  // …
  /** `#/<ID>` or `#/preview/<ID>?section=<title>`; IDs encode `?` per segment, so the first `?` starts the query */
  export function parseHash(hash: string): Route {
    const raw = hash.replace(/^#\/?/, '');
    const q = raw.indexOf('?');
    const rawPath = q === -1 ? raw : raw.slice(0, q);
    if (rawPath.startsWith(PREVIEW)) {
      const section = q === -1 ? null : new URLSearchParams(raw.slice(q + 1)).get('section');
      return { view: 'preview', path: rawPath.slice(PREVIEW.length).split('/').map(decode).join('/'), section };
    }
    const path = rawPath.split('/').map(decode).join('/');
    return path ? { view: 'detail', path } : { view: 'list' };
  }

  export function formatHash(view: 'detail' | 'preview', path: string, section?: string): string {
    if (view === 'detail') return `#/${encodePath(path)}`;
    return `#/${PREVIEW}${encodePath(path)}${section === undefined ? '' : `?section=${encodeURIComponent(section)}`}`;
  }
  ```
- `packages/svelte-zukan/src/lib/app/hash.test.ts` — `parseHash`/`formatHash` unit tests (node). Several assert `{ view: 'detail', path }` with `toEqual`; those change to include `section: null`.
- `packages/svelte-zukan/src/lib/app/App.svelte` — at `293f5a4` (plan 018 has since added `remembered()` and a `replaceState` branch):
  ```svelte
    function onhashchange() {
      // …foreign-hash checks…
      hash = next;
      // the browser keeps the scroll position on a hash change; the previous page's position means nothing on the next
      if (route.view !== 'preview') tick().then(() => scrollTo(0, 0));
    }
  ```
  and the detail render: `<Detail {entry} {t} />`.
- `packages/svelte-zukan/src/lib/app/Detail.svelte` — at `293f5a4`, lines 26–30:
  ```svelte
  {#each meta.sections as section (section.title)}
    <h2>{section.title}</h2>
    <PreviewFrame src="./{formatHash('preview', entry.path, section.title)}" title={section.title} labels={t} />
    <CodeBlock code={section.code} labels={t} />
  {/each}
  ```
  The whole body is inside `{#key entry.path}`, so moving between sections of the same entry does not remount it.
- `packages/svelte-zukan/src/lib/app/Sidebar.svelte`, `components/EntryList.svelte` link with `formatHash('detail', path)` (no section); they stay as they are.
- `docs/content/guides/catalog-ids.md:9-13` and `docs/content/ja/guides/catalog-ids.md:9-13` — the URL table (quoted in Step 4).
- Svelte: the peer range is `svelte ^5.20.0`. Do **not** use attachments (`{@attach}`, Svelte 5.29+). Use an action (`use:`), which works in every Svelte 5.

## Commands you will need

| Purpose           | Command (from the repo root)                                                        | Expected on success |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------- |
| Install           | `pnpm install`; once: `pnpm --filter svelte-zukan exec playwright install chromium` | exit 0              |
| Node tests (hash) | `pnpm --filter svelte-zukan exec vitest run --project server`                       | all pass            |
| Browser tests     | `pnpm --filter svelte-zukan exec vitest run --project client`                       | all pass            |
| Type check        | `pnpm run package && pnpm run check`                                                | exit 0              |
| Docs build        | `pnpm --filter docs build`                                                          | exit 0              |
| Lint              | `pnpm run lint` (fix with `pnpm run format`)                                        | exit 0              |

## Suggested executor toolkit

- If available, run the Svelte MCP `svelte-autofixer` on `Detail.svelte` and `App.svelte`.

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/app/hash.ts`, `hash.test.ts`
- `packages/svelte-zukan/src/lib/app/App.svelte`, `App.svelte.test.ts`
- `packages/svelte-zukan/src/lib/app/Detail.svelte`
- `docs/content/guides/catalog-ids.md`, `docs/content/ja/guides/catalog-ids.md`
- `.changeset/section-links.md` (create)

**Out of scope**:

- A "copy link" button or icon (needs new UI strings; the heading itself becomes the link).
- Sidebar/search changes.
- The preview route.

## Git workflow

- Branch: `advisor/027-section-links`
- Conventional Commits, e.g. `feat: link to a section of a detail page`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Parse and format the detail section

1. Change `Route`'s detail member to `{ view: 'detail'; path: string; section: string | null }`.
2. In `parseHash`, compute `section` from the query the same way for both views (move the `URLSearchParams` line above the `if`), and return it for detail too.
3. Let `formatHash('detail', path, section)` append `?section=…` when `section` is given, exactly like the preview branch. Update the doc comment to list `#/<ID>?section=<title>`.
4. In `hash.test.ts`, update the detail `toEqual` expectations to include `section: null`, and add: `formatHash('detail', 'ui/Card', 'a b?c')` round-trips to `{ view: 'detail', path: 'ui/Card', section: 'a b?c' }`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server src/lib/app/hash.test.ts` → all pass; `pnpm run package && pnpm run check` → exit 0 (fix any type error where a detail `Route` is built).

### Step 2: Headings link to themselves, and the requested one scrolls into view

In `Detail.svelte`:

1. Add a prop `section: string | null` (default `null`).
2. Add an action in the instance script:
   ```ts
   // the detail page is not remounted when only the section changes, so the action also runs on update
   function reveal(node: HTMLElement, active: boolean) {
     if (active) node.scrollIntoView();
     return { update: (next: boolean) => next && node.scrollIntoView() };
   }
   ```
3. Render each heading as a link to itself:
   ```svelte
   <h2 use:reveal={section === s.title}><a href={formatHash('detail', entry.path, s.title)}>{s.title}</a></h2>
   ```
   Rename the `{#each}` item from `section` to `s` (or similar) so it does not shadow the prop. Update every use inside the block: the key expression `(section.title)` becomes `(s.title)`, and the `PreviewFrame`/`CodeBlock` lines use `s` too.
4. Style `h2 a` to look like the heading: `color: inherit; text-decoration: none;` and `text-decoration: underline` on `:hover` / `:focus-visible`.

In `App.svelte`:

1. Pass the section: `<Detail {entry} section={route.view === 'detail' ? route.section : null} {t} />`.
2. Scroll to the top only when no section is requested (accepted limitation: opening another entry with a `?section=` that does not exist keeps the previous scroll position):
   ```ts
   if (route.view === 'list' || (route.view === 'detail' && route.section === null)) tick().then(() => scrollTo(0, 0));
   ```
   Keep the existing comment.

**Verify**: `pnpm run package && pnpm run check` → exit 0.

### Step 3: Browser tests

In `App.svelte.test.ts`, with metadata `{ sections: [{ title: 'One', code: '<p>1</p>' }, { title: 'Two', code: '<p>2</p>' }], doc: null }` (override `props.catalog[0].meta` as in `a detail page reads the metadata, not the component`):

- The heading `Two` contains a link with `toHaveAttribute('href', '#/ui/Card?section=Two')` (the attribute, not the `.href` property, which is absolute).
- `setup('#/ui/Card?section=Two')`: `vi.spyOn(Element.prototype, 'scrollIntoView')` before rendering; after the headings appear, it was called with the `h2` whose text is `Two` as `this` (check `spy.mock.contexts`). Restore the spy.
- From `#/ui/Card`, `location.hash = '#/ui/Card?section=One'` scrolls `One` into view without remounting: keep a reference to the `One` heading element before the hash change, and after it assert the spy was called once more and the heading is the same node (`toBe`).
- An unknown section (`?section=Nope`) shows the page and calls no `scrollIntoView`.

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project client` → all pass, including `navigating scrolls back to the top`.

### Step 4: Docs

Add a row to the table in `docs/content/guides/catalog-ids.md` after the detail row, and re-align the table (`pnpm run format` does it):

| `/__zukan/#/<ID>?section=<title>` | Detail page, scrolled to that section |

Japanese table in `docs/content/ja/guides/catalog-ids.md`:

| `/__zukan/#/<ID>?section=<title>` | 詳細ページ（そのセクションまでスクロール） |

Below the table in both pages, add one sentence. English: `Each section heading on a detail page links to that section, so you can share it.` Japanese: `詳細ページのセクション見出しは、そのセクションへのリンクです。共有に使えます。`

**Verify**: `pnpm --filter docs build` → exit 0.

### Step 5: Changeset, checks

Create `.changeset/section-links.md`:

```md
---
'svelte-zukan': minor
---

feat: link to one section of a detail page with `#/<ID>?section=<title>`; each section heading links to itself.
```

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` and `--project client` → all pass; `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- `hash.test.ts`: detail with and without a section; existing round-trips.
- App: heading link `href`; scroll on load with `?section`; scroll on in-entry hash change; no scroll for an unknown section; existing scroll-to-top test.

## Done criteria

- [ ] Server and client test projects exit 0 with the new tests
- [ ] `grep -n "section: string | null" packages/svelte-zukan/src/lib/app/hash.ts` matches both the detail and preview members
- [ ] `grep -c '#/<ID>?section=<title>' docs/content/guides/catalog-ids.md docs/content/ja/guides/catalog-ids.md` prints `1` for each file
- [ ] `pnpm run package && pnpm run check && pnpm run lint && pnpm --filter docs build` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- `scrollIntoView` runs before the iframe heights settle and the target ends up off-screen in a manual check with a real catalog (`pnpm --filter svelte-zukan dev`, open `/__zukan/#/ui/components/Badge?section=<second title>`). Report it; a fix would need to wait for frame loads, which is a design change.
- Plan 018's `remembered()` logic conflicts with section hashes (a `?section=` detail hash is treated as foreign).
- Svelte reports that the action's parameter type does not accept `boolean`.

## Maintenance notes

- The heading link is the only share affordance; a copy button would need two new dictionary keys (`en` and `ja`).
- Section titles are user strings and are never translated; they are encoded with `encodeURIComponent` like preview URLs.
