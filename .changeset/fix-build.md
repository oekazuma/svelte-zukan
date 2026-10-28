---
'svelte-zukan': patch
---

fix: in the static catalog, write a component's Web Worker under `_zukan/` with a relative URL, and define `$app/manifest` and the dynamic public env of `$app/env/public` for SvelteKit, which failed in a preview.
