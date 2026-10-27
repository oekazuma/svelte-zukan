---
title: Catalog IDs and URLs
sidebar:
  order: 2
---

The catalog is a hash-routed SPA. It has only one HTML file, so deep links work as-is wherever you put the exported output.

| URL                                       | Shows                                  |
| ----------------------------------------- | -------------------------------------- |
| `/__zukan/`                               | List                                   |
| `/__zukan/#/<ID>`                         | Detail page                            |
| `/__zukan/#/<ID>?section=<title>`         | Detail page, scrolled to that section  |
| `/__zukan/#/<ID>?section=`                | Detail page, scrolled to its props     |
| `/__zukan/#/preview/<ID>?section=<title>` | Preview for the iframe (no catalog UI) |

Each section heading on a detail page links to that section, so you can share it.

## IDs

An ID is `<group name>/<relative path>`. The relative path is the path from the scanned directory to the catalog file, minus `.<suffix>.svelte`.

- With the group name `my-app`, `src/lib/forms/Button.zukan.svelte` becomes `my-app/lib/forms/Button`
- When the last two segments are the same (`Button/Button`), they are merged into one. `src/lib/Button/Button.zukan.svelte` becomes `my-app/lib/Button`
- Catalog files with the same name in different directories (`forms/Button.zukan.svelte` and `nav/Button.zukan.svelte`) get different IDs. The sidebar shows the directories as folders (`lib` › `forms`) that fold, and the list page shows the directory under the name, so you can tell them apart

An ID does not change unless you move the file. With automatic discovery, `lib/` appears in the ID because the whole `src` directory is scanned. If that bothers you, point [`groups`](/options) at `src/lib`.

## Errors

- A group name that is `preview` or starts with `preview/` is an error, because it is reserved in URLs
- Duplicate IDs are an error, and both file paths are reported. IDs collide, for example, in these cases:
  - `lib/Button.zukan.svelte` and `lib/Button/Button.zukan.svelte`. After merging, both become `my-app/lib/Button`
  - `ui/Card.zukan.svelte` in the group `@acme` and `Card.zukan.svelte` in the group `@acme/ui`. Both become `@acme/ui/Card`
