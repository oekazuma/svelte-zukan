---
'svelte-zukan': patch
---

fix: editing a file a props type is imported from reloads only the catalog tab, never every tab, and no longer fails after its component is deleted; a component created next to a catalog file shows its props table at once; creating a route file or a test no longer reloads the catalog.

fix: a `<style>` written in a `<script>` or an HTML comment no longer breaks parsing; the code view keeps the quotes of `generics`; the props table follows `export … from` re-exports and shows a union or other type it can not list as written.
