---
title: プレビューを囲む
sidebar:
  order: 4
---

`wrapper` オプションは、プレビューの iframe の中だけを囲みます。Provider やグローバル CSS を入れる場所で、Storybook の `.storybook/preview.js` に当たります。

```ts
// vite.config.ts
zukan({ wrapper: '.zukan/Wrapper.svelte' });
```

wrapper は `children` を受け取って描画します。

```svelte
<!-- .zukan/Wrapper.svelte -->
<script lang="ts">
  import '../src/app.css';
  import ThemeProvider from '../src/lib/ThemeProvider.svelte';

  let { children } = $props();
</script>

<ThemeProvider>{@render children()}</ThemeProvider>
```

wrapper が読み込むグローバル CSS は、カタログの UI 側には効きません。カタログの UI は独立した HTML で、アプリの CSS も読み込みません。
