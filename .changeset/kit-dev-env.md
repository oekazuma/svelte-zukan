---
'svelte-zukan': patch
---

fix: a component that reads `$app/env/public`, `$env/dynamic/public` or `$env/static/public` no longer fails to load in a dev preview of a SvelteKit app.
