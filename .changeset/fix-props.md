---
'svelte-zukan': patch
---

fix: read a component's props type from the `.svelte.d.ts` that svelte-package writes (also through `ComponentProps<typeof Button>`) and from a `.svelte.ts` module, name every props type the table can not list, keep the spaces in the strings of a prop's type and default, merge an interface declared twice, read a `.ts` file with `</script>` in it, resolve a `.js` subpath of a package without `exports` to its `.d.ts`, and skip a computed key in the props destructuring.
