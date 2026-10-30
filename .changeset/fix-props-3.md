---
'svelte-zukan': patch
---

fix: read catalog files and components that start with a byte order mark without shifting the code view, error lines, prop types and defaults by one character; keep a leading `*` in the first line of a prop's JSDoc (`/** **Deprecated** */`); parse a file that has `<style>` inside an attribute or expression (`<Code code="<style>" />`) instead of failing it and dropping its props table; and ignore directories whose names end in `.zukan.svelte` or `.svelte` when listing catalog and uncataloged files.
