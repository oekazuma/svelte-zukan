---
'svelte-zukan': patch
---

fix: read props types through aliases, subpath imports and namespace re-exports.

- A type imported through an alias, such as `$lib/utils.js` with `alias: { $lib: 'src/lib' }` in SvelteKit's config, or through `imports` in `package.json`, such as SvelteKit's `#lib/utils.js`, is now read as a file of the project, and editing that file refreshes the table.
- `P.Props` now reads through `export * as P from './p'`, as with `Accordion.TriggerProps` from `bits-ui`, and `ComponentProps<typeof P.Root>` through a namespace.
- Imports are now followed up to six files deep instead of three, which a package's chain of barrels needs.
