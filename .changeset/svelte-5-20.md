---
'svelte-zukan': patch
---

fix: require Svelte 5.20 or later. The catalog UI uses `$props.id()`, so older Svelte 5 versions failed to compile it.
