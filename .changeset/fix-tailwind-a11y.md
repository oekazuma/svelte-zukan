---
'svelte-zukan': patch
---

fix: treat a `@theme` file reached through plain CSS imports as a partial, add Tailwind's utilities to the samples of an entry that imports only `tailwindcss/theme.css`, report a section whose component throws while rendering as an error in the accessibility check instead of "no issues", and let `check_accessibility` run as soon as a section without elements has rendered.
