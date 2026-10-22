---
'svelte-zukan': patch
---

fix: reload the exported catalog once when a tab opened before a redeploy asks for a chunk that is gone, and report a preview that failed to load as an error in the accessibility check (and the `check_accessibility` WebMCP tool) instead of "no issues".
