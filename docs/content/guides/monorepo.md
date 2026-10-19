---
title: Monorepos
sidebar:
  order: 3
---

Without the `groups` option, svelte-zukan finds catalog files on its own, in this order:

1. The `src` of the package at Vite's root (the catalog app itself)
2. The `src` of the workspace packages the app depends on, in the order of `dependencies` then `devDependencies` in the app's `package.json`

The group name is the `name` in the package's `package.json`, or the directory name when there is none. A package without catalog files does not become a group.

## How dependencies are found

Dependency packages are found through the links in the catalog app's own `node_modules/<dependency name>` (pnpm), or in the workspace root's `node_modules/<dependency name>` (npm, yarn and bun).

- Yarn Plug'n'Play has no `node_modules`, so packages are not found there. Use `groups` instead
- Transitive dependencies are not scanned. For apps or packages that the app does not declare as dependencies, use `groups`

## Choosing directories with `groups`

With `groups`, automatic discovery is skipped and only the listed directories are scanned. For example, when the catalog app `apps/catalog` should show the components of another app, `apps/web`:

```ts
// apps/catalog/vite.config.ts
zukan({
  groups: {
    web: '../web/src',
    ui: '../../packages/ui/src'
  }
});
```

Paths are relative to Vite's root. A group can also list several directories: `{ examples: ['src/examples', 'src/demo'] }`.
