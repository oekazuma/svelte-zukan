---
'svelte-zukan': patch
---

fix: read catalog files and props more faithfully.

- A `{#snippet}` declared inside a section no longer pulls a top-level snippet or an import of the same name into that section's code.
- `<Z.Section>` with `import * as Z from 'svelte-zukan'` is read as a section, with the same rules as `<Section>`.
- Section content that starts on the `<Section>` line is dedented like the rest.
- The script definitions in a section's code keep the tabs of a tab-indented file instead of mixing in spaces.
- A prop default with a block body keeps its line breaks, so one written without semicolons stays valid code.
- A prop type `typeof import('./config').default` keeps its `import()`.
