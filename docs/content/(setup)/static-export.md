---
title: Static export
sidebar:
  order: 2
---

With `build: true`, `vite build` also writes the catalog as static files.

```ts
// vite.config.ts
zukan({ build: true });
```

The catalog is written to `zukan-dist/`, separately from the app build. You can choose another directory with `build: { outDir: 'docs/zukan' }`. Because it is separate from the app's build output, an adapter's output step does not delete it. Add `/zukan-dist` to `.gitignore`.

- Output paths are relative, so the catalog works under any subpath (for example, `/docs/zukan/`). No server-side rewrites are needed
- When `build` is enabled, `vite build` runs in Vite's builder mode (Environment API), and all environments are built in one run
- The catalog's CSS targets browsers with `light-dark()` (Chrome and Edge 123, Firefox 120, Safari 17.5), whatever `build.cssTarget` the app sets, so `light-dark()` in your components follows the catalog's theme button
- `vite preview` serves the exported catalog at `/__zukan/` (under `base` when it is set), so you can check it before you deploy it
- A catalog tab left open across a redeploy still asks for the previous build's files. When one of them is gone, the catalog reloads once to pick up the new build (at most once every 10 seconds; after that, the preview shows the error)
- `vite build --watch` does not write the catalog. It prints a warning and skips it
- The output directory must not be Vite's root or contain it, and must not overlap the app's `build.outDir` (`dist` by default), the `build.outDir` of each environment other than the catalog's, or SvelteKit's `outDir` (`.svelte-kit`), and must not be inside the app's `publicDir` (`public`, or `static` in SvelteKit), which the app copies before the catalog is written. Each of these is a build error
- The catalog is written by `vite build` (and by `createBuilder().buildApp()` from Vite's JavaScript API). `vite build --ssr` and Vite's `build()` function build a single environment and do not write it
- Next to `index.html`, `catalog.json` lists every component with its sections, code, props and `.md`, and the `.svelte` files without a catalog file, for tools and AI agents. The dev server serves the same data at `/__zukan/catalog.json`
- Before writing, only the previous catalog (`_zukan/`, `index.html` and `catalog.json` in the output directory) is removed. In SvelteKit, adapters often empty `build/`, so a warning is printed if the output directory overlaps with `build/`

The [demo](https://oekazuma.github.io/svelte-zukan/demo/) is the catalog of svelte-zukan's own components, exported this way.
