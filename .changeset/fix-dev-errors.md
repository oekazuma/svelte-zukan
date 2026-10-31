---
'svelte-zukan': patch
---

fix: on the dev server, a compile or import error in a catalog file (or in a file only catalog files import) shows in its preview instead of Vite's error overlay on the app's tabs, which stayed after the fix.
