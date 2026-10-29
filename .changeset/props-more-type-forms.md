---
'svelte-zukan': patch
---

fix: read more props types: `@types/<name>` for a package without its own types, the `.d.ts` next to `main`, a folder subpath of a package without `exports`, a default-exported interface, a namespace import (`T.Props`), `Omit` and `Pick` over a type the table can list, and `ComponentProps<typeof X>` of a source component.
