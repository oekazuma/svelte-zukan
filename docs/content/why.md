---
title: Why svelte-zukan
sidebar:
  order: 5
---

svelte-zukan does one thing: it shows your Svelte components in a catalog. It is not a workshop with addons, a test runner, or a multi-framework tool. That focus is what keeps it small and quick to set up.

## Compared with Storybook and Histoire

|                           | svelte-zukan                                                 | Storybook                                              | Histoire                                                  |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------- |
| Install size<sup>1</sup>  | **1.0 MB, 4 packages**                                       | 78 MB, 82 packages                                     | 90 MB, 218 packages                                       |
| Svelte 5                  | Yes                                                          | Yes                                                    | No. The Svelte plugin supports Svelte 3 and 4<sup>2</sup> |
| Setup                     | Add `zukan()` to `vite.config.ts`                            | A `.storybook/` directory with its own config files    | `histoire.config.ts` with the Svelte plugin               |
| Where it runs             | Inside your app's dev server, at `/__zukan/`                 | Its own dev server                                     | Its own dev server                                        |
| What you write            | A plain Svelte component with `<Section>` blocks             | Stories in Svelte CSF (`defineMeta`, `<Story>`) or CSF | Stories with `<Hst.Story>` and `<Hst.Variant>`            |
| Docs per component        | A Markdown file next to the component                        | MDX and autodocs                                       | Markdown                                                  |
| Code view                 | Each section, with the `<script>` definitions it uses        | Yes                                                    | Yes                                                       |
| Preview width             | Presets and dragging                                         | Viewport toolbar                                       | Presets                                                   |
| Light and dark background | Yes                                                          | Yes                                                    | Yes                                                       |
| Search                    | Yes                                                          | Yes                                                    | Yes                                                       |
| Props controls            | No, by design (see below)                                    | Yes                                                    | Yes                                                       |
| Event log                 | No                                                           | Yes (actions)                                          | Yes                                                       |
| Tests and a11y checks     | No                                                           | Yes (interaction tests, a11y addon, visual tests)      | No                                                        |
| SvelteKit `$app/*`        | The real modules, in their default state                     | Mocked, including `$app/state`                         | —                                                         |
| Static export             | `build: true` in your own `vite build`; works under any path | `storybook build`                                      | `histoire build`                                          |
| Requirements              | Vite 8+, Svelte 5, SvelteKit 3+ (or plain Vite + Svelte)     | Several bundlers and frameworks                        | Vite; Vue and Svelte 3/4                                  |

<sup>1</sup> Measured on 2026-10-19 with `npm install` in an empty directory, leaving out the peer dependencies every option shares (`svelte`, `vite`, `@sveltejs/kit`). Storybook is `storybook` and `@storybook/sveltekit` without any addon. Histoire is `histoire` and `@histoire/plugin-svelte`.

<sup>2</sup> `@histoire/plugin-svelte` 1.0.0-beta.1, the latest version on 2026-10-19, has the peer dependency `svelte: ^3.0.0 || ^4.0.0`.

## Why choose svelte-zukan

- **Small.** The plugin and its two runtime dependencies (`marked` and `magic-string`) are about 1 MB. There is nothing else to install, update, or keep compatible
- **Nothing to configure.** One line in `vite.config.ts`. Your aliases, plugins, and CSS pipeline already apply, because the catalog runs on your app's own dev server. There is no second process to start
- **Nothing new to learn.** A catalog file is an ordinary Svelte component. You import your component and write examples in the same Svelte 5 code you use everywhere else
- **Next to your code.** `Button.zukan.svelte` and `Button.zukan.md` sit next to `Button.svelte`, so moving or deleting a component takes its catalog with it
- **Easy to publish.** With `build: true`, the same `vite build` writes a static catalog that works under any path, such as GitHub Pages

## Why there are no props controls

In Storybook and Histoire, you can change a component's props from a panel. svelte-zukan leaves this out on purpose. Each `<Section>` is a fixed example that you write as code, and the dev server reloads it as you edit. That keeps the examples reviewable in pull requests, and it keeps the catalog free of a second way to describe props.

## When to choose something else

Pick Storybook if you need any of these:

- Props controls, an event log, interaction tests, accessibility checks, or visual regression tests
- Components from several frameworks in one catalog
- SvelteKit 2, Vite 7 or earlier, or a bundler other than Vite
- Per-story values for SvelteKit's `page` and other `$app/*` modules
