---
'svelte-zukan': patch
---

fix: build catalog entries with long IDs, ignore a workspace package named `preview` that has no catalog files, let the catalog page frame its own previews under `X-Frame-Options: DENY` or a CSP `frame-ancestors`, match catalog and Tailwind CSS file names case-sensitively on every platform, and write no catalog files with `build.write: false`.
