---
title: SvelteKit の機能を使う
sidebar:
  order: 3
---

svelte-zukan は `$app/state` や `$app/navigation` のような SvelteKit の実行時 API を差し替えず、モックもしません。カタログの中では SvelteKit の実行時コードが既定の状態で動きます。

- `$app/state` の `page`: `url.pathname` は空文字、`params` は `{}`、`data` は `{}`
- `$app/env` の `browser`: `true`
- `$app/navigation` の `goto` など: reject するだけで、画面は移動しません
- `$app/paths` の `resolve`: アプリの `paths.base` を前提にした URL を返します（`paths.base` が空なら `resolve('/')` は `/`）。カタログ自身の URL ではありません
- `$app/paths` の `asset`: `resolve` と同じく、アプリの `paths.base` を前提にした URL を返します（例: `asset('favicon.svg')` は `/favicon.svg`）。`paths.assets` はカタログの中では使われません。カタログの中でアプリの `static/` のファイルを読むと、アプリの dev サーバーが配信するものが使われます
- `$app/manifest` の `assets`、`immutable`、`prerendered`、`routes`: dev では SvelteKit の dev サーバーが返す値、静的に書き出したカタログでは空の配列
- `$app/env/public`（または `$env/dynamic/public`）の動的な公開環境変数: 静的に書き出したカタログには値を送るサーバーがないため `undefined`。静的な変数は値を保ちます

現在のページに応じて表示が変わるナビゲーションなどのコンポーネントは、カタログでは上の既定値のまま描画されます。上で触れたものを除き、静的に書き出したカタログでも同じです。
