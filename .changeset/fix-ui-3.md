---
'svelte-zukan': patch
---

fix: a section opened from a link stays in view only while the URL names it, so a preview growing after Back no longer scrolls the page back to it; a link, a search result or WebMCP `open_component` to the section already shown scrolls to it again, also after an in-page anchor in the description; `open_component` answers an unknown section with an error instead of opening it; and Escape in the width field of an expanded preview cancels the edit without leaving the expanded view.
