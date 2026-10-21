---
title: カタログファイル
sidebar:
  order: 1
---

コンポーネントの隣に `<Name>.zukan.svelte` を置きます。`<Name>.zukan.md` は任意です。`zukan/` のような専用のディレクトリは要りません。

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
- マークアップと `<script>` は素の Svelte で書きます（`lang="ts"` の TypeScript は使えます）。SCSS などのプリプロセッサの言語は `<style>` の中でだけ使えます

`title` がない、動的、空、同じファイル内で重複、トップレベル以外、のいずれもビルドエラーになります（ファイル名と行つき）。素の Svelte として読めないファイルも、ファイル名つきのビルドエラーになります。

`<Section>` が 1 つもないファイルはエラーになりません。詳細ページに、プレビューするものがないと表示します。中身のない `<Section>` は何も表示しません。

## コード表示

詳細ページのコード表示（構文ごとに色分けされます）には、セクションの中身と、そこから参照している `<script>` 内の定義が出ます。上の例では、「Basic」のコードに `label` と `count` も表示されます。セクションが使うトップレベルの `{#snippet}`、`<script module>` 内の宣言、TypeScript の型も表示します。`Section` は `import { Section as Example } from 'svelte-zukan'` のように別名で import しても使えます。

## Markdown の説明

`Button.zukan.md` は、同じディレクトリにある `Button.zukan.svelte` だけに対応します。あれば詳細ページの上部に HTML として表示します。`.md` 内の生の HTML も含めてそのまま挿入するので、カタログを公開する前に `.md` もコードと同じようにレビューしてください。

```md
<!-- src/lib/Button/Button.zukan.md -->

A button for the main action on a page. Use one per screen.
```

## Props の一覧

`Button.zukan.svelte` の隣に `Button.svelte` があれば、詳細ページのセクションの下に、その props の一覧を出します。名前、型、既定値、JSDoc コメント（最初の `@` タグの手前まで。インラインの Markdown として表示）が並びます。`?` も既定値もない props には「必須」、既定値が `$bindable()` の props には「bind 可」と付きます。

```svelte
<!-- src/lib/Button/Button.svelte -->
<script lang="ts">
  let {
    variant = 'primary',
    disabled = false
  }: {
    /** the look of the button: `primary` for the main action */
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
  } = $props();
</script>
```

props はコンポーネントのソースを読んで取り出します。コンポーネントを実行はしません。型はその場に書いても、コンポーネント内で宣言した type エイリアスや interface（interface の `extends` を含む）でもかまいません。別ファイルから import した型のときは、一覧にはその型の名前と、分割代入した props だけを型なしで出します。パースできないコンポーネントや `$props()` のないコンポーネントには、一覧を出しません。JSDoc コメントも `.md` と同じく HTML として挿入するので、カタログを公開する前にコードと同じようにレビューしてください。

## 接尾辞を変える

接尾辞は `suffix` オプションで変えられます。`zukan({ suffix: 'catalog' })` なら `*.catalog.svelte` と `*.catalog.md` になります。

## 監視と HMR

- カタログファイルや `.md` を作成・削除・編集すると、`/__zukan/` のタブだけが再読み込みされます。同じ dev サーバーにつないだアプリのタブは再読み込みされません
- コンポーネント本体（`Button.svelte` など）の編集は通常の HMR で、アプリとカタログの両方に反映されます。props が変わる編集のときは、props の一覧を更新するために `/__zukan/` のタブも再読み込みされます
- Vite の root の外にあるディレクトリ（モノレポの別パッケージなど）も監視します
- 2 つのカタログファイルが同じ ID になったときは、ターミナルに加えて、dev サーバーに接続しているアプリのタブにも Vite のエラーオーバーレイが出ます
