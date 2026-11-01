---
'svelte-zukan': patch
---

fix: catalog UI accessibility and layout fixes.

- Closing the accessibility panel returns the focus to its toggle, and Check again keeps the focus while it runs.
- Following a sidebar link on a narrow screen moves the focus to the main content instead of the body.
- Long component names wrap on detail pages and in search results instead of scrolling the page sideways or being clipped.
- The initial tile of a component without sections keeps white text above 3:1 at every hue.
- The sidebar search shows "No matches" only once section titles are loaded, and both searches announce the number of results.
- The Tailwind CSS link in the sidebar is marked current for an unknown `source`, as the page shows the first entry.
- The expand button is no longer announced as pressed on top of its changing name.
- The WebMCP `check_accessibility` tool gives separate errors for an unknown ID and a missing section, listing the component's sections.
