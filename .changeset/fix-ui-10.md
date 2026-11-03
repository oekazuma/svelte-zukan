---
'svelte-zukan': patch
---

fix: keep the preview frame bounded when a section's content is sized to the viewport, such as `height: 150vh` or two `min-height: 100vh` blocks. It used to grow until the browser's limit, which pushed the rest of the page out of reach.
