---
'svelte-zukan': patch
---

fix: observe a preview's size from the preview frame itself, so a frame taken away (as when the browser is closed) no longer reports a "ResizeObserver loop" error on every frame, which Vite forwards to the dev terminal.
