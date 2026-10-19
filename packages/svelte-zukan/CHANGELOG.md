# svelte-zukan

## 0.3.0

### Minor Changes

- c544a8f: feat: without `groups`, workspace packages linked in the workspace root's `node_modules` (npm, yarn and bun workspaces) are discovered too. Catalog files in those packages now appear in the catalog; set `groups` to keep the previous result.
- 5481e77: feat: with `build: true`, `vite preview` serves the exported catalog at `/__zukan/`.

### Patch Changes

- cc22550: fix: the catalog page no longer imports your components to read their sections, so CSS and side effects from a component reach only its preview, not the catalog UI. Imports such as `Foo.zukan.svelte?raw` work again, and `magic-string` is no longer a dependency.
- cc2d66f: fix: `/` focuses the search on narrow screens too, moving to another page of the catalog starts at the top, saving a catalog file reloads the catalog once instead of once per preview, and screen readers no longer announce the preview width on every drag step.
- 3d66789: fix: the code view also shows the top-level snippets, `<script module>` declarations and TypeScript types a section uses, keeps `generics` on the script tag, and `Section` is detected when imported under another name.
- ea6c320: fix: in dev, a catalog file that is deleted and created again (for example by `git checkout`) shows its new sections instead of the old ones.
- 125b8c5: fix: links such as `href="#"` inside a previewed component, or anchors in a `.zukan.md` doc, no longer replace the preview or the page with the catalog UI.
- 914cbcf: fix: when the dev server already has a `server.fs.allow` list (SvelteKit sets one), the plugin adds only the directories it needs instead of allowing the whole workspace.
- 37b88ee: fix: show only the requested section in each preview when Vite prebundles `svelte-zukan` in dev (the default for an npm install).
- 7c8a75e: fix: require Svelte 5.20 or later. The catalog UI uses `$props.id()`, so older Svelte 5 versions failed to compile it.

## 0.2.0

### Minor Changes

- b836cb7: feat: improve the catalog UI. The sidebar has a search box (press `/` to focus it) and groups the components by group name, and folds under a menu button on narrow screens. The catalog UI follows the system's light or dark theme. Each preview has a light or dark background switch shared by every preview on the page, and a link that opens it in a new tab. Preview iframes load lazily.

## 0.1.0

### Minor Changes

- bb3e27b: feat: first release. A Vite plugin that serves a component catalog for Svelte at `/__zukan/`, built from `*.zukan.svelte` and `*.zukan.md` files placed next to your components.
