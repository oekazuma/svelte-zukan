<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg" />
    <img src=".github/logo.svg" alt="zukan" width="320" />
  </picture>
</p>

<p align="center">
  A component catalog for Svelte. Put a catalog file next to a component and you get a list, a live preview, and a code view.
</p>

<p align="center">
  <b>English</b> | <a href="README.ja.md">日本語</a>
</p>

"zukan" (図鑑) is Japanese for "illustrated encyclopedia".

## Quick start

```sh
npm install -D svelte-zukan
```

Add `zukan()` before `sveltekit()` (or `svelte()`):

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), sveltekit()] });
```

Put a catalog file next to the component:

```
src/lib/Button/
├── Button.svelte
└── Button.zukan.svelte
```

```svelte
<!-- Button.zukan.svelte -->
<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';
</script>

<Section title="Basic">
  <Button>Click me</Button>
</Section>
```

Start the dev server and open `/__zukan/`. See the [quickstart](https://oekazuma.github.io/svelte-zukan/quickstart/) for more.

## With an AI agent

Install the [skill](https://oekazuma.github.io/svelte-zukan/ai-agents/#the-skill) and ask your agent (Claude Code, Cursor, Codex, …) to set up svelte-zukan and catalog your components:

```sh
npx skills add oekazuma/svelte-zukan
```

## Links

- [Documentation](https://oekazuma.github.io/svelte-zukan/)
- [Demo](https://oekazuma.github.io/svelte-zukan/demo/)
- [Using it with AI agents](https://oekazuma.github.io/svelte-zukan/ai-agents/)
- [Contribution Guide](CONTRIBUTING.md)

## License

[MIT](LICENSE.md)
