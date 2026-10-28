---
'svelte-zukan': patch
---

fix: editing the `logo` reloads only the catalog tab, a catalog file that does not compile shows its error on its detail page instead of an error overlay in every tab, an app page that imports a catalog file keeps its HMR, a catalog file outside the scanned directories no longer reloads the catalog, a logo in `publicDir` no longer makes Vite warn on every load, and the dev server answers `/__zukan/` only for GET and HEAD.
