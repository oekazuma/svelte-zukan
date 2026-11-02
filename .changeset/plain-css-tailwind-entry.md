---
'svelte-zukan': patch
---

fix: treat a plain CSS file that imports Tailwind CSS entries as the entry. An `app.css` with only `@import "./tw.css"` and `@import "./tokens.css"` used to give two entries, neither with the whole theme; it now gives one, `app.css`, with the tokens of both.
