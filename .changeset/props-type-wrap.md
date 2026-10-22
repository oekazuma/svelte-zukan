---
'svelte-zukan': patch
---

fix: in the props table, wrap a type only between the members of a union, so a type such as `() => void` is never split across lines.
