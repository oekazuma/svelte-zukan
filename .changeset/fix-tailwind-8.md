---
'svelte-zukan': patch
---

fix: show the values Tailwind writes for theme values that use its CSS functions, and count each token once on the Tailwind CSS card.

- A theme value written with `--spacing()`, `--alpha()`, `--theme()` or `theme()` showed as written, for example `p-gutter` as `--spacing(6)`. The Tailwind CSS page, `catalog.json` and WebMCP now show the value Tailwind writes (`calc(0.25rem * 6)`), with its px size, its swatch and its place in the scale, and Full config lists it the same way.
- The token count on the top page's Tailwind CSS card counted every padding class twice, once in Padding and once in Spacing. It now counts each token once.
