---
'svelte-zukan': patch
---

fix: find a Tailwind CSS entry whose imports reach Tailwind outside the scanned directories, such as `../styles/tw.css` or a package in `node_modules` or the workspace.
