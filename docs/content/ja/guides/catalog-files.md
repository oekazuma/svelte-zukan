---
title: カタログファイル
sidebar:
  order: 1
---

コンポーネントの隣に `<Name>.zukan.svelte` を置きます。`<Name>.zukan.md` は任意です。`zukan/` のようなサブディレクトリは使いません。

```text
src/lib/Button/
├── Button.svelte
├── Button.zukan.svelte
└── Button.zukan.md
```

## セクション

カタログファイルは `<Section>` を並べた Svelte コンポーネントです。セクション 1 つが 1 つの例で、それぞれ別々にプレビューします。

```svelte
<!-- src/lib/Button/Button.zukan.svelte -->
<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from './Button.svelte';

  let count = $state(0);
  const label = $derived(`${count} clicks`);
</script>

<Section title="Basic">
  <Button onclick={() => count++}>{label}</Button>
</Section>

<Section title="Disabled">
  <Button disabled>Disabled</Button>
</Section>
```

- `<Section>` はトップレベル（他の要素やブロックの中ではない位置）に置きます
- `title` は空でない静的な文字列で、同じファイル内で重複できません

`title` がない、動的、空、同じファイル内で重複、トップレベル以外、のいずれもビルドエラーになります（ファイル名と行つき）。

## コード表示

詳細ページのコード表示には、セクションの中身と、そこから参照している `<script>` 内の定義が出ます。上の例では、「Basic」のコードに `label` と `count` も表示されます。

## Markdown の説明

`Button.zukan.md` は、同じディレクトリにある `Button.zukan.svelte` だけに対応します。あれば詳細ページの上部に HTML として表示します。

```md
<!-- src/lib/Button/Button.zukan.md -->

A button for the main action on a page. Use one per screen.
```

## 接尾辞を変える

接尾辞は `suffix` オプションで変えられます。`zukan({ suffix: 'catalog' })` なら `*.catalog.svelte` と `*.catalog.md` になります。

## 監視と HMR

- カタログファイルや `.md` を作成・削除・編集すると、`/__zukan/` のタブだけが再読み込みされます。同じ dev サーバーにつないだアプリのタブは再読み込みされません
- コンポーネント本体（`Button.svelte` など）の編集は通常の HMR で、アプリとカタログの両方に反映されます
- Vite の root の外にあるディレクトリ（モノレポの別パッケージなど）も監視します
- 2 つのカタログファイルが同じ ID になったときは、ターミナルに加えて、dev サーバーに接続しているアプリのタブにも Vite のエラーオーバーレイが出ます
