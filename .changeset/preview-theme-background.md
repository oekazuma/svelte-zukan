---
'svelte-zukan': patch
---

fix: a preview opened with a theme (a preview in its own tab, or the WebMCP `check_accessibility` tool) keeps the html and body background of the app's CSS instead of covering it with the theme's color, so axe-core measures contrast against the app's own background.
