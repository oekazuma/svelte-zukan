---
'svelte-zukan': patch
---

fix: the accessibility panel finds and outlines an element inside a shadow root, listed as `host >>> inner`, instead of outlining the elements outside that its selectors also match.
