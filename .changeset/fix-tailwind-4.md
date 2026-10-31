---
'svelte-zukan': patch
---

fix: order Tailwind CSS tokens whose value is a `calc()` with `+` or `-` (such as shadcn's radii) among the defaults, and stop showing a theme variable of another namespace for a token whose class does not read it.
