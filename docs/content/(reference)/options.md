---
title: Options
sidebar:
  order: 1
---

```ts
zukan({
  suffix: 'zukan',
  groups: { ui: 'src/lib', examples: ['src/examples', 'src/demo'] },
  wrapper: '.zukan/Wrapper.svelte',
  logo: '.zukan/logo.svg',
  title: 'zukan',
  locale: 'en',
  theme: 'dark',
  build: { outDir: 'zukan-dist' }
});
```

| Option    | Type                                 | Default        | Description                                                                                                                                                 |
| --------- | ------------------------------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `suffix`  | `string`                             | `'zukan'`      | Suffix of catalog files. Must match `/^[a-z0-9-]+$/i`                                                                                                       |
| `groups`  | `Record<string, string \| string[]>` | auto-discovery | Group name → directories to scan. If given, [automatic discovery](/monorepo) is skipped. Groups keep the order of the keys. A missing directory is an error |
| `wrapper` | `string`                             | none           | Path to a `.svelte` file that [wraps each preview](/wrapper)                                                                                                |
| `logo`    | `string \| false`                    | bundled logo   | Path to the sidebar logo image. `false` hides the logo and shows the `title` text instead                                                                   |
| `title`   | `string`                             | `'zukan'`      | The sidebar logo's `alt` and the page `<title>`                                                                                                             |
| `locale`  | `'en' \| 'ja'`                       | `'en'`         | UI language. `<html lang>` follows it                                                                                                                       |
| `theme`   | `'light' \| 'dark'`                  | none           | Fixes the catalog and every preview to this [theme](/catalog-ui) and removes the theme switch. Without it, viewers switch between light and dark            |
| `build`   | `boolean \| { outDir?: string }`     | `false`        | [Write the catalog statically](/static-export) during `vite build`. With `true`, `outDir` is `'zukan-dist'`                                                 |

- All paths are relative to Vite's root, and can point outside `src`, such as `.zukan/`
- Invalid values (a `suffix` that does not match the rule, an unknown `locale` or `theme`, a file or directory that does not exist, an empty `groups` key or an empty list of directories) cause an error when the config is loaded
- `groups` directories are matched by case on every platform: on macOS and Windows, `src/Lib` for a directory named `src/lib` is an error that names both spellings (on Linux it is not found)
- If a `groups` key consists only of digits, JavaScript orders it numerically instead of in declaration order. Include a non-digit character in group names
- Symbolic links to directories inside a scanned directory are not followed. To include a linked directory, point a `groups` entry at the link itself

## UI language

The catalog UI is in English by default. `locale: 'ja'` switches it to Japanese. The messages of the accessibility checks follow it too. Strings you write yourself, such as `groups` keys and section titles, are not translated. The plugin's error messages are always in English.
