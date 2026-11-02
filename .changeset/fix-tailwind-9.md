---
'svelte-zukan': patch
---

fix: correct several values and samples on the Tailwind CSS page. Tokens written with `color-mix()` or `--alpha()` show the mix instead of Tailwind's fallback; a class next to a more specific namespace (`text-primary` with `--text-color-primary`, `p-card` with `--padding-card`) shows the variable it reads; an `@theme inline` token written with a CSS function shows its variable; Full config resolves Tailwind's CSS functions for a theme in any layer or none; breakpoints show their px at the browser's initial font size; Text Color samples stay visible for white tokens; an `@import` with `reference` no longer makes or hides an entry; and an external `@import`, such as a web font, now loads in the samples.
