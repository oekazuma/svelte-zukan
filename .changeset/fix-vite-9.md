---
'svelte-zukan': patch
---

fix: an edit that stops a component compiling, when only its catalog file imports it, now shows the error in the preview and leaves the app's tabs alone. The static catalog keeps its own output whatever `build.rollupOptions.output` the app sets (a `format`, a `dir` or an array). A wrapper, logo or `groups` directory inside the Vite root is now allowed under an explicit `server.fs.allow`, which fixes 404s in SvelteKit with `paths.base`. An error in a module reached through an `export *` barrel now shows the real message instead of a missing-export error. A `groups` directory written in another Unicode normalization than on disk keeps its HMR on macOS. The static catalog now includes a copy of `publicDir`, so `url('/bg.png')` in CSS and imports of public files work under a subpath; a literal `/bg.png` in markup does not, as the static export docs explain.
