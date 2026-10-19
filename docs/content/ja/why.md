---
title: svelte-zukan を選ぶ理由
sidebar:
  order: 5
---

svelte-zukan がやることは 1 つだけで、Svelte のコンポーネントをカタログとして見せることです。アドオンで機能を足すワークショップでも、テストランナーでも、複数のフレームワーク向けのツールでもありません。対象を絞っているので、小さく、すぐに導入できます。

## Storybook と Histoire との比較

|                            | svelte-zukan                                                        | Storybook                                                    | Histoire                                                    |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| インストール量<sup>1</sup> | **1.0 MB、4 パッケージ**                                            | 78 MB、82 パッケージ                                         | 90 MB、218 パッケージ                                       |
| Svelte 5                   | 対応                                                                | 対応                                                         | 非対応。Svelte プラグインの対応は Svelte 3 と 4<sup>2</sup> |
| 導入                       | `vite.config.ts` に `zukan()` を足す                                | `.storybook/` ディレクトリに専用の設定ファイルを置く         | `histoire.config.ts` に Svelte プラグインを登録する         |
| 動く場所                   | アプリ自身の dev サーバーの `/__zukan/`                             | 専用の dev サーバー                                          | 専用の dev サーバー                                         |
| 書くもの                   | `<Section>` を並べた普通の Svelte コンポーネント                    | Svelte CSF（`defineMeta`、`<Story>`）または CSF のストーリー | `<Hst.Story>` と `<Hst.Variant>` を使ったストーリー         |
| コンポーネントごとの説明   | コンポーネントの隣に置く Markdown ファイル                          | MDX と autodocs                                              | Markdown                                                    |
| コード表示                 | セクションごとに、使っている `<script>` の定義も表示                | あり                                                         | あり                                                        |
| プレビューの幅             | プリセットとドラッグ                                                | ビューポートのツールバー                                     | プリセット                                                  |
| ライトとダークの背景       | あり                                                                | あり                                                         | あり                                                        |
| 検索                       | あり                                                                | あり                                                         | あり                                                        |
| props の操作パネル         | なし（意図的。下記を参照）                                          | あり                                                         | あり                                                        |
| イベントのログ             | なし                                                                | あり（actions）                                              | あり                                                        |
| テストと a11y の検査       | なし                                                                | あり（操作テスト、a11y アドオン、ビジュアルテスト）          | なし                                                        |
| SvelteKit の `$app/*`      | 本物のモジュールを既定の状態で使う                                  | モック（`$app/state` を含む）                                | —                                                           |
| 静的な書き出し             | アプリの `vite build` で `build: true`。どのパスでも動く            | `storybook build`                                            | `histoire build`                                            |
| 動作条件                   | Vite 8 以上、Svelte 5、SvelteKit 3 以上（または素の Vite + Svelte） | 複数のバンドラーとフレームワーク                             | Vite。Vue と Svelte 3/4                                     |

<sup>1</sup> 2026-10-19 に、空のディレクトリで `npm install` して測りました。どれを選んでも共通する peer dependencies（`svelte`、`vite`、`@sveltejs/kit`）は除いています。Storybook は `storybook` と `@storybook/sveltekit` だけで、アドオンは入れていません。Histoire は `histoire` と `@histoire/plugin-svelte` です。

<sup>2</sup> 2026-10-19 時点の最新版である `@histoire/plugin-svelte` 1.0.0-beta.1 の peer dependency は `svelte: ^3.0.0 || ^4.0.0` です。

## svelte-zukan を選ぶ理由

- **小さい。** プラグインと実行時の依存 2 つ（`marked` と `magic-string`）で約 1 MB です。ほかにインストールするものも、更新して互換性を保つものもありません
- **設定がいらない。** `vite.config.ts` に 1 行足すだけです。カタログはアプリ自身の dev サーバーで動くので、エイリアスやプラグイン、CSS の処理がそのまま効きます。別のプロセスを立ち上げる必要もありません
- **新しく覚えることがない。** カタログファイルは普通の Svelte コンポーネントです。コンポーネントを import して、ふだんと同じ Svelte 5 のコードで例を書きます
- **コードの隣に置く。** `Button.zukan.svelte` と `Button.zukan.md` は `Button.svelte` の隣に置くので、コンポーネントを移したり消したりすると、カタログも一緒に動きます
- **公開しやすい。** `build: true` にすると、いつもの `vite build` が静的なカタログも書き出します。GitHub Pages のように、どのパスに置いても動きます

## props の操作パネルがない理由

Storybook や Histoire では、パネルからコンポーネントの props を変えられます。svelte-zukan はこれを意図して持っていません。`<Section>` はそれぞれコードとして書いた固定の例で、編集すると dev サーバーがすぐに反映します。こうすると、例をプルリクエストでレビューでき、props を記述するもう 1 つの方法をカタログに持ち込まずに済みます。

## ほかのツールを選ぶべき場面

次のどれかが必要なら、Storybook を選んでください。

- props の操作パネル、イベントのログ、操作テスト、アクセシビリティの検査、ビジュアルリグレッションテスト
- 複数のフレームワークのコンポーネントを 1 つのカタログにまとめること
- SvelteKit 2、Vite 7 以前、または Vite 以外のバンドラー
- ストーリーごとに、SvelteKit の `page` などの `$app/*` の値を変えること
