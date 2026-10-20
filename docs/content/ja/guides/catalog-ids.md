---
title: カタログの ID と URL
sidebar:
  order: 2
---

カタログはハッシュでルーティングする SPA です。HTML は 1 つだけなので、書き出したものをどのパスに置いても、深いリンクがそのまま開けます。

| URL                                       | 表示                                       |
| ----------------------------------------- | ------------------------------------------ |
| `/__zukan/`                               | 一覧                                       |
| `/__zukan/#/<ID>`                         | 詳細ページ                                 |
| `/__zukan/#/<ID>?section=<title>`         | 詳細ページ（そのセクションまでスクロール） |
| `/__zukan/#/preview/<ID>?section=<title>` | iframe 用プレビュー（カタログの UI なし）  |

詳細ページのセクション見出しは、そのセクションへのリンクです。共有に使えます。

## ID

ID は `<グループ名>/<相対パス>` です。相対パスは、探索ディレクトリからカタログファイルまでのパスから `.<suffix>.svelte` を除いたものです。

- グループ名が `my-app` のとき、`src/lib/forms/Button.zukan.svelte` は `my-app/lib/forms/Button` になります
- 最後の 2 セグメントが同じとき（`Button/Button`）は 1 つにまとめます。`src/lib/Button/Button.zukan.svelte` は `my-app/lib/Button` になります
- 同名のカタログファイル（`forms/Button.zukan.svelte` と `nav/Button.zukan.svelte`）も、ディレクトリが違えば別の ID になります。サイドバーではディレクトリを折りたためるフォルダ（`lib` › `forms`）として、一覧ページでは名前の下にディレクトリを表示するので、見分けられます

ID はファイルを動かさない限り変わりません。自動探索で `lib/` が付くのは `src` 全体を探すためです。気になるときは [`groups`](/ja/options) で `src/lib` を指定してください。

## エラー

- グループ名が `preview` か `preview/` で始まるとエラーです（URL の予約語）
- ID が重複するとエラーになり、両方のファイルパスが出ます。重複するのは、たとえば次の場合です
  - `lib/Button.zukan.svelte` と `lib/Button/Button.zukan.svelte`。まとめた結果が同じ `my-app/lib/Button` になります
  - グループ `@acme` の `ui/Card.zukan.svelte` と、グループ `@acme/ui` の `Card.zukan.svelte`。どちらも `@acme/ui/Card` になります
