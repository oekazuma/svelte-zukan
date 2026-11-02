---
'svelte-zukan': minor
---

fix: the `svelte` peer dependency is now `^5.57.1`, the same floor as SvelteKit 3. Svelte 5.46.4 to 5.56.3 could not build the catalog at all; users of a Svelte below 5.57.1 must upgrade.
