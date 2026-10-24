---
'svelte-zukan': patch
---

fix: catalog navigation and state fixes. The table of contents' Props link scrolls to the props without putting `#zukan-props` in the URL, and Back onto an in-page anchor of a doc shows the page it was on. Back and Forward keep the scroll position the browser restores instead of jumping to the top. Each detail page starts with its own table of contents marker and no expanded preview, F with the props in view expands the last section, and a link to the section already in the URL scrolls to it again. On a narrow screen, clicking a folder in the menu no longer closes it. WebMCP's `check_accessibility` without a `theme` renders in the catalog's current theme, as the accessibility panel does.
