---
'svelte-zukan': patch
---

fix: several fixes to the Vite plugin.

- On the dev server, a duplicate catalog ID is shown on the catalog's top page, and `/__zukan/catalog.json` answers 500 with `{ "error" }`, which the WebMCP tools report as their error, instead of a Vite error overlay on every tab, the app's too, that stayed after the fix.
- The catalog build no longer inherits `build.rolldownOptions.external` (library mode), so it no longer imports a bare `svelte` it can not load.
- The catalog's `build.outDir` is also checked against the `build.outDir` of each environment in `environments`.
- `vite preview` serves the catalog's .pdf, .txt, .vtt, audio, .mov and .webmanifest files with their content types instead of octet-stream.
