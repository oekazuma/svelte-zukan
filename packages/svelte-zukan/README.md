# svelte-zukan

A component catalog for Svelte. Put a catalog file next to a component and you get a list, a live preview, and a code view.

## Install

```sh
npm install -D svelte-zukan
```

```sh
pnpm add -D svelte-zukan
```

## Usage

Place `zukan()` before `sveltekit()` (or `svelte()` in a plain Vite + Svelte project):

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), sveltekit()] });
```

Put `Button.zukan.svelte` next to `Button.svelte`:

```svelte
<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';
</script>

<Section title="Basic">
  <Button>Click me</Button>
</Section>
```

Start the dev server and open `/__zukan/`.

## With an AI agent

This package ships [two agent skills](https://oekazuma.github.io/svelte-zukan/skills/). Install them and ask your agent (Claude Code, Cursor, Codex, …) to set up svelte-zukan and catalog your components, or to move your stories from Storybook:

```sh
npx skills add oekazuma/svelte-zukan
```

## Links

- [Documentation](https://oekazuma.github.io/svelte-zukan/) ([日本語](https://oekazuma.github.io/svelte-zukan/ja/))
- [Demo](https://oekazuma.github.io/svelte-zukan/demo/)
- [Using it with AI agents](https://oekazuma.github.io/svelte-zukan/ai-agents/)
- [Repository](https://github.com/oekazuma/svelte-zukan)
