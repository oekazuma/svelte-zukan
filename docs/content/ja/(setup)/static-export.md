---
title: 静的な書き出し
sidebar:
  order: 2
---

`build: true` にすると、`vite build` のときにカタログも静的なファイルとして書き出します。

```ts
// vite.config.ts
zukan({ build: true });
```

カタログはアプリのビルドとは別に `zukan-dist/` へ書き出されます。`build: { outDir: 'docs/zukan' }` のように出力先も選べます。アプリのビルドの出力先とは別なので、adapter の書き出しに消されません。`/zukan-dist` は `.gitignore` に足してください。

- 出力のパスは相対パスなので、どのサブパス（例: `/docs/zukan/`）に置いても動きます。サーバー側の書き換え設定は要りません
- `build` を有効にすると、`vite build` は Vite の builder モード（Environment API）で動き、全環境が 1 回の実行でビルドされます
- カタログの CSS はアプリの `build.cssTarget` にかかわらず、`light-dark()` に対応したブラウザー（Chrome と Edge 123、Firefox 120、Safari 17.5）向けに出力します。そのため、コンポーネントの `light-dark()` もカタログのテーマボタンに従います
- `vite preview` でも、書き出したカタログを `/__zukan/`（`base` を設定していればその下）で開けるので、公開する前に確かめられます
- 再デプロイの前から開いたままのカタログのタブは、前のビルドのファイルを読みにいきます。そのファイルがもう無いときは、カタログを 1 回だけ読み込み直して新しいビルドに切り替えます（10 秒に 1 回まで。それ以上はプレビューにエラーを表示します）
- `vite build --watch` ではカタログを書き出しません。警告を出して飛ばします
- 出力先は Vite の root そのものや root を含むディレクトリにできません。アプリの `build.outDir`（既定は `dist`）や SvelteKit の `outDir`（`.svelte-kit`）と重なってもいけません。アプリの `publicDir`（`public`、SvelteKit では `static`）の中にも置けません。アプリはカタログを書き出す前に `publicDir` をコピーするからです。どれもビルドエラーになります
- カタログを書き出すのは `vite build`（Vite の JavaScript API なら `createBuilder().buildApp()`）です。`vite build --ssr` と Vite の `build()` 関数は 1 つの環境だけをビルドするので、カタログは書き出しません
- `index.html` の隣に `catalog.json` も書き出します。全コンポーネントのセクション、コード、props、`.md` と、カタログファイルのない `.svelte` ファイルをまとめたもので、ツールや AI エージェント向けです。dev サーバーでは同じ内容を `/__zukan/catalog.json` で返します
- 書き出しの前に、前回のカタログ（出力先の `_zukan/`、`index.html`、`catalog.json`）だけを消します。SvelteKit では、adapter が `build/` を空にすることが多いので、出力先が `build/` と重なると警告を出します

[デモ](https://oekazuma.github.io/svelte-zukan/demo/ja/)は svelte-zukan 自身のコンポーネントのカタログをこの方法で書き出したものです。
