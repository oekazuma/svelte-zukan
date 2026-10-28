---
title: Using SvelteKit features
sidebar:
  order: 3
---

svelte-zukan does not replace or mock SvelteKit's runtime APIs such as `$app/state` and `$app/navigation`. Inside the catalog, SvelteKit's runtime code runs in its default state:

- `page` from `$app/state`: `url.pathname` is an empty string, `params` is `{}`, and `data` is `{}`
- `browser` from `$app/env`: `true`
- `goto` and the other functions from `$app/navigation`: they reject, and the page does not navigate
- `resolve` from `$app/paths`: returns a URL based on the app's `paths.base` (with an empty `paths.base`, `resolve('/')` is `/`). It is not the catalog's own URL
- `asset` from `$app/paths`: like `resolve`, returns a URL based on the app's `paths.base` (for example, `asset('favicon.svg')` is `/favicon.svg`). `paths.assets` is not used inside the catalog. When the catalog reads a file from the app's `static/`, the one served by the app's dev server is used
- `assets`, `immutable`, `prerendered` and `routes` from `$app/manifest`: what SvelteKit's dev server gives in dev, and empty arrays in the static export
- Dynamic public environment variables from `$app/env/public` (or `$env/dynamic/public`): `undefined` in the static export, which has no server to send them. Static variables keep their values

Components that change their display based on the current page, such as navigation, render with these default values in the catalog. Except where noted above, the static export behaves the same way.
