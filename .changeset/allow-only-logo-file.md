---
'svelte-zukan': patch
---

fix: a `logo` outside the Vite root adds only that file to `server.fs.allow`, not its whole directory.
