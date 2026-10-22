<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg" />
    <img src=".github/logo.svg" alt="zukan" width="320" />
  </picture>
</p>

<p align="center">
  Svelte のコンポーネントカタログです。コンポーネントの隣にカタログファイルを置くと、一覧・ライブプレビュー・コード表示がそろいます。
</p>

<p align="center">
  <a href="README.md">English</a> | <b>日本語</b>
</p>

zukan は日本語の「図鑑」のことです。

## クイックスタート

```sh
npm install -D svelte-zukan
```

`sveltekit()`（または `svelte()`）より前に `zukan()` を置きます。

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), sveltekit()] });
```

コンポーネントの隣にカタログファイルを置きます。

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

dev サーバーを起動して `/__zukan/` を開きます。詳しくは[クイックスタート](https://oekazuma.github.io/svelte-zukan/ja/quickstart/)を見てください。

## リンク

- [ドキュメント](https://oekazuma.github.io/svelte-zukan/ja/)
- [デモ](https://oekazuma.github.io/svelte-zukan/demo/ja/)
- [AI エージェントと使う](https://oekazuma.github.io/svelte-zukan/ja/ai-agents/)
- [コントリビューションガイド](CONTRIBUTING.md)（英語）

## ライセンス

[MIT](LICENSE.md)
