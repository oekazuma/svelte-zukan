---
'svelte-zukan': patch
---

fix: catalog UI fixes for scroll position, keyboard use and small screens. Back and Forward keep the scroll position on detail pages and the top page. Escape leaves an expanded preview past a non-modal dialog or a manual popover. The search keeps its selected option in view. A contents link and a route that removes the focused element move the keyboard focus to the new place. Long code can be scrolled by keyboard. ⌘K works from a text field in a preview. Pressed toolbar buttons show in forced colors mode, wide images and long names reflow at 320px, low-contrast colors meet WCAG AA, toolbar tooltips can be hovered, and a preview in its own tab has a descriptive title. The WebMCP tools report a catalog file that does not compile and a missing ID.
