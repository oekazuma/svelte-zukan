---
'svelte-zukan': patch
---

fix: resolve Tailwind CSS tokens through the `:root` variables that win the cascade layers, read the last declaration when a class has two of its property, and show no CSS variable on a token whose variable Tailwind never writes (`@theme reference`, `@config`, `@plugin`).
