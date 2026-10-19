---
'svelte-zukan': patch
---

fix: when the dev server already has a `server.fs.allow` list (SvelteKit sets one), the plugin adds only the directories it needs instead of allowing the whole workspace.
