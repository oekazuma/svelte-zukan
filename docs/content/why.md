---
title: Why svelte-zukan
sidebar:
  order: 5
---

svelte-zukan is a component catalog and nothing else. If a catalog is what you use Storybook for, svelte-zukan gives you one with far less to install, configure and keep up to date.

## What it focuses on

- **The catalog itself.** A list of your components, live previews at phone to desktop widths, the code of each example, a props table, light and dark themes, and accessibility checks. There is no addon system, test runner or story format to learn
- **Little to maintain.** One package in `devDependencies`: about 4 MB with its two runtime dependencies (`marked` for the Markdown, `axe-core` for the accessibility checks, loaded in the browser only when you run a check). There are no addons to keep on matching versions and no config directory to migrate. Upgrading means bumping svelte-zukan
- **Your app's own Vite.** One line in `vite.config.ts`. Your aliases, plugins and CSS pipeline apply as they are, because the catalog runs on your app's dev server. There is no second dev server and no second build config to keep in step with the app
- **Plain Svelte.** A catalog file is an ordinary Svelte 5 component. You import your component and write examples in the same code you use everywhere else, so a catalog file changes when Svelte changes, the way your components do
- **Next to your code.** `Button.zukan.svelte` and `Button.zukan.md` sit next to `Button.svelte`, so moving or deleting a component takes its catalog with it
- **Easy to publish.** With `build: true`, the same `vite build` writes a static catalog that works under any path, such as GitHub Pages

## Compared with Storybook

|                              | svelte-zukan                                                                     | Storybook                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Install size<sup>1</sup>     | **4.2 MB, 3 packages**                                                           | 78 MB, 82 packages                                                                               |
| Setup                        | Add `zukan()` to `vite.config.ts`                                                | A `.storybook/` directory with its own config files                                              |
| Upgrading                    | Bump `svelte-zukan`                                                              | The core, framework and addon packages together, with `storybook upgrade` and its automigrations |
| Where it runs                | Inside your app's dev server, at `/__zukan/`                                     | Its own dev server                                                                               |
| What you write               | A plain Svelte component with `<Section>` blocks                                 | Stories in Svelte CSF (`defineMeta`, `<Story>`) or CSF                                           |
| Docs per component           | A Markdown file next to the component, and a props table read from the component | MDX and autodocs                                                                                 |
| Code view                    | Each section, with the `<script>` definitions it uses                            | Yes                                                                                              |
| Preview width                | Presets, dragging and a typed width; wider ones scaled to fit                    | Viewport toolbar                                                                                 |
| Backgrounds                  | Light and dark, plus a checkerboard and a grid                                   | Yes                                                                                              |
| Search                       | Yes                                                                              | Yes                                                                                              |
| Accessibility checks         | Yes (axe-core, with outlined issues and vision simulation)                       | Yes (a11y addon)                                                                                 |
| Measuring elements           | Yes (box model on hover)                                                         | Yes (measure addon)                                                                              |
| Props controls               | No, by design (see below)                                                        | Yes                                                                                              |
| Event log                    | No                                                                               | Yes (actions)                                                                                    |
| Interaction and visual tests | No                                                                               | Yes                                                                                              |
| SvelteKit `$app/*`           | The real modules, in their default state                                         | Mocked, including `$app/state`                                                                   |
| Static export                | `build: true` in your own `vite build`; works under any path                     | `storybook build`                                                                                |
| Requirements                 | Vite 8+, Svelte 5.46.4+, SvelteKit 3+ (or plain Vite + Svelte)                   | Several bundlers and frameworks                                                                  |

<sup>1</sup> Measured with `npm install` in an empty directory, leaving out the peer dependencies both share (`svelte`, `vite`, `@sveltejs/kit`): svelte-zukan 0.7.0 on 2026-10-21, Storybook on 2026-10-19 (`storybook` and `@storybook/sveltekit`, without any addon).

## Why there are no props controls

In Storybook, you can change a component's props from a panel. svelte-zukan leaves this out on purpose. Each `<Section>` is a fixed example that you write as code, and the dev server reloads it as you edit. That keeps the examples reviewable in pull requests, and it keeps the catalog free of a second way to describe props.

## When to choose Storybook

Storybook does much more than a catalog. Pick it if you need any of these:

- Props controls, an event log, interaction tests, or visual regression tests
- Components from several frameworks in one catalog
- SvelteKit 2, Vite 7 or earlier, or a bundler other than Vite
- Per-story values for SvelteKit's `page` and other `$app/*` modules

## Moving from Storybook

The [`migrate-svelte-zukan` skill](/ai-agents#the-skill) lets an AI agent do the move. Each story becomes a `<Section>`, `argTypes` descriptions become JSDoc on the props, and the MDX prose becomes a `.zukan.md` file. Storybook stays in place until you ask the agent to remove it, and a story with a `play` function is kept until you decide what to do with that interaction test.
