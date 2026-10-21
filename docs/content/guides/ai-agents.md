---
title: AI agents
sidebar:
  order: 7
---

An AI coding agent can write catalog files and check them without a browser. svelte-zukan gives it three things: these docs as text, the catalog as data, and a skill that says how to work with both.

## The docs as text

- [`llms.txt`](https://oekazuma.github.io/svelte-zukan/llms.txt) lists the pages, and [`llms-full.txt`](https://oekazuma.github.io/svelte-zukan/llms-full.txt) has all of them in one file
- Every page is also available as Markdown: add `.md` to its URL, as in `https://oekazuma.github.io/svelte-zukan/quickstart.md`

## The catalog as data

The dev server serves `/__zukan/catalog.json`, and `vite build` with `build: true` writes the same data to `catalog.json` next to `index.html`. Paths in it are relative to Vite's root.

| Field                     | What it holds                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `components[].id`         | The [catalog ID](/guides/catalog-ids)                                                                             |
| `components[].file`       | The catalog file                                                                                                  |
| `components[].component`  | `Button.svelte` next to `Button.zukan.svelte`, or `null`                                                          |
| `components[].doc`        | The `.md` file as Markdown, or `null`                                                                             |
| `components[].props`      | The [props table](/guides/catalog-files#props-table): name, type, default, required, bindable, description (HTML) |
| `components[].sections[]` | Each section's `title`, its `code` as the code view shows it, and `preview`, the hash of its preview page         |
| `components[].error`      | Why the catalog file does not compile, when it does not; its `sections` are then empty                            |
| `uncataloged[]`           | `.svelte` files in the scanned directories with no catalog file next to them                                      |

`preview` is a hash on the catalog page: `/__zukan/#/preview/ui/Button?section=Primary` shows only that section, so it is a good page for a screenshot. Add `&theme=dark` for the dark theme. The page fills the window, so set the window's width for a phone or tablet layout.

## The skill

The package includes a skill for agents that read [Agent Skills](https://agentskills.io): `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`. It says how to find what to catalog, how to write a catalog file, and how to check it. Copy the folder to where your agent looks for skills, for example `.claude/skills/svelte-zukan/` for Claude Code:

```sh
mkdir -p .claude/skills && cp -r node_modules/svelte-zukan/skills/svelte-zukan .claude/skills/
```

## A line for AGENTS.md

For an agent that reads `AGENTS.md` or `CLAUDE.md`, a few lines are enough:

```md
## Component catalog

Components are cataloged with svelte-zukan. When you add or change a component in `src/lib`, add or update
`<Name>.zukan.svelte` next to it. Follow `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`, and check the
result in `/__zukan/catalog.json` on the dev server.
```
