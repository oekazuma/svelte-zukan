---
'svelte-zukan': patch
---

fix: several fixes to the Vite plugin.

- On the dev server, a duplicate catalog ID no longer puts a Vite error overlay on any tab, including the app's: the catalog's top page shows the error, and `/__zukan/catalog.json` answers 500 with `{ "error" }`, which the WebMCP tools report.
- The catalog build no longer inherits `build.rolldownOptions.external` (library mode), so it no longer imports a bare `svelte` it can not load.
- The catalog's `build.outDir` is also checked against the `build.outDir` of each environment other than the catalog's, including one a `configEnvironment` hook sets.
- `vite preview` serves the catalog's .pdf, .txt, .vtt, audio, .mov and .webmanifest files with their content types instead of octet-stream.
