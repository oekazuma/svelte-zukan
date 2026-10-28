---
'svelte-zukan': patch
---

fix: hot-reload the catalog for a `groups` directory reached through a `node_modules` link (new or deleted catalog files, `.md` edits), and skip `node_modules` in a scanned directory whose path contains glob characters such as `[` or `{`.
