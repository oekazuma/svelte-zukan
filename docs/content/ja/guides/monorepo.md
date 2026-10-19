---
title: モノレポ
sidebar:
  order: 3
---

`groups` オプションがないとき、svelte-zukan は次の順にカタログファイルを探します。

1. Vite の root にあるパッケージ（カタログ用のアプリ自身）の `src`
2. そのアプリの `package.json` の `dependencies` → `devDependencies` の順に、依存しているワークスペースパッケージの `src`

グループ名はパッケージの `package.json` の `name` です。`name` がなければディレクトリ名です。カタログファイルがないパッケージはグループになりません。

## 依存パッケージの見つけ方

依存パッケージは、カタログ用のアプリ自身の `node_modules/<依存名>` にあるリンクから探します。pnpm のワークスペースはこの形でリンクします。

- npm や yarn のワークスペースでは、リンクがワークスペースのルートの `node_modules` にできるので見つかりません。その場合は `groups` で指定してください
- 推移的な依存は探しません。アプリの依存に宣言していないアプリやパッケージは、`groups` で指定します

## `groups` でディレクトリを選ぶ

`groups` を書くと自動探索は行わず、書いたディレクトリだけを探します。たとえば、カタログ用のアプリ `apps/catalog` から、別のアプリ `apps/web` のコンポーネントを見せたいときは次のようにします。

```ts
// apps/catalog/vite.config.ts
zukan({
  groups: {
    web: '../web/src',
    ui: '../../packages/ui/src'
  }
});
```

パスは Vite の root からの相対です。1 つのグループに複数のディレクトリを並べることもできます（`{ examples: ['src/examples', 'src/demo'] }`）。
