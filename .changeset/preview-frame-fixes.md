---
'svelte-zukan': patch
---

fix: a preview with a `100vh` element beside more content no longer grows without end; the expanded view keeps the preview visible and scrolls a long accessibility list; the catalog's shortcuts, Esc included, work while the focus is inside a preview; the accessibility check runs again after an edit applied in place, no longer fails with "Axe is already running" when the panel is reopened during a check, and scrolls to a picked element in a scaled or expanded preview; arrow keys on the resize grip keep a width wider than the stage; the page's own `html` background is kept; the background switch applies to every preview on the page; and the code view no longer takes an apostrophe in text, a URL or a nested template literal for a string or a comment.
