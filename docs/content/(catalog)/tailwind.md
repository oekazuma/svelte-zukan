---
title: Tailwind CSS tokens
sidebar:
  order: 2
---

When your app uses Tailwind CSS v4, the catalog shows the theme your components are built from: colors, spacing, type, radii, shadows and the rest, with the class that gives each one and a live sample. Use it to check that `bg-brand-500` or `p-4` exists and what it looks like. There is nothing to configure.

## When the page appears

A "Tailwind CSS" link appears in the sidebar, below the components, and a card for each entry at the top of the catalog's top page, when both of these hold:

- **Tailwind CSS 4.1.0 or later is installed with one of its build integrations**: `@tailwindcss/vite`, `@tailwindcss/postcss` or `@tailwindcss/cli`. svelte-zukan loads Tailwind through the same copy that builds your app's CSS, so the catalog and the app always agree. It looks in the `node_modules` of the entry's folder and the folders above it, then in those of Vite's root
- **A Tailwind CSS entry exists**: a CSS file that has `@import "tailwindcss"` (or an import of a `tailwindcss/…` file), or that has `@theme`. They are searched in the directories svelte-zukan already scans for catalog files (see [`groups`](/options) and [monorepos](/monorepo)) and in Vite's root `src`, even when `groups` leaves it out, because a SvelteKit app usually keeps `src/app.css` while its `groups` point at `src/lib`

A CSS file that another entry imports is a partial, not an entry. `@reference` does not count as an import.

A file with `@theme` but no `@import "tailwindcss"` is read with `@import "tailwindcss";` in front of it, so its page shows Tailwind's defaults plus its own tokens, like any other entry. With several entries, each gets its own sidebar link labeled with its path relative to Vite's root.

Without Tailwind, or with Tailwind CSS v3, there is no page, no warning and no extra cost. A project on 4.0.x gets the page with an error asking it to upgrade, see [Errors](#errors).

What the page lists is everything Tailwind resolves from the entry: its defaults, what `@theme` adds or overrides, and what `@plugin` and `@config` load. Imports are resolved the way your app's build does, so aliases such as `$lib/theme.css` work.

## The card

On the top page, above the components, each entry has a card: a strip of the theme's colors, the entry's file and Tailwind version, and the number of tokens and theme variables. Click it to open the page.

## The page

The categories are a list on the left, grouped as Colors, Spacing & sizing, Typography, Borders, Effects and Layout, then **Full config**, each with its token count. On a narrow page the list becomes a select above the tokens. With no category chosen, the first one in the list opens.

Colors come in the theme's order: the default palette in Tailwind's order, then your own colors (the filter finds them), then `current`, `inherit` and `transparent`. The other categories go from small to large by value, so your own sizes sit among the defaults: a zero value or `none` first, `rounded-full` last. The value is computed without a browser, with `1rem` and `1em` as 16px and a unitless line height as a multiple of 16px. A value that cannot be compared that way, such as `auto`, `100%`, `100vw`, a shadow or a font stack, comes after the others. Tokens of equal value, and those that cannot be compared, keep the theme's order. The categories:

| Category                                   | Class                                      |
| ------------------------------------------ | ------------------------------------------ |
| Background Color, Text Color, Border Color | `bg-*` `text-*` `border-*`                 |
| Padding, Margin                            | `p-*` `m-*`                                |
| Font Size, Font Weight, Font Family        | `text-*` `font-*`                          |
| Letter Spacing, Line Height                | `tracking-*` `leading-*`                   |
| Drop Shadow, Box Shadow                    | `drop-shadow-*` `shadow-*`                 |
| Border Radius, Border Width, Opacity       | `rounded-*` `border-*` `opacity-*`         |
| Width, Height, Z-index                     | `w-*` `h-*` `z-*`                          |
| Breakpoints                                | `--breakpoint-*` variables                 |
| Spacing                                    | the `--spacing` base and the `p-*` classes |

A category with no token is left out. **Full config** lists every theme variable and its value, in a table for each namespace (`--color-*`, `--spacing`, `--radius-*` and so on, with the rest under Other). A color value has a swatch, and each variable has a button that copies its name.

Each token has a live sample, its class and its CSS variable, and the value it resolves to. A size also shows its computed size in px, such as `calc(0.25rem * 4) · 16px` for `p-4`. A `var()` that the theme does not define is shown as its fallback when it has one (a shadow reads `0 4px 6px -1px rgb(0 0 0 / 0.1), …`), and as written otherwise. An empty value is shown as `none`. The class and the variable each have a button that copies the name. With a Tailwind `prefix`, the classes carry it (`tw:bg-brand-500`). Breakpoints and the spacing base are no classes, so they show the variable only. A token shows a variable when its class reads one, or, for an `@theme inline` token, when a theme variable holds the same value. An `@theme inline` alias of another theme variable, such as `--color-primary: var(--color-blue-500)`, shows its own variable (`--color-primary`), not the one it points at.

- **Filter**: the box above the tokens keeps those whose class, variable or value contains the text. Full config is filtered by variable and value. The text is kept in the address, as `q` in `#/tailwind?source=…&category=…&q=…`, so a reload or a shared link shows the same tokens. Typing replaces the history entry instead of adding one, and the filter stays when you change category
- **Sample text**: the text categories (Text Color, Font Size, Font Weight, Font Family, Letter Spacing, Line Height) have a field for the text the samples show

Each category lists one class per token, not every utility a token feeds. Colors appear as `bg-*`, `text-*` and `border-*` only, not as `ring-*`, `fill-*` and so on.

### The samples

Background Color, Text Color and the text categories are cards. Shadows are cards too, drawn on a grey panel. Border Color and the size categories (Padding, Margin, Spacing, Width, Height, Border Width, Border Radius, Opacity, Breakpoints, Z-index) are compact rows, so they can be compared at a glance:

- **Padding and Margin** show the space around a block
- **Width, Height and Spacing** draw a bar at its real size. A bar longer than the row fades out at its end. A value that follows the frame, such as `100%` or `100vh`, has no bar
- **Border Color** draws a white box with a thick border in the token's color
- **Breakpoints** are bars proportional to their width
- **Z-index** has no sample, only the names and the value

The samples are drawn in a frame of their own, built from the CSS Tailwind generates for the entry: the theme variables, the entry's own rules, and its preflight. Nothing from the catalog reaches the samples, and Tailwind's CSS does not reach the catalog or your component previews.

The frame is always light, in every catalog theme, because the values shown are the base values. The page around it follows the catalog's theme.

## What it does not show

- **Dark-mode values.** Rules such as `.dark { … }` and `@custom-variant dark` are not read, so each token has one value
- **Arbitrary values and variants.** `p-[13px]`, `hover:` and `md:` are not listed, nor are utilities that take no theme value, such as `flex`
- **Relative `@font-face` URLs.** The samples live in a frame inside the catalog, so a `url()` that is relative to your CSS file does not resolve. A Font Family sample may then fall back to a system font. An absolute URL, or a font that is installed, works
- **Tailwind CSS v3** and `tailwind.config.js` without a v4 entry

## While you work

The data is generated the first time the page, [`catalog.json`](/ai-agents#the-catalog-as-data) or the static build asks for it, not when the dev server starts. A project without a Tailwind CSS entry never pays for it.

On the dev server the page updates when the entry, a file it imports, a plugin or a config file changes, and when a `.css` file is created or deleted in the searched directories. Only a change in the tokens or their samples reloads the catalog tab. Your app's own CSS update goes on as usual, and the app's tabs never reload.

Two cases need more from you:

- **The first entry.** If the project had no Tailwind CSS entry when the dev server started, creating one needs a restart of the dev server for the page to appear.
- **An import created later.** If an entry's `@import` pointed at a file that did not exist yet and you create it outside the searched directories, the page does not refresh by itself. Save the entry again to read it afresh.

With [`build: true`](/static-export), the static catalog includes the page, and its `catalog.json` the data. A project without Tailwind gets no extra file in its output.

## Errors

An entry that fails shows its error on its page, and the rest of the catalog keeps working. In a `vite build` it is a warning, not a failed build. The same message is in the entry's `error` in `catalog.json`.

| Message                                                                               | What to do                                                                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Tailwind CSS <version> is older than 4.1.0, the first version svelte-zukan supports` | Upgrade `tailwindcss` and its integration to 4.1.0 or later                                                            |
| `Tailwind CSS <version> does not expose the design-system API svelte-zukan uses`      | The API svelte-zukan reads is unstable and changed. Update svelte-zukan                                                |
| Any other message                                                                     | It comes from Tailwind, such as an import or a plugin that cannot be resolved. Fix it as you would in your app's build |

For agents, the same data is in [`catalog.json` and the `list_tailwind_tokens` WebMCP tool](/ai-agents).
