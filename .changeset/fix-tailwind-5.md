---
'svelte-zukan': patch
---

fix: read Tailwind CSS root variables declared in `:where(:root)` (daisyUI 5), watch a `@plugin` or `@config` file that throws, show the variable of Drop Shadow tokens, and leave Tailwind's reference-only compatibility variables (`--radius`, `--shadow`, `--blur`, …) out of the full config and `catalog.json`.
