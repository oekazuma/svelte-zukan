---
title: Wrapping previews
sidebar:
  order: 2
---

The `wrapper` option wraps the inside of each preview iframe. This is where you put providers and global CSS, like Storybook's `.storybook/preview.js`.

```ts
// vite.config.ts
zukan({ wrapper: '.zukan/Wrapper.svelte' });
```

The wrapper accepts `children` and renders it.

```svelte
<!-- .zukan/Wrapper.svelte -->
<script lang="ts">
  import '../src/app.css';
  import ThemeProvider from '../src/lib/ThemeProvider.svelte';

  let { children } = $props();
</script>

<ThemeProvider>{@render children()}</ThemeProvider>
```

Global CSS loaded by the wrapper does not affect the catalog's own UI. The catalog UI is a separate HTML page and does not load the app's CSS either.
