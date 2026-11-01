---
'svelte-zukan': patch
---

fix: keep the catalog inside narrow screens and keep a preview's dialog keys in the dialog.

- Long inline code, links, the props type and section titles on a detail page wrap instead of scrolling the page sideways at 320px, and a wide table in the `.md` doc scrolls in its own box, which the keyboard can reach.
- A wide custom `logo` or a long one-word `title` no longer pushes the sidebar's search, theme and shortcut buttons out of the sidebar.
- A letter shortcut (J, K, T, F, ?) pressed in a dialog inside a preview stays in the dialog, as on the catalog's own page; ⌘K (Ctrl K) still opens the search.
- A toolbar tooltip wider than the screen, such as the "scaled to fit" one, wraps inside it.
- The keyboard shortcuts dialog fits a 320px screen.
