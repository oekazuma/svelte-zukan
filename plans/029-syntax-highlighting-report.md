# Report 029: Syntax highlighting in the code view

Spike for [plan 029](029-syntax-highlighting-spike.md), run on 2026-10-20 against the stack based on `467397b` (plans 017–028 applied). The prototype lives on the local branch `spike/029-highlight` (commit `9a3551a`). It is not pushed and not meant for merging.

## Recommendation

**Adopt candidate 3 (a small in-house tokenizer rendering `<span>`s), as a follow-up plan.** It adds no dependency. It also adds about 0.6 KB gzip to the catalog UI (under the 3 KB limit the plan set) and 34 lines of code. shiki, in the browser or at build time, conflicts with the install-size claim in `docs/content/why.md` (see the table). Candidate 4 (the CSS Custom Highlight API) would reuse the same tokenizer and avoid the extra DOM nodes. It is not worth the browser-support caveat for a code view this small.

## Measurements

| Candidate                                    | Install added      | Browser JS added (gzip)                                                                                                        | Code                               | Quality                                               |
| -------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------- |
| 1. shiki in the browser                      | 45 packages, 22 MB | 104 KB (4 chunks; `shiki/core`, JS regex engine, `svelte` grammar with its embedded languages, `github-light` + `github-dark`) | a few lines                        | exact (TextMate grammars)                             |
| 2. shiki at build/dev time in the plugin     | 45 packages, 22 MB | 0 (pre-highlighted HTML, 2.3 KB per small section)                                                                             | a few lines                        | exact; 1.8 ms per section after a 6 ms setup          |
| 3. in-house tokenizer + `<span>`s            | none               | about 0.6 KB (CodeBlock chunk 1188 → 1820 B), plus CSS                                                                         | 34 lines (`tokenize.ts`) + markup  | rough: see below                                      |
| 4. same tokenizer + CSS Custom Highlight API | none               | about the same as 3, no span nodes                                                                                             | same tokenizer + `Highlight` setup | as 3; plain text in browsers without `CSS.highlights` |

Measured with npm 11 in empty temp directories. The browser bundle was a one-file Vite 8.3.4 build. The catalog chunks come from `pnpm --filter svelte-zukan build`, compared with `gzip -c <file> | wc -c` before and after.

## Quality of the prototype tokenizer

On a sample with a TS script block, a string containing `<not a tag>`, a component with attributes and an `{#if}` block:

- Correct: tags, attributes, strings (including a `<` inside a string), JS/TS keywords, comments, and Svelte block markers (`{#if`, `{/if`).
- Wrong: the `>` of an arrow function (`=>`) inside an attribute expression is coloured as a tag. Expressions inside `{…}` are not tokenized beyond keywords and strings.
- A production version should skip `=>` in the tag rule. It should also get unit tests modelled on the `extract.test.ts` samples.

## Copy button and accessibility

The copy button still copies the original `code` string, which is unchanged. The spans have no roles, so screen readers read the code as one text block.

## Install-size claim in why.md

`npm install --omit=peer svelte-zukan@0.3.0` in an empty directory installs **2 packages** (`svelte-zukan`, `marked`), **768 KB** of `node_modules`. `docs/content/why.md:13` and its Japanese mirror say "1.0 MB, 4 packages". The numbers are stale or were measured another way. A follow-up docs fix should re-measure with the footnote's method and update both locales.

## Follow-up outline (if adopted)

- `src/lib/components/CodeBlock/tokenize.ts` plus `tokenize.test.ts`, covering the samples above, the arrow-function case and CRLF-free input (plan 016 already normalizes CRLF).
- `CodeBlock.svelte` renders the token spans and colours them with the catalog's CSS variables, with a dark variant.
- No option, no dependency. A `minor` changeset. Mention it in the quickstart's UI bullets in both locales.
