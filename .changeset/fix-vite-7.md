---
'svelte-zukan': patch
---

fix: build catalog entries with long IDs; ignore a workspace package named `preview` that has no catalog files, and fail on one that has them before the previous catalog is removed; on the catalog page, turn `X-Frame-Options: DENY` into `SAMEORIGIN` and allow `'self'` in a Content-Security-Policy `frame-ancestors`, so previews load; match catalog files, their `.md` and component files, and Tailwind CSS entries by case on every platform; and write no catalog files with `build.write: false`.
