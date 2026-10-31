---
'svelte-zukan': patch
---

fix: on the dev server, fixing or creating a stylesheet that only the catalog imports now reloads the catalog's previews, without reloading the app's tabs, and creating a file that both a catalog file and an app entry failed to import reloads the app as Vite does.
