---
'svelte-zukan': patch
---

fix: serve `.mjs` and `.cjs` catalog files as JavaScript under `vite preview`, so module workers load; refresh the props when a props type file outside a `groups` directory linked through `node_modules` changes; and show a duplicate catalog ID outside the Vite root by paths relative to it in the dev server's catalog and `catalog.json`.
