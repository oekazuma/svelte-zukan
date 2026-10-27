---
'svelte-zukan': patch
---

fix: list a prop declared twice once instead of breaking the detail page, and read more props types: a name exported under another name (`export { Inner as Props }`), a folder's `index.d.ts`, and the `.d.ts` next to the JavaScript file a package's `exports` points to when it has no `types` condition.
