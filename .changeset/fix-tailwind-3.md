---
'svelte-zukan': patch
---

fix: read Tailwind CSS tokens correctly with `@import "tailwindcss" important`, root variables declared together with other selectors (`:root, [data-theme="light"]`), `@theme inline` tokens that share a value and suffix with another namespace, theme keys with an escaped dot (`--spacing-2\.5`), and project opacities written as plain numbers (ordered among the default percentages).
