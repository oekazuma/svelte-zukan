---
'svelte-zukan': patch
---

fix: load the static catalog's CSS when the app disables CSS code splitting (for example SvelteKit's `bundleStrategy: 'inline'`), and remove SvelteKit's `version.json` from a custom `appDir`.
