# Plan 016: The code view is the same for CRLF files, and a `Section` alias in `<script module>` is detected

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 293f5a4..HEAD -- packages/svelte-zukan/src/lib/vite/extract.ts packages/svelte-zukan/src/lib/vite/extract.test.ts`
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

`svelte-zukan` shows, for each `<Section>` of a catalog file (`*.zukan.svelte`), the section's code and the script definitions it uses. `src/lib/vite/extract.ts` builds that text by slicing the source. Two bugs were reproduced at `293f5a4`:

1. **CRLF.** Git for Windows checks files out with CRLF by default, and the repo has no `.gitattributes`. On such a file, every section's code starts with a stray blank line and mixes `\r\n` with `\n` (the copy button copies the mixed text). Same source, LF vs CRLF:
   - LF: `[{"title":"A","code":"<p>one</p>\n<p>two</p>"}]`
   - CRLF: `[{"title":"A","code":"\n<p>one</p>\r\n<p>two</p>"}]`
2. **Alias in `<script module>`.** The docs (`docs/content/guides/catalog-files.md:47`) say `Section` can be imported under another name. The alias is looked up only in the instance `<script>`. With `import { Section as S } from 'svelte-zukan'` in `<script module>`, `<S title="A">…</S>` is not detected and the file has zero sections: the detail page shows only a heading. Reproduced: `[]`.

## Current state

- `packages/svelte-zukan/src/lib/vite/extract.ts` — parses a catalog file with `svelte/compiler` and returns `{ title, code }[]`.
  - Lines 73–81:
    ```ts
    // `import { Section as Example } from 'svelte-zukan'` names the tag `Example`
    function sectionName(ast: Ast) {
      for (const n of (ast.instance?.content.body ?? []) as unknown as Node[]) {
        if (n.type !== 'ImportDeclaration' || (n.source as { value: string }).value !== 'svelte-zukan') continue;
        for (const s of n.specifiers as { type: string; imported?: { name?: string }; local: { name: string } }[])
          if (s.type === 'ImportSpecifier' && s.imported?.name === 'Section') return s.local.name;
      }
      return 'Section';
    }
    ```
  - Lines 164–174: the title checks use a hardcoded `<Section>` in their messages, while the nested check at line 108 uses `<${name}>`:
    ```ts
    if (!attr) fail(section.start, '<Section> needs a title');
    // `title` alone (value `true`) and `title=""` (no Text node) are both empty
    if (value === true || (Array.isArray(value) && !value.length))
      fail(section.start, '<Section> title must not be empty');
    if (!Array.isArray(value) || value.length !== 1 || value[0].type !== 'Text')
      fail(section.start, '<Section> title must be a static string');
    const title = (value as unknown as { data: string }[])[0].data;
    if (!title.trim()) fail(section.start, '<Section> title must not be empty');
    if (titles.has(title)) fail(section.start, `duplicate <Section> title "${title}"`);
    ```
  - Lines 177–185: the body text; `.replace(/^(?:[ \t]*\n)+/, '')` does not match a leading `\r\n`:
    ```ts
    const body = nodes.length
      ? dedent(
          source
            .slice(nodes[0].start, nodes.at(-1)!.end)
            .replace(/^(?:[ \t]*\n)+/, '')
            .trimEnd()
        )
      : '';
    ```
  - Lines 18–19: `dedent` splits on `\n`, so `\r` stays on each line.
  - Lines 207–229: `parseZukan` blanks `<style>` contents keeping length and newlines, and `extractSections(source, filename)` is the only export:
    ```ts
    export function extractSections(source: string, filename: string): ZukanSection[] {
      return sectionsFrom(parseZukan(source, filename), source, filename);
    }
    ```
- `packages/svelte-zukan/src/lib/vite/extract.test.ts` — Vitest unit tests (`FILE = 'Button.zukan.svelte'`). The alias tests at lines ~160–185 are the pattern for the new cases (`import { Section as Example } from 'svelte-zukan'`). Error-message tests use regexes like `/Button\.zukan\.svelte:1 .*needs a title/`, so they keep passing if `<Section>` becomes `<Example>` in a message only when the alias is used.

Conventions: comments only for the non-obvious why; Prettier 120 columns, single quotes, no trailing commas.

## Commands you will need

| Purpose               | Command (from the repo root)                                                    | Expected on success |
| --------------------- | ------------------------------------------------------------------------------- | ------------------- |
| Install               | `pnpm install`                                                                  | exit 0              |
| This file's tests     | `cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/extract.test.ts` | all pass            |
| All plugin unit tests | `pnpm --filter svelte-zukan exec vitest run --project server`                   | all pass            |
| Type check            | `pnpm run package && pnpm run check`                                            | exit 0              |
| Lint                  | `pnpm run lint` (fix with `pnpm run format`)                                    | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/extract.ts`
- `packages/svelte-zukan/src/lib/vite/extract.test.ts`
- `.changeset/extract-crlf-module-alias.md` (create)

**Out of scope**:

- Namespace imports (`import * as Z from 'svelte-zukan'` then `<Z.Section>`): not documented, no demand.
- What the detail page shows for a file with zero sections: that is plan 017.
- Adding a `.gitattributes`: the plugin must work on user repos, which have their own settings.

## Git workflow

- Branch: `advisor/016-extract-crlf-and-module-alias`
- Conventional Commits, e.g. `fix: normalize CRLF in the code view`, `fix: find a Section alias imported in <script module>`
- Do not push or open a PR unless told to.

## Steps

### Step 1: Add failing tests

In `extract.test.ts`, inside `describe('extractSections')`, add:

```ts
it('gives the same code for CRLF line endings', () => {
  const lf = `<script>
  import { Section } from 'svelte-zukan';
  const f = (x) => {
    return x;
  };
</script>

<Section title="A">
  <p>{f(1)}</p>
  <p>two</p>
</Section>`;
  expect(extractSections(lf.replace(/\n/g, '\r\n'), FILE)).toEqual(extractSections(lf, FILE));
});

it('reports the line of an error in a CRLF file', () => {
  expect(() => extractSections('<p></p>\r\n<Section><A /></Section>', FILE)).toThrow(/Button\.zukan\.svelte:2 /);
});

it('finds a Section alias imported in <script module>', () => {
  const source = `<script module>
  import { Section as Example } from 'svelte-zukan';
</script>

<Example title="A"><p>one</p></Example>`;
  expect(extractSections(source, FILE)).toEqual([{ title: 'A', code: '<p>one</p>' }]);
});

it('names the alias in title errors', () => {
  const source = `<script>
  import { Section as Example } from 'svelte-zukan';
</script>

<Example><p>one</p></Example>`;
  expect(() => extractSections(source, FILE)).toThrow(/<Example> needs a title/);
});
```

**Verify**: `cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/extract.test.ts` → the first, third and fourth new tests fail; the line-number test may already pass (it is a guard for Step 2). Every other test passes.

### Step 2: Normalize line endings once, at the entry point

In `extractSections`, normalize before both parsing and slicing, so offsets and slices come from the same string:

```ts
export function extractSections(source: string, filename: string): ZukanSection[] {
  // Windows checkouts are often CRLF; the code view joins its parts with \n
  const lf = source.replace(/\r\n?/g, '\n');
  return sectionsFrom(parseZukan(lf, filename), lf, filename);
}
```

Line numbers stay right: each `\r\n` becomes one `\n`, and `lineOf` counts `\n`.

**Verify**: the CRLF tests pass; `pnpm exec vitest run src/lib/vite/extract.test.ts` → only the two alias tests still fail.

### Step 3: Look for the alias in both scripts, and name it in messages

1. In `sectionName`, iterate `[...(ast.module?.content.body ?? []), ...(ast.instance?.content.body ?? [])]` instead of only the instance body. Keep the comment.
2. In the title checks (lines 166–174), replace the literal `<Section>` with `<${name}>` in the four messages (`needs a title`, `title must not be empty` ×2, `title must be a static string`) and in `duplicate <Section> title`. `name` is already in scope (line 101).

**Verify**: `cd packages/svelte-zukan && pnpm exec vitest run src/lib/vite/extract.test.ts` → all pass.

### Step 4: Full checks and changeset

Create `.changeset/extract-crlf-module-alias.md`:

```md
---
'svelte-zukan': patch
---

fix: show the same code view for files with CRLF line endings, and detect a `Section` alias imported in `<script module>`.
```

**Verify**: `pnpm --filter svelte-zukan exec vitest run --project server` → all pass; `pnpm run package && pnpm run check` → exit 0; `pnpm run lint` → exit 0.

## Test plan

- CRLF and LF inputs give identical output (covers the leading blank line and the mixed endings).
- An error in a CRLF file still reports the right line.
- An alias imported in `<script module>` is detected.
- Title errors name the alias the user wrote.
- Existing tests for aliases, nesting, titles and code content keep passing unchanged.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run --project server` exits 0, with the 4 new tests
- [ ] `grep -n "<Section>" packages/svelte-zukan/src/lib/vite/extract.ts` prints nothing
- [ ] `pnpm run package && pnpm run check && pnpm run lint` exit 0
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

- After Step 2 an existing test fails (for example a code-content test that expected a `\r`): report it; do not change existing expectations.
- `svelte/compiler`'s `parse` reports different `start`/`end` offsets than expected after normalization (a test about line numbers fails).
- A test expects the literal text `<Section>` in an error message for an aliased import.

## Maintenance notes

- `extractSections` is the only entry point; any new caller gets normalized input for free. Keep the normalization there, not in `parseZukan`, since `sectionsFrom` slices the same string.
- Plan 017 changes what the detail page shows when this function returns `[]`; with the alias fix, fewer files reach that state by accident.
