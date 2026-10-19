---
title: 静的な書き出し
sidebar:
  order: 5
---

`build: true` にすると、`vite build` のときにカタログも静的なファイルとして書き出します。

```ts
// vite.config.ts
zukan({ build: true });
```

カタログは、アプリのビルドとは別に `zukan-dist/` へ書き出されます。`build: { outDir: 'docs/zukan' }` のように出力先も選べます。アプリのビルドの出力先とは別なので、adapter の書き出しに消されません。`/zukan-dist` は `.gitignore` に足してください。

- 出力のパスは相対パスなので、どのサブパス（例: `/docs/zukan/`）に置いても動きます。サーバー側の書き換え設定は要りません
- `build` を有効にすると、`vite build` は Vite の builder モード（Environment API）で動き、全環境が 1 回の実行でビルドされます
- `vite build --watch` ではカタログを書き出しません。警告を出して飛ばします
- 書き出しの前に、前回のカタログ（出力先の `_zukan/` と `index.html`）だけを消します。SvelteKit では、adapter が `build/` を空にすることが多いので、出力先が `build/` と重なると警告を出します

[デモ](https://oekazuma.github.io/svelte-zukan/demo/)は、svelte-zukan 自身のコンポーネントのカタログをこの方法で書き出したものです。
