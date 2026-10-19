<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg" />
    <img src=".github/logo.svg" alt="zukan" width="320" />
  </picture>
</p>

<p align="center">
  Svelte のコンポーネントカタログ。コンポーネントの隣にカタログ用のファイルを置くと、一覧・プレビュー・コード表示がそろいます。
</p>

zukan は日本語で「図鑑」（illustrated encyclopedia）という意味です。

> svelte-zukan は Svelte の公式プロジェクトではありません（not affiliated with or endorsed by the Svelte team）。ロゴの S の図形は Svelte のロゴに由来します。

> 開発中です。API は予告なく変わります。

## 特徴

- 利用側の作業は `vite.config.ts` に `zukan()` を足すことだけ。`src` にルートも設定ファイルも置かない
- dev サーバーの `/__zukan/` でカタログを開ける（vite-plugin-inspect の `/__inspect/` と同じ考え方）
- `Button.zukan.svelte` と `Button.zukan.md` をコンポーネントの隣に置くと、カタログに自動で載る
- セクションごとに iframe でプレビューし、幅をドラッグやプリセット（375 / 768 / 1024 / 1280px）で切り替えられる
- セクションの中身を、参照している変数の定義つきでコード表示する
- `build: true` で `vite build` のときに静的なカタログも書き出せる
- モノレポでは、カタログ用のアプリが依存しているワークスペースパッケージのカタログファイルも自動で集める

## 対応範囲と動作要件

Svelte（Vite）向けのライブラリです。素の Vite + Svelte（`@sveltejs/vite-plugin-svelte` の `svelte()`）でも SvelteKit でも、同じ `zukan()` で動きます。

- Vite 8 以上、Svelte 5、Node 22.17 以上
- Vite 専用のフック（`configureServer`、`hotUpdate`、`buildApp`）を使うため、Vite 以外のバンドラーでは動きません

## セットアップ

### 素の Vite + Svelte

`zukan()` は `svelte()` より前に置きます。

```ts
// vite.config.ts
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), svelte()] });
```

### SvelteKit

`zukan()` は `sveltekit()` より前に置きます。

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { zukan } from 'svelte-zukan/vite';

export default defineConfig({ plugins: [zukan(), sveltekit()] });
```

dev サーバーを起動して `/__zukan/` を開きます。起動時にターミナルへ出る URL 一覧にも、カタログの URL が載ります。

Vite の `base` や SvelteKit の `paths.base` を設定しているときは、カタログは `<base>__zukan/`（例: `base: '/app/'` なら `/app/__zukan/`）に移ります。ターミナルの URL 一覧には、移った先の URL が出ます。

## カタログファイルの書き方

コンポーネントの隣に `<Name>.zukan.svelte` を置きます。`<Name>.zukan.md` は任意です（`zukan/` のようなサブディレクトリは使いません）。

```text
src/lib/Button/
├── Button.svelte
├── Button.zukan.svelte
└── Button.zukan.md
```

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

- `<Section>` はトップレベル（他の要素やブロックの中ではない位置）に置きます。`title` は空でない静的な文字列だけです。`title` がない、動的、空、同じファイル内で重複、トップレベル以外、のいずれもビルドエラーになります（ファイル名と行つき）
- 詳細ページのコード表示には、セクションの中身と、そこから参照している `<script>` 内の定義（上の例では `label` と `count`）が出ます
- `Button.zukan.md` は `Button.zukan.svelte` と同じディレクトリ・同じ名前のものだけが対応します。あれば詳細ページの上部に HTML として表示します
- 接尾辞は `suffix` オプションで変えられます（`zukan({ suffix: 'catalog' })` なら `*.catalog.svelte` / `*.catalog.md`）

## カタログの ID と URL

カタログはハッシュでルーティングする SPA です。HTML は 1 つだけなので、書き出したものをどのパスに置いても、深いリンクがそのまま開けます。

| URL                                       | 表示                                      |
| ----------------------------------------- | ----------------------------------------- |
| `/__zukan/`                               | 一覧                                      |
| `/__zukan/#/<ID>`                         | 詳細ページ                                |
| `/__zukan/#/preview/<ID>?section=<title>` | iframe 用プレビュー（カタログの UI なし） |

ID は `<グループ名>/<相対パス>` です。相対パスは、探索ディレクトリからカタログファイルまでのパスから `.<suffix>.svelte` を除いたものです。

- グループ名が `my-app` のとき、`src/lib/forms/Button.zukan.svelte` → `my-app/lib/forms/Button`
- 最後の 2 セグメントが同じとき（`Button/Button`）は 1 つにまとめます。`src/lib/Button/Button.zukan.svelte` → `my-app/lib/Button`
- 同名のカタログファイル（`forms/Button.zukan.svelte` と `nav/Button.zukan.svelte`）も、ディレクトリが違えば別の ID になります。一覧には名前（`Button`）を主に、ディレクトリ（`lib/forms`）を控えめな色で添えて表示するので、見分けられます
- グループ名が `preview` か `preview/` で始まるとエラーです（URL の予約語）
- ID が重複するとエラーになり、両方のファイルパスが出ます。重複するのは、たとえば次の場合です
  - `lib/Button.zukan.svelte` と `lib/Button/Button.zukan.svelte`。まとめた結果が同じ `my-app/lib/Button` になります
  - グループ `@acme` の `ui/Card.zukan.svelte` と、グループ `@acme/ui` の `Card.zukan.svelte`。どちらも `@acme/ui/Card` になります

ID はファイルを動かさない限り変わりません。自動探索で `lib/` が付くのは `src` 全体を探すためです。気になるときは `groups` で `src/lib` を指定してください。

## 設定

```ts
zukan({
  suffix: 'zukan',
  groups: { ui: 'src/lib', examples: ['src/examples', 'src/demo'] },
  wrapper: '.zukan/Wrapper.svelte',
  logo: '.zukan/logo.svg',
  title: 'zukan',
  locale: 'en',
  build: { outDir: 'zukan-dist' }
});
```

| オプション | 型                                   | 既定値     | 説明                                                                                                                                |
| ---------- | ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `suffix`   | `string`                             | `'zukan'`  | カタログファイルの接尾辞。`/^[a-z0-9-]+$/i` に合う文字列                                                                            |
| `groups`   | `Record<string, string \| string[]>` | 自動探索   | グループ名 → 探すディレクトリ。書くと自動探索は行わず、書いたディレクトリだけを探す。並び順はキー順。存在しないディレクトリはエラー |
| `wrapper`  | `string`                             | なし       | プレビューを囲む `.svelte` のパス                                                                                                   |
| `logo`     | `string \| false`                    | 同梱のロゴ | サイドバーのロゴ画像のパス。`false` でロゴを出さず `title` の文字列を表示                                                           |
| `title`    | `string`                             | `'zukan'`  | サイドバーのロゴの `alt` と `<title>`                                                                                               |
| `locale`   | `'en' \| 'ja'`                       | `'en'`     | UI の言語。`<html lang>` も合わせる                                                                                                 |
| `build`    | `boolean \| { outDir?: string }`     | `false`    | `vite build` のときにカタログを静的に書き出す。`true` なら `outDir` は `'zukan-dist'`                                               |

- パスはすべて Vite の root からの相対で、`.zukan/` のような `src` 外のディレクトリに置けます
- 不正な値（`suffix` が規則に合わない、`locale` が未知、指定したファイルやディレクトリがない）は、設定の読み込み時にエラーになります
- `groups` のキーを数字だけにすると、JavaScript のオブジェクトの仕様で、宣言順ではなく数値順で並びます。グループ名には数字以外を含めてください

### モノレポでの探索

`groups` がないとき、次の順にカタログファイルを探します。

1. Vite の root にあるパッケージ（カタログ用のアプリ自身）の `src`
2. そのアプリの `package.json` の `dependencies` → `devDependencies` の順に、依存しているワークスペースパッケージの `src`

- グループ名はパッケージの `package.json` の `name` です。カタログファイルがないパッケージはグループになりません
- 依存パッケージは、カタログ用のアプリ自身の `node_modules/<依存名>` にあるリンクから探します（pnpm のワークスペースはこの形でリンクします）。npm や yarn のワークスペースでは、リンクがワークスペースのルートの `node_modules` にできるので見つかりません。その場合は `groups` で指定してください
- 推移的な依存は探しません。アプリの依存に宣言していないアプリやパッケージ（たとえばカタログ用のアプリ `apps/catalog` から、別のアプリ `apps/web` のコンポーネントを見せたいとき）は、`groups` で指定します

```ts
// apps/catalog/vite.config.ts
zukan({
  groups: {
    web: '../web/src',
    ui: '../../packages/ui/src'
  }
});
```

### `wrapper`

プレビューの iframe の中だけを囲みます。Provider やグローバル CSS を入れる場所で、Storybook の `.storybook/preview.js` に当たります。`children` を受け取って描画してください。

```svelte
<!-- .zukan/Wrapper.svelte -->
<script lang="ts">
  import '../src/app.css';
  import ThemeProvider from '../src/lib/ThemeProvider.svelte';

  let { children } = $props();
</script>

<ThemeProvider>{@render children()}</ThemeProvider>
```

`wrapper` が読み込むグローバル CSS は、カタログの UI 側には効きません。カタログの UI は独立した HTML で、アプリの CSS も読み込みません。

## 静的な書き出し

```ts
zukan({ build: true });
```

`vite build` のとき、アプリのビルドとは別に `zukan-dist/` へカタログが書き出されます（`build: { outDir: 'docs/zukan' }` のように出力先も選べます）。アプリのビルドの出力先とは別なので、adapter の書き出しに消されません。

- 出力のパスは相対パスなので、どのサブパス（例: `/docs/zukan/`）に置いても動きます。サーバー側の書き換え設定は要りません
- `build` を有効にすると、`vite build` は Vite の builder モード（Environment API）で動き、全環境が 1 回の実行でビルドされます
- `vite build --watch` ではカタログを書き出しません（警告を出して飛ばします）
- 書き出しの前に、前回のカタログ（出力先の `_zukan/` と `index.html`）だけを消します。SvelteKit では、adapter が `build/` を空にすることが多いので、出力先が `build/` と重なると警告を出します
- `/zukan-dist` は `.gitignore` に足してください

## SvelteKit の実行時 API

`$app/state` や `$app/navigation` のような SvelteKit の実行時 API は、差し替えません。カタログの中では SvelteKit の実行時コードが既定の状態で動きます。

- `$app/state` の `page`: `url.pathname` は空文字、`params` は `{}`、`data` は `{}`
- `$app/env` の `browser`: `true`
- `$app/navigation` の `goto` など: reject するだけで、画面は移動しません
- `$app/paths` の `resolve`: アプリの `paths.base` を前提にした URL を返します（`paths.base` が空なら `resolve('/')` は `/`）。カタログ自身の URL ではありません
- `$app/paths` の `asset`: `asset` も `resolve` と同じく、アプリの `paths.base` を前提にした URL を返します（例: `asset('favicon.svg')` は `/favicon.svg`）。`paths.assets` はカタログの中では使われません。カタログの中でアプリの `static/` のファイルを読むと、アプリの dev サーバーが配信するものが使われます

現在のページで表示が変わるナビゲーションなどは、カタログでは既定値のままで描画されます。SvelteKit を使っているアプリでは、静的に書き出したカタログでもこの動きは同じです。

## 監視と HMR

- カタログファイル（`*.zukan.svelte`）や `.md` を作成・削除・編集すると、`/__zukan/` のタブだけが再読み込みされます。同じ dev サーバーにつないだアプリのタブは再読み込みされません
- コンポーネント本体（`Button.svelte` など）の編集は通常の HMR で、アプリとカタログの両方に反映されます
- Vite の root の外にあるディレクトリ（モノレポの別パッケージなど）も監視します
- 同じ ID のカタログファイルが 2 つできるなど、ID が重複したときは、ターミナルに加えて、dev サーバーに接続しているアプリのタブにも Vite のエラーオーバーレイが出ます

## UI の言語

カタログの UI は既定で英語です。`locale: 'ja'` で日本語になります。`groups` のキーやカタログファイルの `title` のように、利用側が書いた文字列は翻訳しません。プラグインのエラーメッセージは英語で、`locale` に従いません。

## 開発

```sh
pnpm install
pnpm dev
```

`/__zukan/` にこのリポジトリ自身のカタログがあります。`ui` グループが内部の UI 部品、`examples` グループが `src/examples/` のサンプルです。

## ライセンス

[MIT](LICENSE.md)
