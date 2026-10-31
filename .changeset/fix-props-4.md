---
'svelte-zukan': patch
---

fix: keep a props default that is a regex literal containing `//` or `/*` as written.
fix: follow a props type imported from `'.'` or `'..'` to that folder's `index.ts` / `index.d.ts`.
fix: render a `.zukan.md` that starts with a byte order mark, and give it to `catalog.json` without the mark.
