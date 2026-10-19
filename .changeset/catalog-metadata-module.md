---
'svelte-zukan': patch
---

fix: the catalog page no longer imports your components to read their sections, so CSS and side effects from a component reach only its preview, not the catalog UI. Imports such as `Foo.zukan.svelte?raw` work again, and `magic-string` is no longer a dependency.
