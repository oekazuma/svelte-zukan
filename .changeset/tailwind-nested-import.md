---
'svelte-zukan': patch
---

fix: no longer import Tailwind CSS a second time into the sample of a Tailwind CSS entry that imports it through another stylesheet, which doubled the preflight.
