---
title: Using it with AI agents
sidebar:
  order: 5
---

An AI coding agent can write catalog files and check them without a browser. svelte-zukan gives it these docs as text, the catalog as data (also as WebMCP tools in the browser), and a skill that says how to work with them.

## The docs as text

- [`llms.txt`](https://oekazuma.github.io/svelte-zukan/llms.txt) lists the pages, and [`llms-full.txt`](https://oekazuma.github.io/svelte-zukan/llms-full.txt) has all of them in one file
- Every page is also available as Markdown: add `.md` to its URL, as in `https://oekazuma.github.io/svelte-zukan/quickstart.md`

## The catalog as data

The dev server serves `/__zukan/catalog.json`, and `vite build` with `build: true` writes the same data to `catalog.json` next to `index.html`. Paths in it are relative to Vite's root.

| Field                     | What it holds                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                   | The [`title` option](/options)                                                                                                                                                    |
| `components[].id`         | The [catalog ID](/catalog-ids)                                                                                                                                                    |
| `components[].group`      | The group: a `groups` key, or the package's `name`                                                                                                                                |
| `components[].name`       | The catalog file's name without `.zukan.svelte`                                                                                                                                   |
| `components[].dir`        | The part of the ID between the group and `name`, or `''`                                                                                                                          |
| `components[].file`       | The catalog file                                                                                                                                                                  |
| `components[].component`  | `Button.svelte` next to `Button.zukan.svelte`, or `null`                                                                                                                          |
| `components[].doc`        | The `.md` file as Markdown, or `null`                                                                                                                                             |
| `components[].props`      | The [props table](/catalog-files#props-table): name, type, default, required, bindable, description (HTML)                                                                        |
| `components[].propsType`  | A props type the table cannot read, such as one from a package, as written in the source; otherwise `null`                                                                        |
| `components[].sections[]` | Each section's `title`, its `code` as the code view shows it, and `preview`, the hash of its preview page                                                                         |
| `components[].error`      | Set when the catalog file is not plain Svelte markup or breaks a [`<Section>` rule](/catalog-files#sections), with the message of that build error; its `sections` are then empty |
| `uncataloged[]`           | `.svelte` files in the scanned directories with no catalog file next to them                                                                                                      |
| `tailwind`                | `null` when no [Tailwind CSS entry](/tailwind) was found (or Tailwind is missing or v3), else one object per entry, described below                                               |

Each `tailwind` object has:

| Field          | What it holds                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`         | The entry, relative to Vite's root                                                                                                                                    |
| `version`      | The Tailwind CSS version                                                                                                                                              |
| `prefix`       | The `prefix` of the theme, or `null`                                                                                                                                  |
| `categories[]` | The utility classes by category: `id`, `title`, and `tokens[]` with `class` (with the prefix; `null` for a breakpoint or the spacing base), `cssVariable` and `value` |
| `variables`    | Every theme variable and its value, as `{ "--color-brand-500": "#ff3e00" }`                                                                                           |
| `error`        | Set when the entry could not be loaded, with the message; `categories` and `variables` are then empty                                                                 |

The classes in `categories` are the ones the theme defines, so an agent that styles a component should use only those. Dark-mode values, arbitrary values and variants are [not part of it](/tailwind#what-it-does-not-show).

`preview` is a hash on the catalog page: `/__zukan/#/preview/ui/Button?section=Primary` shows only that section, so it is a good page for a screenshot. Add `&theme=dark` for the dark theme, unless the [`theme` option](/options) fixes it. The page fills the window, so set the window's width for a phone or tablet layout.

## WebMCP tools in the catalog

In a browser that implements [WebMCP](https://webmachinelearning.github.io/webmcp/), the catalog page also offers its data as tools, so an agent driving the browser does not have to read the screen:

| Tool                   | What it does                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_components`      | Lists the components (ID, name, group, section titles, the first line of each description) and the uncataloged files                                                                                                                                                                                                                                                                              |
| `get_component`        | Returns one component as `catalog.json` has it                                                                                                                                                                                                                                                                                                                                                    |
| `open_component`       | Shows a component's page, optionally at a section, with that section's preview at a width and in a theme                                                                                                                                                                                                                                                                                          |
| `check_accessibility`  | Renders one section on its own and returns axe-core's violations (`violations`) and what it could not decide on its own (`review`)                                                                                                                                                                                                                                                                |
| `list_tailwind_tokens` | With Tailwind CSS data only. Without a `category`, lists each entry's categories and their token counts. With one of the category IDs (`background-color`, `padding`, `font-size`, …), returns its tokens, and with `full-config`, every theme variable as `{ variable: value }` under `variables` instead of `tokens`. `query` keeps the tokens whose class, variable or value contains the text |

Browsers without WebMCP ignore them, and nothing is loaded for them.

## The skill

svelte-zukan has a skill for agents that read [Agent Skills](https://agentskills.io), such as Claude Code, Cursor and Codex. It says how to add svelte-zukan to a project and choose its options, how to find what to catalog, how to write a catalog file and document a component (JSDoc on its props and a `<Name>.zukan.md` file), and how to check the result. Install it with the [skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add oekazuma/svelte-zukan
```

The CLI asks which of your agents to install it for and puts it in each one's skill directory in your project. Choose agents with `-a` (for example `-a claude-code`), or add `-g` to install it for all your projects.

The npm package ships the same skill, at `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`, matching the version you installed. You can also copy that folder to your agent's skill directory yourself:

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
