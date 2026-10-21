# svelte-zukan

A component catalog for Svelte. Put a catalog file next to a component and you get a list, a live preview, and a code view.

![A detail page of the catalog: the component's description, a live preview with its toolbar, and the table of contents](https://oekazuma.github.io/svelte-zukan/screenshots/detail-light.webp)

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

## Documentation

Catalog files, monorepos, static export, and every option: https://oekazuma.github.io/svelte-zukan/

## Repository

https://github.com/oekazuma/svelte-zukan
