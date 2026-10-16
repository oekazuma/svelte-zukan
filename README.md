# svelte-zukan

SvelteKit 向けのコンポーネントカタログ。コンポーネントの隣にカタログ用のファイルを置くだけで、一覧・プレビュー・コード表示がそろいます。

> 開発中です。API は予告なく変わります。

## 特徴

- `Button/zukan/Button.zukan.svelte` と `Button/zukan/Document.md` をコンポーネントの隣に置くと、カタログに自動で載る
- セクションごとに iframe でプレビューし、幅をドラッグやプリセット（375 / 768 / 1024 / 1280px）で切り替えられる
- Vite プラグインがセクションの中身をコード表示用に取り出し、参照している変数の定義も添える
- 利用側の SvelteKit アプリにルートとして組み込むので、エイリアスや Provider をそのまま使える
- カタログの見た目は利用側の Tailwind 設定などに依存せず、CSS カスタムプロパティでテーマを変えられる
- `prerender` で全ページを静的に書き出せる（adapter-static 対応）

## 動作要件

Svelte 5 と SvelteKit が必要です。Vite 専用のフック（`hotUpdate`）を使うため、Vite 以外のバンドラーでは動きません。

## セットアップ

### 1. Vite プラグインを登録する

`zukan()` は `sveltekit()` より前に置きます。

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), sveltekit()] });
```

### 2. グループを定義する

`import.meta.glob` は Vite が静的に解析するため、glob は利用側で 1 回だけ書きます。グループの表示順はキーの順です。

```ts
// src/routes/zukan/groups.ts
import type { Groups } from 'svelte-zukan';

export const groups: Groups = {
  components: import.meta.glob('/src/lib/**/zukan/*.zukan.svelte'),
  pages: import.meta.glob('/src/routes/**/zukan/*.zukan.svelte')
};
```

グループ名 `preview` は予約語です。同じグループ内で、ファイル名から `.zukan.svelte` を除いた名前が重複するとエラーになります。

### 3. ルートを作る

```svelte
<!-- src/routes/zukan/[...path]/+page.svelte -->
<script lang="ts">
  import { Zukan } from 'svelte-zukan';
  import { groups } from '../groups';
</script>

<Zukan {groups} />
```

rest パラメータの名前は `path` 固定です。`Zukan` が `page.params.path` を読むためです。

`<Zukan>` は自分で `<main>` を描画します。ルートのレイアウト側で `<main>` を二重にしないでください。

### 4. 静的に書き出す場合

prerender で全ページを書き出すなら、`+page.ts` で `entries` を返します。詳細ページとプレビューの中身は SSR の HTML に出ないため、クロールでは見つかりません。そのため全ページを明示します。静的に書き出さないなら、このファイルは不要です。

```ts
// src/routes/zukan/[...path]/+page.ts
import { zukanEntries } from 'svelte-zukan';
import { groups } from '../groups';

export const prerender = true;
export const entries = () => zukanEntries(groups);
```

adapter-static を使う場合は、ルートの `+layout.ts` に `export const prerender = true` を置けば、各ページの `prerender` は省けます。

詳細ページとプレビューの中身は、ハイドレーション後に出ます。書き出した HTML に入るのは外枠（サイドバーと見出し）だけです。

### Provider とレイアウトの注意

Provider が必要なら `src/routes/zukan/+layout.svelte` で囲みます。

ルートの `+layout.svelte` にアプリのヘッダーなどがあると、iframe 内のプレビューにも出ます。その場合は次のどちらかで、カタログのルートからルートレイアウトを外してください。

- `zukan` を `(zukan)` のようなルートグループに移し、ルートレイアウトの外に置く
- `+page@.svelte` でレイアウトを外す

## カタログファイルの書き方

コンポーネントの隣に `zukan/` ディレクトリを作り、`<Name>.zukan.svelte` を置きます。

```text
src/lib/Button/
├── Button.svelte
└── zukan/
    ├── Button.zukan.svelte
    └── Document.md
```

```svelte
<!-- src/lib/Button/zukan/Button.zukan.svelte -->
<script lang="ts">
  import { Section } from 'svelte-zukan';
  import Button from '../Button.svelte';

  let count = $state(0);
  const label = $derived(`${count} 回押した`);
</script>

<Section title="基本">
  <Button onclick={() => count++}>{label}</Button>
</Section>

<Section title="無効">
  <Button disabled>押せない</Button>
</Section>
```

- `<Section>` はトップレベル（他の要素やブロックの中ではない位置）に置きます。`title` は静的な文字列だけです。動的な値、重複、ネストはビルドエラーになります
- 詳細ページのコード表示には、セクションの中身と、そこから参照している `<script>` 内の定義（上の例では `label` と `count`）が出ます
- `Document.md` は任意です。あればページ上部に HTML として表示します。`Document.md` を作成・編集・削除したときも、dev サーバーを再起動せずに反映されます
- カタログファイルを編集すると、ページ全体を再読み込みします。コンポーネント本体（`Button.svelte` など）の編集は、通常の HMR です

## URL

マウント位置を `<base>` とします（上の例では `/zukan`）。

| URL                                             | 表示                                      |
| ----------------------------------------------- | ----------------------------------------- |
| `<base>`                                        | 一覧                                      |
| `<base>/<group>/<Name>`                         | 詳細ページ                                |
| `<base>/preview/<group>/<Name>?section=<title>` | iframe 用プレビュー（カタログの UI なし） |

`section` を付けないと、全セクションを表示します。`paths.base` を設定したアプリでも動きます。

## テーマ

`:root` などで次の CSS カスタムプロパティを上書きすると、見た目を変えられます。ダークモードの既定値は持たないので、必要なら上書きしてください。

| 変数                    | 既定値                    |
| ----------------------- | ------------------------- |
| `--zukan-color-bg`      | `#fff`                    |
| `--zukan-color-text`    | `#1f2328`                 |
| `--zukan-color-muted`   | `#59636e`                 |
| `--zukan-color-border`  | `#d1d9e0`                 |
| `--zukan-color-accent`  | `#0969da`                 |
| `--zukan-color-code-bg` | `#f6f8fa`                 |
| `--zukan-font-family`   | `system-ui, sans-serif`   |
| `--zukan-font-mono`     | `ui-monospace, monospace` |
| `--zukan-sidebar-width` | `240px`                   |

## 開発

```sh
pnpm install
pnpm dev
```

`/zukan` にこのリポジトリ自身のカタログがあります。`ui` グループが内部の UI 部品、`examples` グループが `src/examples/` のサンプルです。

## ライセンス

[MIT](LICENSE.md)
