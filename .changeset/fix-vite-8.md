---
'svelte-zukan': patch
---

fix: run the accessibility check under a `script-src 'self'` policy, reject a `groups` directory written in another case, and show the real error of a module imported by name.

- The accessibility check loads axe-core as a script file of the catalog (`/__zukan/axe.js` on the dev server, a file under `_zukan/` in the static export) instead of an inline script, so a Content-Security-Policy of `script-src 'self'` in `server.headers` or `preview.headers` no longer makes it fail with "Cannot read properties of undefined (reading 'run')".
- A `groups` directory written in another case than on disk (`src/Lib` for `src/lib`) is an error that names both spellings on macOS and Windows too, as it is on Linux, instead of a catalog whose edits never reload.
- A module only the catalog imports that fails to compile now shows its own error in the preview when a catalog file imports it by name (`import { x } from './bad.ts'`), instead of "does not provide an export named", and the error names the file relative to the Vite root.
