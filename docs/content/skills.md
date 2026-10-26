---
title: Agent skills
sidebar:
  order: 15
---

svelte-zukan ships two [Agent Skills](https://agentskills.io) for AI coding agents such as Claude Code, Cursor and Codex. A skill tells the agent how svelte-zukan works, so you can ask in your own words and get a catalog that follows these docs.

| Skill                                           | Use it to                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| [`svelte-zukan`](#svelte-zukan)                 | Add svelte-zukan to a project, then write, document and check its catalog files |
| [`migrate-svelte-zukan`](#migrate-svelte-zukan) | Move a catalog from Storybook or Histoire                                       |

The agent picks the skill that matches your request on its own, so you do not need to name it.

## Install

Install them with the [skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add oekazuma/svelte-zukan
```

The CLI asks which skills to install and for which of your agents, and puts them in each agent's skill directory in your project. To skip the questions, choose skills with `--skill` (for example `--skill svelte-zukan`) and agents with `-a` (for example `-a claude-code`). Add `-g` to install them for all your projects.

The npm package ships the same skills, in `node_modules/svelte-zukan/skills/`, matching the version you installed. You can also copy them to your agent's skill directory yourself:

```sh
mkdir -p .claude/skills && cp -r node_modules/svelte-zukan/skills/* .claude/skills/
```

## svelte-zukan

The skill for everyday work with the catalog, from the first setup on.

- It sets svelte-zukan up. It reads `package.json` and `vite.config`, puts `zukan()` first in `plugins`, and adds only the [options](/options) the project needs: a [wrapper](/wrapper) for global CSS or providers, `groups` for the directory that holds the components, `theme: 'light'` for an app without a dark mode, and `build: true` only when you want a [static catalog](/static-export). [Monorepos](/monorepo) are covered too
- It writes a catalog file next to each component, with a section for each state worth seeing and realistic content
- It documents each component with a JSDoc comment on each prop, which the [props table](/catalog-files#props-table) reads, and a short `<Name>.zukan.md` on what the component is for
- It checks the result in [`catalog.json`](/ai-agents#the-catalog-as-data) (no errors, the right sections, a description on every prop), in the previews, and with the [accessibility check](/accessibility)

Ask, for example:

- "Set up svelte-zukan in this project and catalog the components in `src/lib`"
- "I added a `size` prop to Button. Update its catalog and docs"
- "Add a catalog file and docs for the new `DatePicker`"
- "Run the accessibility check on the Button sections and fix the violations"

## migrate-svelte-zukan

The skill for a one-time move from Storybook or Histoire. It follows the `svelte-zukan` skill for the setup and the checks, so install both.

| From Storybook or Histoire                                                | To svelte-zukan                  |
| ------------------------------------------------------------------------- | -------------------------------- |
| Each story or variant                                                     | A `<Section>` with the same name |
| `args`                                                                    | Props written on the component   |
| `argTypes` descriptions                                                   | JSDoc on the props               |
| The component's description, the prose of its MDX file, `<Name>.story.md` | `<Name>.zukan.md`                |
| Global CSS and decorators in `preview.*`, Histoire's setup file           | The wrapper                      |
| A `build-storybook` or `story:build` script                               | `build: true`                    |

Some things have no equivalent, and the agent tells you which ones it found:

- Controls: each value worth seeing becomes its own section
- Actions (`fn()`, `logEvent()`): the section shows the effect with state, or leaves the handler out
- `play` functions: they are interaction tests, which svelte-zukan does not run
- Story titles such as `Example/Button`: catalog IDs come from [file paths](/catalog-ids)
- A docs page about no single component, such as an Introduction: it stays where it is, or moves to the README when the old tool goes

The old tool stays in place, side by side with the catalog, until you ask the agent to remove it. Even then, a story with a `play` function keeps it in place until you say that interaction test can go.

Ask, for example:

- "Migrate our Storybook stories and docs to svelte-zukan"
- "Replace Histoire with svelte-zukan"

## A line for AGENTS.md

So that an agent also keeps the catalog up to date when you do not ask, add a few lines to `AGENTS.md` or `CLAUDE.md`:

```md
## Component catalog

Components are cataloged with svelte-zukan. When you add or change a component in `src/lib`, add or update
`<Name>.zukan.svelte` next to it. Follow `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`, and check the
result in `/__zukan/catalog.json` on the dev server.
```
