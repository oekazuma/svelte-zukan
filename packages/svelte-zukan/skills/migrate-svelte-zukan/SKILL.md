---
name: migrate-svelte-zukan
description: Move a Svelte project's component catalog from Storybook or Histoire to svelte-zukan. Use when asked to migrate, port or switch stories to svelte-zukan, or to replace Storybook (`.storybook/`, `*.stories.svelte`, `*.stories.ts`, `*.mdx`) or Histoire (`histoire.config.*`, `*.story.svelte`, `*.story.md`) with svelte-zukan.
---

# migrate-svelte-zukan

Each story file becomes a svelte-zukan catalog file, each story a `<Section>`, and the docs move into the component's JSDoc and a `.zukan.md` file. For setting up svelte-zukan, writing catalog files and checking them, follow the svelte-zukan skill. If that skill is not installed, add `svelte-zukan` as a dev dependency first (with the package manager of the lockfile) and read `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`, which ships in the package; https://oekazuma.github.io/svelte-zukan/llms-full.txt has the full docs.

## 1. Take stock

Before writing anything, list:

- Storybook: `.storybook/main.*` (its `stories` globs), `.storybook/preview.*` (global CSS imports, decorators, parameters), every `*.stories.svelte` and `*.stories.{js,ts}`, every `*.mdx`, and the `storybook` / `build-storybook` scripts
- Histoire: `histoire.config.*` (`setupFile`, `theme.title`), the setup file, every `*.story.svelte`, the `<Name>.story.md` next to it, standalone `*.story.md` pages, and the `story:*` scripts
- For each story file, the component it shows and the name of every story in it: `<Story name>`, a CSF export (or its `name`), `<Hst.Variant title>`. The catalog has to match this list at the end

## 2. Set up svelte-zukan

Follow the svelte-zukan skill's setup, carrying over what the old tool had:

| Storybook / Histoire                                                    | svelte-zukan                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Global CSS imported in `preview.*` or the setup file, global decorators | `wrapper`: it imports the CSS and renders the decorators' providers around `{@render children()}` |
| A `build-storybook` or `story:build` script                             | `build: true`, and `zukan-dist` in `.gitignore`                                                   |
| Storybook's brand title, Histoire's `theme.title`                       | `title`                                                                                           |
| Story titles such as `Example/Button` or `Forms/Toggle`                 | Nothing: IDs come from file paths, so leave the components where they are                         |
| `parameters.backgrounds`, viewports, Histoire's grid layout             | Nothing: each preview's toolbar has backgrounds and widths                                        |

## 3. Write a catalog file for each story file

Put `<Name>.zukan.svelte` next to the component, not next to the story file: stories often live in a separate `src/stories/`. When two story files show the same component, write all their stories into that one catalog file. Section titles must stay unique and static: when two stories share a name, add what tells them apart (`Primary (compact)`), and name a section for a control value after that value (`Danger, not dismissible`).

| In the story file                                                           | In the catalog file                                                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Each story or variant, including one with a `play` function                 | A `<Section>` with the same name                                                               |
| The `args` of `preview.*`, of the meta and of the story                     | Props written on the component, the more specific winning: `<Button primary label="Button" />` |
| A `template` snippet, `render`, or a CSF `render`                           | A top-level `{#snippet}` that the sections render                                              |
| A story's own decorator                                                     | The same wrapping markup inside that section                                                   |
| Histoire state and controls (`Hst.Text`, `Hst.Checkbox`, …)                 | `$state` in the `<script>`, and one section for each control value worth seeing                |
| `fn()`, `action()`, `logEvent()`                                            | Leave the handler out, or show its effect in the section with `$state` ("Clicked 2 times")     |
| Svelte 4 syntax in Histoire stories (`export let Hst`, `let:`, `on:`, `$:`) | Svelte 5: runes, snippets and `onclick`                                                        |

## 4. Move the docs

| From                                                                                                      | To                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `argTypes` descriptions                                                                                   | A JSDoc comment on that prop in the component, which the props table reads                                                                |
| `parameters.docs.description.component`, the prose of an MDX file with `<Meta of={…}>`, `<Name>.story.md` | `<Name>.zukan.md`, without its `# Name` heading (the page shows the name) and without blocks such as `<Canvas>` and `<Controls>`          |
| An MDX page or a `*.story.md` page about no single component (Introduction, Welcome)                      | Nothing in the catalog. While the old tool stays, leave the file and tell the user; when it is removed, move the text to the README first |

## 5. Check and report

- `/__zukan/catalog.json`: every component from step 1 is there with no `error`, and every story from step 1 has its section, under its name or the name you gave it to keep titles unique (sections you added for control values come on top)
- `uncataloged[]`: components that had no story before. List them for the user rather than writing catalog files they did not ask for
- In the report, name what has no equivalent: each `play` function (an interaction test), controls, and addons. The accessibility addon's job is done by the catalog's own check

## 6. Remove the old tool only when asked

When the user asked only to migrate, leave Storybook or Histoire in place, both run side by side, and end with the list of what can be removed: the config, the story and MDX files, the packages and the scripts.

When the user asked to remove or replace it and no story has a `play` function, remove those. When a story has one, it is an interaction test that svelte-zukan cannot run: list those tests and remove nothing until the user says they can go.
