---
'svelte-zukan': minor
---

feat: without `groups`, workspace packages linked in the workspace root's `node_modules` (npm, yarn and bun workspaces) are discovered too. Catalog files in those packages now appear in the catalog; set `groups` to keep the previous result.
