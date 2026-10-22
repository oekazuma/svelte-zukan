# svelte-zukan

## 0.9.0

### Minor Changes

- 4d965bc: feat: add a search dialog, opened with ⌘K / Ctrl+K, that finds components by name, section title, description and prop, with a filter by group.
- b187014: feat: add the `theme` option, which fixes the catalog and every preview to `'light'` or `'dark'` and removes the theme switch.

### Patch Changes

- b8afe7e: fix: show the code block's Copy button only while the code is open, at the right end of its "Code" row.
- f774a5d: fix: reload the exported catalog once when a tab opened before a redeploy asks for a chunk that is gone, and report a preview that failed to load as an error in the accessibility check (and the `check_accessibility` WebMCP tool) instead of "no issues".
- d8beaae: fix: in the props table, wrap a type only between the members of a union, so a type such as `() => void` is never split across lines.
- 0dacdc6: fix: add a "Skip to content" link before the sidebar, and with the `theme` option set, give the catalog page that `color-scheme` from the start so it does not paint the other theme before it mounts.
- 9abc0ac: feat: the preview toolbar's buttons show their name in a tooltip right away on hover and on keyboard focus, instead of the browser's delayed `title` tooltip.

## 0.8.0

### Minor Changes

- 9a06890: feat: the package includes a skill for AI coding agents, `skills/svelte-zukan/SKILL.md`: how to find what to catalog, write catalog files, and check them through `catalog.json` and the preview pages.
- da3663d: feat: the catalog as data for tools and AI agents. The dev server serves `/__zukan/catalog.json`, and `build: true` writes `catalog.json` next to `index.html`: every component with its sections (code and preview link), its `.md`, its props and its file paths.
- 04167ac: feat: the props table reads types imported by a relative path, from a `.ts` file or another component's `<script module>`, and refreshes when such a file changes. Types from packages are still shown by name.
- d22bbc4: feat: on the dev server, the detail page opens the catalog file and the component in your editor, through Vite's own open-in-editor endpoint.
- 72c94e7: feat: list the `.svelte` files that have no catalog file next to them, folded on the catalog's top page and as `uncataloged` in `catalog.json`.
- 3495680: feat: in browsers that implement WebMCP, the catalog page offers `list_components`, `get_component`, `open_component` and `check_accessibility` as tools for agents.

## 0.7.0

### Minor Changes

- 4f29ec0: feat: the catalog's top page shows each component as a card with a thumbnail of its first section and the first paragraph of its `.md`.
- b049a3e: feat: a measure button in the preview toolbar shows the size of the element under the pointer and draws its margin, border and padding, like the box model overlay of browser dev tools.
- 739b37e: feat: a preview width wider than the page is laid out at that width and scaled down to fit, instead of being cut to the page's width. A typed width can go up to 3840px.

## 0.6.0

### Minor Changes

- d14a2b2: feat: the accessibility panel outlines the elements axe-core reports (the picked one thicker), checks again after each edit, simulates blurred vision and color vision deficiencies, and shows axe's messages in Japanese with `locale: 'ja'`.
- a72ae06: feat: a preview narrower than the page is centered on a dotted background with a shadow, and preset changes animate, so a phone or tablet width is easy to see on a wide screen.

### Patch Changes

- ebaa332: fix: the preview toolbar wraps on narrow screens instead of cutting off its last buttons.
- 7434471: fix: a props table wider than the page can be scrolled with the keyboard.
- 0627e61: feat: the table of contents on a detail page links to the props table.
- 2a48905: feat: the accessibility panel picks a vision simulation from swatch chips (a radio group) instead of a select, and emphasizes an issue's element while it is hovered or focused in the list.

## 0.5.0

### Minor Changes

- 8df154e: feat: check a preview's accessibility with axe-core from its toolbar. axe-core is now a dependency; it is loaded only when a check runs.
- 589094c: feat: keyboard shortcuts `T` (switch the theme) and `F` (expand the preview in view), and arrow keys in the component list.
- aa80a32: feat: switch a preview's background between the theme's color, a checkerboard and a grid, and type a preview width in pixels.
- cfabbea: feat: list the props of the component next to each catalog file (`Button.svelte` for `Button.zukan.svelte`) on its detail page, with types, defaults and JSDoc.
- e1c69a7: feat: copy a link to a section at its current width and theme, and open "open in new tab" in the catalog's theme. Links can set `width` and `theme` after `section` in the hash.

## 0.4.1

### Patch Changes

- 8202345: fix: keep `light-dark()` in the static catalog's CSS, so components that use it follow the catalog's theme button instead of the system setting.

## 0.4.0

### Minor Changes

- 25adfe4: feat: a more polished catalog UI. The list page shows each group as a grid of component cards. Each section's preview and code form one card, and the code view has syntax colors. The resize grip sits beside the preview instead of over it, so the iframe is exactly the chosen width. Markdown descriptions get styled inline code, code blocks, lists and tables.
- 49dbde4: feat: a detail page with several sections gets a table of contents that follows the scroll, and every detail page links to the previous and next components. `J` and `K` move between components, and `?` (or the keyboard button in the sidebar) lists the shortcuts.
- e384600: feat: each preview gets a button that outlines its elements, a button that expands it over the page (Esc leaves), and a loading skeleton until it is measured. The Copy button of the code view is larger, with an icon and a clear copied state.
- a9c7520: feat: each preview's width is remembered across reloads, and a preview opened in its own tab uses the catalog's theme.
- 2b7f4f4: feat: link to one section of a detail page with `#/<ID>?section=<title>`; each section heading links to itself.
- fc075bd: feat: the sidebar shows each component's directory as a folder that folds, with counts, and the search also matches section titles and links straight to the matching section.
- 4954dbe: feat: one theme button at the top of the sidebar switches the catalog UI and every preview between light and dark. It starts from the system setting and is remembered; it replaces the Light/Dark buttons on each preview's toolbar.

### Patch Changes

- 3f32585: fix: a `logo` outside the Vite root adds only that file to `server.fs.allow`, not its whole directory.
- 34c1705: fix: the catalog page and the static catalog served by `vite preview` carry the headers from `server.headers` and `preview.headers`, like the app.
- 6b4cbb5: fix: load the static catalog's CSS when the app disables CSS code splitting (for example SvelteKit's `bundleStrategy: 'inline'`), and remove SvelteKit's `version.json` from a custom `appDir`.
- 08b6f9d: fix: the narrow-screen menu closes on every navigation, previews load when the catalog is opened as `index.html`, and a catalog shown inside an editor's iframe reloads after edits.
- 266b0af: feat: the preview width presets are device icons (phone, tablet, laptop, desktop, full width) with their widths in the tooltip, the width readout shows whole pixels in a larger font, and the new-tab link keeps only its icon on a narrow toolbar.
- 44eb591: fix: show the same code view for files with CRLF line endings, and detect a `Section` alias imported in `<script module>`.
- e6082c0: fix: reloading the catalog after following an in-page anchor in a preview or a doc shows the same page again.
- 7c2dcf4: fix: a catalog file without `<Section>` explains its empty detail page, and a `<Section>` without content no longer throws in dev.
- 91ee80e: fix: the supported Node version is back to 22.17 or later, as documented (a dependency update had raised `engines.node`), and the sidebar's search hits and group counts no longer add stray text to the accessible names of their links and lists.
- 82592c7: fix: the detail page of a catalog file whose name contains `%` loads in dev, and building a large catalog no longer rescans every directory per entry.
- 7c880ad: fix: a preview's height includes the body padding and margin set by the app's CSS, and a horizontal scrollbar.
- 505960e: fix: a preview whose content is exactly as tall as the initial frame (80px) gets its body spacing too, instead of being cut off.

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
