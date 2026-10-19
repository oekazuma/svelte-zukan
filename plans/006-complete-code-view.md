# Plan 006: The code view includes snippets, module-script and TypeScript definitions, and an aliased `Section` is detected

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 30b6d25..HEAD -- packages/svelte-zukan/src/lib/vite/extract.ts packages/svelte-zukan/src/lib/vite/extract.test.ts docs/content/guides/catalog-files.md docs/content/ja/guides/catalog-files.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- Priority: P2
- Effort: M
- Risk: LOW
- Depends on: none
- Category: bug
- Planned at: commit `30b6d25`, 2026-10-19

## Why this matters

For each `<Section>`, the detail page shows the section's markup together with the `<script>` definitions it uses (docs: "together with the definitions in `<script>` that the section references"). The extractor only collects imports, variables, functions and classes from the instance script. A section that uses a top-level `{#snippet}` (the normal Svelte 5 way to share markup), a `<script module>` constant, a TypeScript `type` / `interface` / `enum`, or an `export const` shows code that does not compile when copied, and `generics="T"` is dropped from the `<script>` tag. Separately, `import { Section as Example } from 'svelte-zukan'` is not recognised: the file silently gets zero sections, because detection matches the literal tag name `Section`.

## Current state

File: `packages/svelte-zukan/src/lib/vite/extract.ts` (186 lines). It parses a catalog file with `svelte/compiler`'s `parse(…, { modern: true })` and walks the AST with a local untyped `Node` type.

- Detection (line 8): `const isSection = (n: Node) => n.type === 'Component' && n.name === 'Section';`
- `identifiersOf(value)` (lines 35–48) collects identifier names, skipping non-computed member properties and object keys:
  ```ts
  if (n.type === 'MemberExpression' && !n.computed) skip.add(n.property);
  else if (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(n.type) && !n.computed && !n.shorthand)
    skip.add(n.key);
  else if (n.type === 'Identifier' && !skip.has(n)) names.add(n.name as string);
  else if (['Component', 'UseDirective', 'TransitionDirective', 'AnimateDirective'].includes(n.type))
    names.add((n.name as string).split('.')[0]);
  ```
- `declaredNames(node)` (lines 50–66) returns names declared by an import, a variable declaration, or anything with an `id` (functions, classes).
- `sectionsFrom(ast, source, filename)` (lines 72–151):
  ```ts
  const top = (ast.fragment.nodes as unknown as Node[]).filter(isSection);
  const topSet = new Set<Node>(top);
  walk(ast.fragment.nodes, (n) => {
    if (isSection(n) && !topSet.has(n))
      fail(
        n.start,
        '<Section> must not be nested (if this is your own component named "Section", import it under another name)'
      );
  });
  if (!top.length) return [];

  const lang = (ast.instance?.attributes as Node[] | undefined)?.find((a) => a.name === 'lang');
  const langValue = (lang?.value as { data: string }[] | undefined)?.[0]?.data;
  const scriptTag = langValue ? `<script lang="${langValue}">` : '<script>';

  const defs = ((ast.instance?.content.body ?? []) as unknown as Node[])
    .filter(
      (n) =>
        (n.type === 'ImportDeclaration' && (n.source as { value: string }).value !== 'svelte-zukan') ||
        ['VariableDeclaration', 'FunctionDeclaration', 'ClassDeclaration'].includes(n.type)
    )
    .map((node) => {
      const lineStart = source.lastIndexOf('\n', node.start - 1) + 1;
      const lead = source.slice(lineStart, node.start);
      const text = dedent((lead.trim() ? '' : lead) + source.slice(node.start, node.end));
      return { names: declaredNames(node), uses: identifiersOf(node), text };
    });
  ```
  then, per section, a fixpoint loop adds every def whose names are referenced (and the names those defs use), and builds:
  ```ts
  const script = defs
    .filter((d) => used.has(d))
    .map((d) =>
      d.text
        .split('\n')
        .map((l) => (l ? `  ${l}` : l))
        .join('\n')
    );
  const code = script.length ? `${scriptTag}\n${script.join('\n')}\n</script>\n\n${body}` : body;
  return { title, code };
  ```
- Svelte's modern AST shapes used below:
  - top-level snippet: `{ type: 'SnippetBlock', expression: { type: 'Identifier', name }, parameters: [...], body: Fragment, start, end }`, found in `ast.fragment.nodes`;
  - `ast.module` is the `<script module>` block (same shape as `ast.instance`: `attributes`, `content.body`);
  - import specifiers: `{ type: 'ImportSpecifier', imported: { name }, local: { name } }`;
  - `export const x = 1` is `{ type: 'ExportNamedDeclaration', declaration: VariableDeclaration }`;
  - TypeScript declarations (with `lang="ts"`): `TSTypeAliasDeclaration`, `TSInterfaceDeclaration`, `TSEnumDeclaration`, each with an `id` Identifier. Interface members are `TSPropertySignature` / `TSMethodSignature` with a `key`.
- Tests: `packages/svelte-zukan/src/lib/vite/extract.test.ts`, server project (Node). Pattern:
  ```ts
  const FILE = 'Button.zukan.svelte';
  ...
    it('keeps lang only when the source script has it', () => {
      const source = `<script>
    import Button from '../Button.svelte';
  </script>

  <Section title="a"><Button /></Section>`;
      expect(extractSections(source, FILE)[0].code).toBe(
        `<script>\n  import Button from '../Button.svelte';\n</script>\n\n<Button />`
      );
    });
  ```
  Every existing expectation must stay byte-identical. The new output only differs when the source has module defs, snippets, TS declarations, exports or `generics`.
- Docs (both locales), "Code view" section:
  - `docs/content/guides/catalog-files.md:46`: "The detail page shows the contents of each section as code, together with the definitions in `<script>` that the section references. In the example above, the code for "Basic" also shows `label` and `count`."
  - `docs/content/ja/guides/catalog-files.md:46`: 「詳細ページのコード表示には、セクションの中身と、そこから参照している `<script>` 内の定義が出ます。上の例では、「Basic」のコードに `label` と `count` も表示されます。」
- Conventions: Prettier 120 columns, single quotes. Error messages in English, prefixed `svelte-zukan:` or `<file>:<line>`. Comments only for a non-obvious WHY.

## Commands you will need

| Purpose           | Command                                                                                    | Expected on success |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| Install           | `pnpm install`                                                                             | exit 0              |
| Extract tests     | `pnpm --filter svelte-zukan exec vitest run --project server src/lib/vite/extract.test.ts` | all pass            |
| All library tests | `pnpm --filter svelte-zukan exec vitest run`                                               | all pass            |
| Typecheck         | `pnpm run package && pnpm run check`                                                       | exit 0              |
| Lint              | `pnpm run format && pnpm run lint`                                                         | exit 0              |
| Docs              | `pnpm --filter docs build`                                                                 | exit 0              |

## Scope

**In scope**:

- `packages/svelte-zukan/src/lib/vite/extract.ts` (`isSection`, `identifiersOf`, `sectionsFrom` and small helpers)
- `packages/svelte-zukan/src/lib/vite/extract.test.ts`
- `docs/content/guides/catalog-files.md`, `docs/content/ja/guides/catalog-files.md` (the "Code view" paragraph)
- `.changeset/complete-code-view.md` (create)

**Out of scope**:

- `transformZukan` and `parseZukan` (plan 007 changes how the result is delivered).
- Side-effect imports (`import './x.css'`). They declare no name, and showing them for every section would be noise.
- Syntax highlighting or any UI change.

## Git workflow

- Branch: `advisor/006-complete-code-view`
- Commits, for example `fix: detect Section imported under another name` and `fix: include snippets, module script and TypeScript definitions in the code view`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Detect `Section` by its local name

1. Add a helper that finds the local name of `Section` from the `svelte-zukan` import in the instance script, defaulting to `'Section'`:
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
2. Change `isSection` to take the name (`(n: Node, name: string) => n.type === 'Component' && n.name === name`), compute `const name = sectionName(ast)` at the top of `sectionsFrom`, and pass it at both call sites. The `filter` call must become `.filter((n) => isSection(n, name))`; passing `isSection` directly would give it the array index as the name. In the nested-section error, write the local tag name: `` `<${name}> must not be nested (…)` `` (keep the rest of the message; the default name keeps the existing test passing).
3. Add tests:
   - `'detects Section imported under another name'`: source `<script>\n  import { Section as Example } from 'svelte-zukan';\n</script>\n\n<Example title="a"><A /></Example>` → `[{ title: 'a', code: '<A />' }]`.
   - `'an own component named Section is not a section when the import is aliased'`: source with `import { Section as Example } from 'svelte-zukan';` and `import Section from './Section.svelte';`, and markup `<Example title="a"><Section /></Example>` → one section, no throw, and its code is `<script>\n  import Section from './Section.svelte';\n</script>\n\n<Section />`.

**Verify**: extract tests → all pass (old and new).

### Step 2: Collect TypeScript declarations and exported declarations

1. Extend the def filter. Accept `ExportNamedDeclaration` nodes that have a `declaration`, and the node types `TSTypeAliasDeclaration`, `TSInterfaceDeclaration`, `TSEnumDeclaration`, next to the existing ones. For an export, compute `names` with `declaredNames(node.declaration)`, but keep the text (with `export`) and `uses` from the whole node.
2. In `identifiersOf`, also skip the `key` of `TSPropertySignature` and `TSMethodSignature` when not computed (add them to the `['Property', 'MethodDefinition', 'PropertyDefinition']` list), so interface member names are not taken as references.
3. Add tests:
   - `'includes TypeScript types the section uses'`: `<script lang="ts">\n  type Item = { id: number };\n  const items: Item[] = [];\n  type Unused = string;\n</script>\n\n<Section title="a"><List {items} /></Section>` → code `<script lang="ts">\n  type Item = { id: number };\n  const items: Item[] = [];\n</script>\n\n<List {items} />`.
   - `'includes an exported declaration'`: `<script>\n  export const size = 's';\n</script>\n\n<Section title="a"><A {size} /></Section>` → code contains `  export const size = 's';`.

**Verify**: extract tests → all pass.

### Step 3: Collect `<script module>` definitions

1. Build `moduleDefs` from `ast.module?.content.body` with the same filter and mapping as the instance defs, and mark each def with `module: true` (instance defs `module: false`). Run the existing fixpoint loop over `[...moduleDefs, ...defs]`.
2. Build the module tag from the module script's own `lang` attribute: `<script module lang="ts">` or `<script module>`.
3. Assemble the code from blocks, so the output stays byte-identical when there are no module defs:
   ```ts
   const block = (tag: string, list: typeof all) =>
     list.length ? `${tag}\n${list.map(indent).join('\n')}\n</script>` : '';
   const code = [block(moduleTag, usedModule), block(scriptTag, usedInstance), body].filter(Boolean).join('\n\n');
   ```
   (`indent` is the existing two-space mapping; name things as you see fit.)
4. Test `'includes module script definitions'`: `<script module>\n  export const sizes = ['s', 'm'];\n</script>\n\n<Section title="a">{#each sizes as s (s)}<A {s} />{/each}</Section>` → code starts with `<script module>\n  export const sizes = ['s', 'm'];\n</script>\n\n{#each`.

**Verify**: extract tests → all pass, including the existing `transformZukan` tests.

### Step 4: Collect top-level snippets

1. Take `ast.fragment.nodes` with `type === 'SnippetBlock'` as defs: `names: [expression.name]`, `uses: identifiersOf(node)`, and the text from the same lead/dedent logic as script defs. Do not indent snippet text.
2. Add them to the fixpoint loop, and emit the used snippets, in source order, as their own blocks between the script blocks and the body (each joined with `'\n\n'`).
3. Test `'includes top-level snippets the section renders'`:
   ```svelte
   <script>
     import Row from './Row.svelte';
   </script>

   {#snippet row(item)}
     <Row {item} />
   {/snippet}

   <Section title="a"><Table {row} /></Section>
   ```
   → code `<script>\n  import Row from './Row.svelte';\n</script>\n\n{#snippet row(item)}\n  <Row {item} />\n{/snippet}\n\n<Table {row} />`. Also a second section in the same file that does not use `row` → its code has neither the snippet nor the import.

**Verify**: extract tests → all pass.

### Step 5: Keep `generics` on the script tag

Build `scriptTag` from both `lang` and `generics` of the instance script: `<script lang="ts" generics="T">`. Test `'keeps generics on the script tag'`: `<script lang="ts" generics="T">\n  let items: T[] = [];\n</script>\n\n<Section title="a"><A {items} /></Section>` → code starts with `<script lang="ts" generics="T">`.

**Verify**: extract tests → all pass.

### Step 6: Docs and changeset

1. `docs/content/guides/catalog-files.md`, "Code view": append "Top-level `{#snippet}` blocks, `<script module>` declarations and TypeScript types that the section uses are shown too. `Section` can be imported under another name, for example `import { Section as Example } from 'svelte-zukan'`."
2. `docs/content/ja/guides/catalog-files.md`, 「コード表示」: append 「セクションが使うトップレベルの `{#snippet}`、`<script module>` 内の宣言、TypeScript の型も表示します。`Section` は `import { Section as Example } from 'svelte-zukan'` のように別名で import しても使えます。」
3. Create `.changeset/complete-code-view.md`:
   ```md
   ---
   'svelte-zukan': patch
   ---

   fix: the code view also shows the top-level snippets, `<script module>` declarations and TypeScript types a section uses, keeps `generics` on the script tag, and `Section` is detected when imported under another name.
   ```

**Verify**: `pnpm run format && pnpm run lint` → exit 0, and `pnpm --filter docs build` → exit 0.

## Test plan

Seven new cases in `extract.test.ts` (Steps 1–5; the second section in Step 4 is part of the same test). All existing cases stay unchanged and pass. Full run: `pnpm --filter svelte-zukan exec vitest run` → all pass.

## Done criteria

- [ ] `pnpm --filter svelte-zukan exec vitest run` exits 0, with the 7 new cases
- [ ] `git diff $(git merge-base main HEAD) --numstat -- packages/svelte-zukan/src/lib/vite/extract.test.ts` shows `0` in the deletions column (no existing expectation was edited)
- [ ] `pnpm run package && pnpm run check` and `pnpm run lint` exit 0
- [ ] `pnpm --filter docs build` exits 0
- [ ] `.changeset/complete-code-view.md` exists
- [ ] `git diff --name-only $(git merge-base main HEAD)..HEAD` together with `git status --short` lists only in-scope files and `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

- An AST node has a different shape than described (for example `SnippetBlock.expression` is not an `Identifier`, or TS nodes are missing with `lang="ts"`). Print the node with `JSON.stringify(node, (k, v) => (k === 'metadata' || k === 'parent' ? undefined : v), 2)` and report.
- An existing test's expected output would have to change.
- The fixpoint loop picks up unrelated definitions in an existing test because of a new identifier source.

## Maintenance notes

- The code view is a best-effort reconstruction. Anything a section uses that is not a top-level declaration (side-effect imports, `$props()` in a catalog file) is still left out by design.
- Plan 007 moves the extracted data into a separate module. It must call the same `sectionsFrom`, so these improvements carry over.
- Reviewers: check that a section using nothing still produces just its body.
