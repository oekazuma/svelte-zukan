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
| `/__zukan/#/<ID>?section=`                | 詳細ページ（Props の一覧までスクロール）   |
| `/__zukan/#/preview/<ID>?section=<title>` | iframe 用プレビュー（カタログの UI なし）  |

詳細ページの各セクション見出しはそのセクションへのリンクなので、共有に使えます。

## ID

ID は `<グループ名>/<相対パス>` です。相対パスは探索ディレクトリからカタログファイルまでのパスで、`.<suffix>.svelte` を除いた部分です。

- グループ名が `my-app` のとき、`src/lib/forms/Button.zukan.svelte` は `my-app/lib/forms/Button` になります
- 最後の 2 セグメントが同じとき（`Button/Button`）は 1 つにまとめます。`src/lib/Button/Button.zukan.svelte` は `my-app/lib/Button` になります
- 同名のカタログファイル（`forms/Button.zukan.svelte` と `nav/Button.zukan.svelte`）も、ディレクトリが違えば別の ID になります。サイドバーはディレクトリを折りたためるフォルダ（`lib` › `forms`）として表示し、一覧ページは名前の下にディレクトリを表示するので、見分けられます

ID はファイルを動かさない限り変わりません。自動探索で ID に `lib/` が付くのは、`src` 全体を探すためです。気になるときは [`groups`](/ja/options) で `src/lib` を指定してください。

## エラー

- グループ名が `preview` そのものか `preview/` で始まる名前だと、URL で予約しているためエラーになります
- ID が重複するとエラーになり、両方のファイルパスが出ます。dev サーバーでは、代わりにカタログのトップページに一覧ではなくこのエラーが出て、アプリのタブには何も出ません。重複するのは、たとえば次の場合です
  - `lib/Button.zukan.svelte` と `lib/Button/Button.zukan.svelte`。まとめた結果、どちらも `my-app/lib/Button` になります
  - グループ `@acme` の `ui/Card.zukan.svelte` と、グループ `@acme/ui` の `Card.zukan.svelte`。どちらも `@acme/ui/Card` になります
