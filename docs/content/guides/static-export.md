---
title: Static export
sidebar:
  order: 5
---

With `build: true`, `vite build` also writes the catalog as static files.

```ts
// vite.config.ts
zukan({ build: true });
```

The catalog is written to `zukan-dist/`, separately from the app build. You can choose another directory with `build: { outDir: 'docs/zukan' }`. Because it is separate from the app's build output, an adapter's output step does not delete it. Add `/zukan-dist` to `.gitignore`.

- Output paths are relative, so the catalog works under any subpath (for example, `/docs/zukan/`). No server-side rewrites are needed
- When `build` is enabled, `vite build` runs in Vite's builder mode (Environment API), and all environments are built in one run
- `vite preview` serves the exported catalog at `/__zukan/` (under `base` when it is set), so you can check it before you deploy it
- `vite build --watch` does not write the catalog. It prints a warning and skips it
- The output directory must not be Vite's root or contain it, and must not overlap the app's `build.outDir` (`dist` by default) or SvelteKit's `outDir` (`.svelte-kit`). Each of these is a build error
- The catalog is written by `vite build` (and by `createBuilder().buildApp()` from Vite's JavaScript API). `vite build --ssr` and Vite's `build()` function build a single environment and do not write it
- Before writing, only the previous catalog (`_zukan/` and `index.html` in the output directory) is removed. In SvelteKit, adapters often empty `build/`, so a warning is printed if the output directory overlaps with `build/`

The [demo](https://oekazuma.github.io/svelte-zukan/demo/) is the catalog of svelte-zukan's own components, exported this way.
