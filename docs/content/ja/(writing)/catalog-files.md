---
title: カタログファイル
sidebar:
  order: 1
---

コンポーネントの隣に `<Name>.zukan.svelte` を置きます。`<Name>.zukan.md` は任意です。`zukan/` のような専用のディレクトリは要りません。ファイル名はどのプラットフォームでも大文字と小文字を区別して照合するので、`Button.Zukan.svelte` はカタログファイルになりません。`Button.Zukan.md` と `button.svelte` も `Button.zukan.svelte` の `.md` やコンポーネントとしては読みません。

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

`title` がない、動的、空、同じファイル内で重複している場合と、`<Section>` がトップレベルにない場合は、どれもファイル名と行つきのビルドエラーになります。素の Svelte として読めないファイルも、ファイル名つきのビルドエラーになります。dev サーバーでは、代わりにそのファイルの詳細ページに同じメッセージが出て、アプリのタブには何も出ません。ただし、アプリのページがそのファイルを import しているときは、いつもどおりそのタブにも Vite のエラーが出ます。

Svelte のコンパイラーが出すエラーや解決できない import など、カタログファイルのそのほかのエラーは、ターミナルと、dev サーバーではそのファイルのプレビューに出ます。カタログファイルからだけ import されているファイルのエラーも同じです。こちらも、アプリがそのファイルを import していない限りアプリのタブには何も出ず、ファイルを直すとプレビューが再読み込みされます。

`<Section>` が 1 つもないファイルはエラーになりません。詳細ページに、プレビューするものがないと表示します。中身のない `<Section>` は何も表示しません。

## コード表示

詳細ページは各セクションの中身を構文ごとに色分けしたコードで示し、そのセクションが参照している `<script>` 内の定義も合わせて載せます。上の例では「Basic」のコードに `label` と `count` も出ます。セクションが使うトップレベルの `{#snippet}`、`<script module>` 内の宣言、TypeScript の型も載せます。`Section` は `import { Section as Example } from 'svelte-zukan'` のように別名で import しても、`import * as Z from 'svelte-zukan'` で名前空間ごと import して `<Z.Section>` と書いても使えます。

## Markdown の説明

`Button.zukan.md` は同じディレクトリにある `Button.zukan.svelte` だけに対応します。このファイルがあれば、詳細ページの上部に HTML として表示します。`.md` 内の生の HTML も含めてそのまま挿入するので、カタログを公開する前に `.md` もコードと同じようにレビューしてください。

```md
<!-- src/lib/Button/Button.zukan.md -->

A button for the main action on a page. Use one per screen.
```

## Props の一覧

`Button.zukan.svelte` の隣に `Button.svelte` があれば、詳細ページの[説明](#markdown-の説明)の下、セクションの上に、その props の一覧を出します。一覧には名前、型、デフォルト値、JSDoc コメントが並びます。JSDoc コメントは最初の `@` タグの手前までを、インラインの Markdown として表示します。コードブロック内の `@` で始まる行はコードであり、タグとして扱いません。エディターと同じく、コメント中の HTML は文字のまま表示し、`{@link}` は名前ならコード、`http` や `https` の URL ならリンクとして表示します。型に JSDoc コメントがない props には、分割代入に書いた JSDoc コメント（`let { /** … */ children }`）を使います。パッケージの型から来る props の説明は、ここに書きます。`?` もデフォルト値もない props には「必須」、デフォルト値が `$bindable()` の props には「バインド可能」と付きます。

```svelte
<!-- src/lib/Button/Button.svelte -->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    variant = 'primary',
    disabled = false,
    children,
    ...rest
  }: HTMLButtonAttributes & {
    /** the look of the button: `primary` for the main action */
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
  } = $props();
</script>

<button class={variant} {disabled} {...rest}>
  {@render children?.()}
</button>
```

props はコンポーネントを実行せず、ソースを読んで取り出します。型はその場に書いても、コンポーネント内で宣言した type エイリアスや interface（interface の `extends` を含む）でもかまいません。書く場所は分割代入でも `$props()` 自体（`let { a } = $props() as Props`、または `satisfies`）でもかまいません。interface が `extends` した型のメンバーを絞り込んだときのように、同じ名前の prop が 2 回宣言されていれば、その interface 自身の宣言で 1 行だけ並びます。1 つのファイルで 2 回宣言した interface は、両方の宣言のメンバーが並びます。相対パスで import した型も読みます。`.ts` や `.d.ts` のファイル（`./types`、`./types.js`、`./types/index.ts`、`./types/index.d.ts`。`export … from` による再エクスポートや、`export { Inner as Props }` のように別の名前で export した型も含む）、`.svelte.ts` のモジュール（`./state.svelte`）、ほかのコンポーネントの `<script module>` から import した型で、import は 3 ファイル先までたどります。名前を指定した import のほか、default export（`export default interface Props`）や名前空間 import（`import type * as T` での `T.Props`）でも読みます。ジェネリックな type エイリアスや interface は、渡した型引数（省略したものはデフォルト）で読みます。`type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null }` なら、`WithElementRef<HTMLButtonAttributes, HTMLButtonElement>` の `ref` は `HTMLButtonElement | null` と並び、`HTMLButtonAttributes` は名前で示します。パッケージの型のメンバーは、その型自身の型パラメーターを書かれたまま示します。リテラルのキーを指定した `Omit` と `Pick`（`Omit<Base, 'id' | 'class'>`）は、元の型のメンバーをすべて一覧にできるとき、残るメンバーを並べます。パッケージの型に対する `Omit` と `Pick` は、パッケージの型と同じく名前で出し、残るメンバーのうち分割代入したものを並べます。パッケージの型（`svelte/elements` の `HTMLButtonAttributes` など）は、一覧の上に型の名前を出します。複数あるときはカンマで区切って出します。そのメンバーのうち一覧に並ぶのは分割代入した props だけで、型と JSDoc コメントは、パッケージの型のファイル（`exports` の `types` 条件、`exports` が指す JavaScript ファイルの隣にある `.d.ts`、`types` フィールドが指すもの、または `main` の隣にある `.d.ts`。`.d.ts` のほか、ワークスペースのパッケージならソースの `.ts`、`.mts`、`.cts` でもかまいません。`exports` のないパッケージのサブパスなら `sub.d.ts` か `sub/index.d.ts`）から読みます。パッケージ自身に型がなければ `@types/<name>` から読みます。`typesVersions` は読みません。上の例の `children` は `Snippet` になります。`...rest` に入るものは並びません。`svelte-package` でビルドしたライブラリのコンポーネントは、隣にある `Button.svelte.d.ts` から読みます。そのファイルが export する Props の型も、`ComponentProps<typeof Button>`（`svelte` の `ComponentProps`）も同じです。プロジェクト内のコンポーネント（`import Field from './Field.svelte'`）の `ComponentProps<typeof Field>` は、その `$props()` の型を読みます。ユニオン型（`{ href: string } | { onclick: () => void }`）のように読めない型は、一覧にその型を書かれたとおりに出し、その型で受け取るはずの分割代入した props は型なしで並びます。props の型を書いたプロジェクト内のファイルを編集、作成、削除すると、一覧も更新されます。`node_modules` の外からリンクされたワークスペースのパッケージの型を編集したときも同じです。パースできないコンポーネントや `$props()` のないコンポーネントには、一覧を出しません。JSDoc コメントの Markdown のリンクと画像は HTML になるので、カタログを公開する前にコードと同じようにレビューしてください。

## 接尾辞を変える

接尾辞は `suffix` オプションで変えられます。`zukan({ suffix: 'catalog' })` なら `*.catalog.svelte` と `*.catalog.md` になります。

## 監視と HMR

- カタログファイルや `.md` を作成・削除・編集すると、`/__zukan/` のタブだけが再読み込みされます。同じ dev サーバーにつないだアプリのタブは再読み込みされません。カタログファイルを import しているアプリのページには、通常の HMR で編集が反映されます
- `logo` の画像を編集したときも、`/__zukan/` のタブだけが再読み込みされます
- コンポーネント本体（`Button.svelte` など）を編集すると、通常の HMR でアプリとカタログの両方に反映されます。props が変わる編集のときは、props の一覧を更新するために `/__zukan/` のタブも再読み込みされます
- Vite の root の外にあるディレクトリ（モノレポの別パッケージなど）も監視します
