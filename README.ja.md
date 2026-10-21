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

`vite.config.ts` で `sveltekit()`（または `svelte()`）より前に `zukan()` を足し、`Button.svelte` の隣に `Button.zukan.svelte` を置いて、dev サーバーの `/__zukan/` を開きます。2 つのファイルの書き方は[クイックスタート](https://oekazuma.github.io/svelte-zukan/ja/quickstart/)にあります。

## リンク

- [ドキュメント](https://oekazuma.github.io/svelte-zukan/ja/)
- [デモ](https://oekazuma.github.io/svelte-zukan/demo/ja/)
- [AI エージェントと使う](https://oekazuma.github.io/svelte-zukan/ja/ai-agents/)
- [コントリビューションガイド](CONTRIBUTING.md)（英語）

> svelte-zukan は Svelte の公式プロジェクトではありません。Svelte チームとの提携や承認もありません。ロゴの S の図形は Svelte のロゴに由来します。

## ライセンス

[MIT](LICENSE.md)
