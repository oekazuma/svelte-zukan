---
'svelte-zukan': patch
---

fix: the catalog page and the static catalog served by `vite preview` carry the headers from `server.headers` and `preview.headers`, like the app.
