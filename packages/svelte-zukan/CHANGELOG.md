# svelte-zukan

## 0.16.5

### Patch Changes

- b12ad27: fix: on the dev server, fixing or creating a stylesheet that only the catalog imports now reloads the catalog's previews, without reloading the app's tabs, and creating a file that both a catalog file and an app entry failed to import reloads the app as Vite does.
- 385b91b: fix: serve `.mjs` and `.cjs` catalog files as JavaScript under `vite preview`, so module workers load; refresh the props when a props type file outside a `groups` directory linked through `node_modules` changes; and show a duplicate catalog ID outside the Vite root by paths relative to it in the dev server's catalog and `catalog.json`.
- 9d735b2: fix: a generic props type (`WithElementRef<HTMLButtonAttributes, HTMLButtonElement>`, `ListProps<string>`) is read with its type arguments or defaults in place of its type parameters, instead of naming `T` as the props type and showing `T[]` or `U | null` as member types.

  fix: a section's code no longer includes a script variable that the section only shadows with a name it declares itself (an `{#each}` item or index, a snippet or function parameter, an `{:then}` or `{:catch}` value, `{@const}`, `let:`).

- 4051d6b: fix: a circular type parameter default (`type P<T = T>`) no longer crashes the catalog; a generic type given itself as an argument (`W<W<{ x: 1 }>>`) lists all of its props; `Omit` and `Pick` whose keys are a type parameter are expanded; a function or conditional type argument is parenthesized in a conditional type; and a `for` loop variable in a section no longer pulls in the script variable of the same name.
- 4e439ea: fix: read props and section code more faithfully. A type that Prettier breaks into lines no longer starts with `|` or `&`, `export *` passes on an `export const` / `export declare const` component, a JSDoc written on the line of the member before is read, and a fenced code block in a JSDoc no longer shows its language. Section code keeps the lines of a template literal as written and no longer pulls in a definition for an imported name, `import.meta`, a qualified type name, an enum member or a label. A `<Section>` inside a block or an element now says it must be at the top level of the file.
- 1368a80: fix: read catalog files and props more faithfully.

  - A `{#snippet}` declared inside a section no longer pulls a top-level snippet or an import of the same name into that section's code.
  - `<Z.Section>` with `import * as Z from 'svelte-zukan'` is read as a section, with the same rules as `<Section>`.
  - Section content that starts on the `<Section>` line is dedented like the rest.
  - The script definitions in a section's code keep the tabs of a tab-indented file instead of mixing in spaces.
  - A prop default with a block body keeps its line breaks, so one written without semicolons stays valid code.
  - A prop type `typeof import('./config').default` keeps its `import()`.

- 2fab08a: fix: read Tailwind CSS root variables declared in `:where(:root)` (daisyUI 5), watch a `@plugin` or `@config` file that throws, show the variable of Drop Shadow tokens, and leave Tailwind's reference-only compatibility variables (`--radius`, `--shadow`, `--blur`, …) out of the full config and `catalog.json`.
- 4287195: fix: resolve Tailwind CSS tokens through the `:root` variables that win the cascade layers, read the last declaration when a class has two of its property, and show no CSS variable on a token whose variable Tailwind never writes (`@theme reference`, `@config`, `@plugin`).
- 84789f8: fix: show the variable of a daisyUI-style `@plugin` token whose class reads a root variable of its own name, and draw the light value of a `light-dark()` color in the swatches of a dark catalog.
- 3556ba8: fix: show the values Tailwind writes for theme values that use its CSS functions, and count each token once on the Tailwind CSS card.

  - A theme value written with `--spacing()`, `--alpha()`, `--theme()` or `theme()` showed as written, for example `p-gutter` as `--spacing(6)`. The Tailwind CSS page, `catalog.json` and WebMCP now show the value Tailwind writes (`calc(0.25rem * 6)`), with its px size, its swatch and its place in the scale, and Full config lists it the same way.
  - The token count on the top page's Tailwind CSS card counted every padding class twice, once in Padding and once in Spacing. It now counts each token once.

- 630bbc9: fix: Back and Forward return to the scroll position of a page taller than the one left, and of a filtered Tailwind CSS page; the accessibility panel checks again after a theme switch or a width change; `check_accessibility` reports a preview that did not finish rendering instead of an empty result; a section link that names no heading opens the page at the top; an empty catalog no longer says "No matches" before anything is typed; J, K, T and F work with Shift or Caps Lock; a name starting with an emoji shows the whole emoji as its initial.
- 971e17a: fix: return to the scroll position on Back and Forward onto a detail page, also one with a `?section=`, leave the page where it is when a link opens in another tab, and pass the catalog's shortcuts on from the Tailwind CSS samples.
- 00e17e7: fix: catalog UI accessibility and layout fixes.

  - Closing the accessibility panel returns the focus to its toggle, and Check again keeps the focus while it runs.
  - Following a sidebar link on a narrow screen moves the focus to the main content instead of the body.
  - Long component names wrap on detail pages and in search results instead of scrolling the page sideways or being clipped.
  - The initial tile of a component without sections keeps white text above 3:1 at every hue.
  - The sidebar search shows "No matches" only once section titles are loaded, and both searches announce the number of results.
  - The Tailwind CSS link in the sidebar is marked current for an unknown `source`, as the page shows the first entry.
  - The expand button is no longer announced as pressed on top of its changing name.
  - The WebMCP `check_accessibility` tool gives separate errors for an unknown ID and a missing section, listing the component's sections.
  - A component whose metadata fails to load no longer hides the section titles of the others from the sidebar search, and leaves no unhandled rejection on the top page.

- 28dfafc: fix: keep the catalog inside narrow screens and keep a preview's dialog keys in the dialog.

  - Long inline code, links, the props type and section titles on a detail page wrap instead of scrolling the page sideways at 320px, and a wide table in the `.md` doc scrolls in its own box, which the keyboard can reach.
  - A wide custom `logo` or a long one-word `title` no longer pushes the sidebar's search, theme and shortcut buttons out of the sidebar.
  - A letter shortcut (J, K, T, F, ?) pressed in a dialog inside a preview stays in the dialog, as on the catalog's own page; ⌘K (Ctrl K) still opens the search.
  - A toolbar tooltip wider than the screen, such as the "scaled to fit" one, wraps inside it.
  - The keyboard shortcuts dialog fits a 320px screen.

- 7b10341: fix: build catalog entries with long IDs; ignore a workspace package named `preview` that has no catalog files, and fail on one that has them before the previous catalog is removed; on the catalog page, turn `X-Frame-Options: DENY` into `SAMEORIGIN` and allow `'self'` in a Content-Security-Policy `frame-ancestors`, so previews load; match catalog files, their `.md` and component files, and Tailwind CSS entries by case on every platform; and write no catalog files with `build.write: false`.
- e965226: fix: run the accessibility check under a `script-src 'self'` policy, reject a `groups` directory written in another case, and show the real error of a module imported by name.

  - The accessibility check loads axe-core as a script file of the catalog (`/__zukan/axe.js` on the dev server, a file under `_zukan/` in the static export) instead of an inline script, so a Content-Security-Policy of `script-src 'self'` in `server.headers` or `preview.headers` no longer makes it fail with "Cannot read properties of undefined (reading 'run')".
  - A `groups` directory written in another case than on disk (`src/Lib` for `src/lib`) is an error that names both spellings on macOS and Windows too, as it is on Linux, instead of a catalog whose edits never reload.
  - A module only the catalog imports that fails to compile now shows its own error in the preview when a catalog file imports it by name (`import { x } from './bad.ts'`), instead of "does not provide an export named", and the error names the file relative to the Vite root.

## 0.16.4

### Patch Changes

- 42f9efd: fix: name each preview toolbar after its section, name the accessibility check's close button after the check, and make the sidebar's group titles headings, so screen readers can tell them apart and navigate to them.
- 8932ab2: fix: on the dev server, a compile or import error in a catalog file (or in a file only catalog files import) shows in its preview instead of Vite's error overlay on the app's tabs, which stayed after the fix.
- 6133229: fix: keep a props default that is a regex literal containing `//` or `/*` as written.
  fix: follow a props type imported from `'.'` or `'..'` to that folder's `index.ts` / `index.d.ts`.
  fix: render a `.zukan.md` that starts with a byte order mark, and give it to `catalog.json` without the mark.
- 32ce93d: fix: order Tailwind CSS tokens whose value is a `calc()` with `+` or `-` (such as shadcn's radii) among the defaults, and stop showing a theme variable of another namespace for a token whose class does not read it.
- 764ec7d: fix: leave the expanded preview when the URL goes to another section of the same component, let Escape leave the expanded preview from a checkbox inside the preview, and run the WebMCP `check_accessibility` check with the chosen theme's `prefers-color-scheme`.

## 0.16.3

### Patch Changes

- 90aa4ec: fix: several fixes to the Vite plugin.

  - On the dev server, a duplicate catalog ID no longer puts a Vite error overlay on any tab, including the app's: the catalog's top page shows the error, and `/__zukan/catalog.json` answers 500 with `{ "error" }`, which the WebMCP tools report.
  - The catalog build no longer inherits `build.rolldownOptions.external` (library mode), so it no longer imports a bare `svelte` it can not load.
  - The catalog's `build.outDir` is also checked against the `build.outDir` of each environment other than the catalog's, including one a `configEnvironment` hook sets.
  - `vite preview` serves the catalog's .pdf, .txt, .vtt, audio, .mov and .webmanifest files with their content types instead of octet-stream.

- 09e5212: fix: read catalog files and components that start with a byte order mark without shifting the code view, error lines, prop types and defaults by one character; keep a leading `*` in the first line of a prop's JSDoc (`/** **Deprecated** */`); parse a file that has `<style>` inside an attribute or expression (`<Code code="<style>" />`) instead of failing it and dropping its props table; and ignore directories whose names end in `.zukan.svelte` or `.svelte` when listing catalog and uncataloged files.
- 35757c7: fix: read Tailwind CSS tokens correctly with `@import "tailwindcss" important`, root variables declared together with other selectors (`:root, [data-theme="light"]`), `@theme inline` tokens that share a value and suffix with another namespace, theme keys with an escaped dot (`--spacing-2\.5`), and project opacities written as plain numbers (ordered among the default percentages).
- a5d034b: fix: a section opened from a link stays in view only while the URL names it, so a preview growing after Back no longer scrolls the page back to it; a link, a search result or WebMCP `open_component` to the section already shown scrolls to it again, also after an in-page anchor in the description; `open_component` answers an unknown section with an error instead of opening it; and Escape in the width field of an expanded preview cancels the edit without leaving the expanded view.

## 0.16.2

### Patch Changes

- 25416e7: fix: in the static catalog, write a component's Web Worker under `_zukan/` with a relative URL, and define `$app/manifest` and the dynamic public env of `$app/env/public` for SvelteKit, which failed in a preview.
- a08a256: fix: hot-reload the catalog for a `groups` directory reached through a `node_modules` link (new or deleted catalog files, `.md` edits), and skip `node_modules` in a scanned directory whose path contains glob characters such as `[` or `{`.
- 6337ea9: fix: show a store read as `$store`, a `style:` shorthand directive's variable and a function's overload signatures in a section's code, keep absolute paths out of `catalog.json`'s `error` for a catalog file outside the Vite root, and preview a multi-line section title in a file with CRLF line endings.
- 38383f9: fix: editing the `logo` reloads only the catalog tab, a catalog file that does not compile shows its error on its detail page instead of an error overlay in every tab, an app page that imports a catalog file keeps its HMR, a catalog file outside the scanned directories no longer reloads the catalog, a logo in `publicDir` no longer makes Vite warn on every load, and the dev server answers `/__zukan/` only for GET and HEAD.
- 58b2862: fix: read a component's props type from the `.svelte.d.ts` that svelte-package writes (also through `ComponentProps<typeof Button>`) and from a `.svelte.ts` module, name every props type the table can not list, keep the spaces in the strings of a prop's type and default, merge an interface declared twice, read a `.ts` file with `</script>` in it, resolve a `.js` subpath of a package without `exports` to its `.d.ts`, and skip a computed key in the props destructuring.
- 097dde5: fix: treat a `@theme` file reached through plain CSS imports as a partial, add Tailwind's utilities to the samples of an entry that imports only `tailwindcss/theme.css`, report a section whose component throws while rendering as an error in the accessibility check instead of "no issues", and let `check_accessibility` run as soon as a section without elements has rendered.
- dee9587: fix: move the focus into a preview expanded with `F` and back to where it was on leaving, keep `⌘K` (`Ctrl+K`) for the catalog's search when the Vite DevTools dock is on the page, and let a click or a scroll in a preview release a section opened from a link.
- 3d01abb: fix: keep a section opened from a link at the top while the previews above it load, keep the keyboard inside an expanded preview, and make a link copied at full width open at full width.
- 23f19e1: fix: a component that reads `$app/env/public`, `$env/dynamic/public` or `$env/static/public` no longer fails to load in a dev preview of a SvelteKit app.
- 087dfdb: fix: editing a `logo` that the app also imports with `?url` no longer full-reloads the app's tabs.
- 926a101: fix: ignore a `.zukan.md` file outside the scanned directories, which reloaded the catalog.
- 4d6c110: fix: show HTML in a prop's JSDoc as text, render `{@link}` tags as code or links, and wrap a prop's type only between the members of its top-level union.
- 55aa649: fix: read more props types: `@types/<name>` for a package without its own types, the `.d.ts` next to `main`, a folder subpath of a package without `exports`, a default-exported interface, a namespace import (`T.Props`), `Omit` and `Pick` over a type the table can list, and `ComponentProps<typeof X>` of a source component.
- 6bb06a0: fix: no longer import Tailwind CSS a second time into the sample of a Tailwind CSS entry that imports it through another stylesheet, which doubled the preflight.

## 0.16.1

### Patch Changes

- 98e07fa: fix: list a prop declared twice once instead of breaking the detail page, and read more props types: a name exported under another name (`export { Inner as Props }`), a folder's `index.d.ts`, and the `.d.ts` next to the JavaScript file a package's `exports` points to when it has no `types` condition.
- e51f247: fix: refresh the props table when a file a props type is imported from is created or deleted while the dev server runs.
- be7faf3: fix: link the table of contents to the props with a catalog URL (`#/<ID>?section=`), so it opens in a new tab and replaces the section in the URL, and keep the section a link scrolled to marked, also near the end of the page.

## 0.16.0

### Minor Changes

- 10dab8a: feat: type the destructured props that come from a package type, such as `children`, `disabled` and `class` from `HTMLButtonAttributes`, from the package's declaration file, and describe a prop with the JSDoc comment on its destructuring when its type has none.

### Patch Changes

- 2bda212: fix: show the required and bindable labels of the props table as colored badges.
- 3903e3c: fix: show the props table right under the component's description, above the sections, and reword the Japanese props labels (「デフォルト」, 「バインド可能」).
- 87ddd0b: fix: refresh the props table when the types of a workspace package change, and read a package whose types point at its source `.ts`.

## 0.15.0

### Minor Changes

- b0ef4dd: feat: add the `migrate-svelte-zukan` agent skill, which moves a component catalog from Storybook or Histoire to svelte-zukan.

### Patch Changes

- 9f45837: fix: leave Storybook (`*.stories.svelte`) and Histoire (`*.story.svelte`) story files out of `uncataloged`.

## 0.14.0

### Minor Changes

- 03cb1f2: feat: the agent skill now covers setting up svelte-zukan (plugin order, which options a project needs, and monorepos) and documenting a component with JSDoc on its props and a `.zukan.md` file.

### Patch Changes

- 3fa1211: fix: a preview opened with a theme (a preview in its own tab, or the WebMCP `check_accessibility` tool) keeps the html and body background of the app's CSS instead of covering it with the theme's color, so axe-core measures contrast against the app's own background.

## 0.13.2

### Patch Changes

- d61a90c: fix: observe a preview's size from the preview frame itself, so a frame taken away (as when the browser is closed) no longer reports a "ResizeObserver loop" error on every frame, which Vite forwards to the dev terminal.

## 0.13.1

### Patch Changes

- f86befa: fix: on a narrow screen the accessibility panel keeps its close button on the first row; a search snippet starts and ends between words; and while the Tailwind CSS filter has text, the category list counts the matching tokens and dims the categories without any.

## 0.13.0

### Minor Changes

- 0d6d77a: fix: the `svelte` peer dependency is now `^5.46.4`, the version Vite 8's Svelte plugin requires; the catalog UI already needed Svelte 5.29 or later for `{@attach}`.

### Patch Changes

- 6bec00d: fix: picking the section already in the URL in the ⌘K search scrolls to it again; a CSS file edited into a Tailwind CSS entry (`@theme` or `@import "tailwindcss"` added) shows up without a restart; and deleting a component next to a catalog file reloads only the catalog tab.
- 20674d5: fix: catalog navigation and state fixes. The table of contents' Props link scrolls to the props without putting `#zukan-props` in the URL, and Back onto an in-page anchor of a doc shows the page it was on. Back and Forward keep the scroll position the browser restores instead of jumping to the top. Each detail page starts with its own table of contents marker and no expanded preview, F with the props in view expands the last section, and a link to the section already in the URL scrolls to it again. On a narrow screen, clicking a folder in the menu no longer closes it. WebMCP's `check_accessibility` without a `theme` renders in the catalog's current theme, as the accessibility panel does.
- 87b2876: fix: editing a file a props type is imported from reloads only the catalog tab, never every tab, and no longer fails after its component is deleted; a component created next to a catalog file shows its props table at once; creating a route file or a test no longer reloads the catalog.

  fix: a `<style>` written in a `<script>` or an HTML comment no longer breaks parsing; the code view keeps the quotes of `generics`; the props table follows `export … from` re-exports and shows a union or other type it can not list as written.

  fix: an installed `svelte-zukan` is prebundled up front, so the first catalog visit no longer re-optimizes and reloads the page; the printed catalog URL has a `/` before `__zukan/` under SvelteKit's `paths.base`; a catalog `build.outDir` inside the app's `publicDir`, an empty group name and a group without directories are errors; `vite preview` serves more asset types (`.jpeg`, `.wasm`, fonts, video) with their content type.

- ce7b7cf: fix: a preview with a `100vh` element beside more content no longer grows without end; the expanded view keeps the preview visible and scrolls a long accessibility list; the catalog's shortcuts, Esc included, work while the focus is inside a preview; the accessibility check runs again after an edit applied in place, no longer fails with "Axe is already running" when the panel is reopened during a check, and scrolls to a picked element in a scaled or expanded preview; arrow keys on the resize grip keep a width wider than the stage; the page's own `html` background is kept; the background switch applies to every preview on the page; and the code view no longer takes an apostrophe in text, a URL or a nested template literal for a string or a comment.
- 17b40bd: fix: on the Tailwind CSS page, keep the entry's `[data-theme]` rules and the catalog's font out of the samples, order size tokens by value, show an `@theme inline` alias's own variable, and treat a partial reached through a symlinked directory as a partial.
- d2e9f19: fix: an expanded preview fills the screen with the page's own background, the shortcuts button is hidden on touch screens, and paths without a catalog file wrap after a slash.

## 0.12.0

### Minor Changes

- 83babb0: feat: add "Text 200%" and "Tab order" to the accessibility panel. The first doubles the preview's root font size, as raising the browser's default font size does; the second numbers the elements the Tab key moves to. The "Highlight issues" switch is now "Outline where issues were found".

### Patch Changes

- c0516b7: fix: the top page fits each thumbnail to its example, centred and at most at its real size, in the example's own background; a narrow props table lists each prop on its own; Tailwind CSS colors are short rows on a phone; and the not-found page links back to the list and to the search.

## 0.11.0

### Minor Changes

- cfd65c6: feat: list what axe-core cannot decide on its own, such as the contrast of text over an image, under "Needs a manual check" in the accessibility panel, and as `review` in the `check_accessibility` WebMCP tool, whose result is now `{ violations, review }`.

### Patch Changes

- 12a89b8: fix: the catalog UI keeps its logo and search box in a landmark, stops its own transitions when the system asks for reduced motion, and keeps selections and color samples visible in forced colors mode.
- 96b03b2: fix: the accessibility panel finds and outlines an element inside a shadow root, listed as `host >>> inner`, instead of outlining the elements outside that its selectors also match.

## 0.10.0

### Minor Changes

- d645eed: feat: show the project's Tailwind CSS v4 theme in the catalog and in catalog.json.

## 0.9.1

### Patch Changes

- f49f433: fix: centre the head of the accessibility check's icon on its body.
- bcaf992: fix: a shared link's theme now reaches the previews when it differs from the theme stored in the browser; list thumbnails are centred vertically again; on a narrow toolbar the wrapped row of tools is evenly spaced.

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
