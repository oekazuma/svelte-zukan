---
title: AI エージェントと使う
sidebar:
  order: 5
---

AI のコーディングエージェントはブラウザーを使わずにカタログファイルを書いて確かめられます。そのために svelte-zukan は、テキストで読めるドキュメント、データとしてのカタログ（ブラウザーでは WebMCP のツールとしても）、これらの使い方を書いたスキルを用意しています。

## テキストで読めるドキュメント

- [`llms.txt`](https://oekazuma.github.io/svelte-zukan/llms.txt) にページの一覧が、[`llms-full.txt`](https://oekazuma.github.io/svelte-zukan/llms-full.txt) に全ページの本文がまとまっています
- どのページも Markdown で読めます。`https://oekazuma.github.io/svelte-zukan/quickstart.md` のように、URL の末尾に `.md` を付けます

## データとしてのカタログ

dev サーバーは `/__zukan/catalog.json` を返します。`build: true` で `vite build` すると、同じデータを `index.html` の隣の `catalog.json` に書き出します。中のパスは Vite の root からの相対パスです。

| フィールド                | 中身                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                   | [`title` オプション](/ja/options)                                                                                                                                                                        |
| `components[].id`         | [カタログ ID](/ja/catalog-ids)                                                                                                                                                                           |
| `components[].group`      | グループ。`groups` のキーか、パッケージの `name`                                                                                                                                                         |
| `components[].name`       | カタログファイルの名前から `.zukan.svelte` を除いたもの                                                                                                                                                  |
| `components[].dir`        | ID のうちグループと `name` の間の部分。なければ `''`                                                                                                                                                     |
| `components[].file`       | カタログファイル                                                                                                                                                                                         |
| `components[].component`  | `Button.zukan.svelte` の隣にある `Button.svelte`。なければ `null`                                                                                                                                        |
| `components[].doc`        | `.md` ファイルの Markdown。なければ `null`                                                                                                                                                               |
| `components[].props`      | [Props の一覧](/ja/catalog-files#props-の一覧)。名前、型、既定値、必須か、bind できるか、説明（HTML）                                                                                                    |
| `components[].propsType`  | 一覧で読めない Props の型（パッケージの型など）。ソースに書かれたとおりの文字列で、なければ `null`                                                                                                       |
| `components[].sections[]` | セクションごとの `title`、コード表示と同じ `code`、プレビューのページのハッシュ `preview`                                                                                                                |
| `components[].error`      | カタログファイルが素の Svelte として読めない、または [`<Section>` の決まり](/ja/catalog-files#セクション)に反しているときに、そのビルドエラーのメッセージが入ります。このとき `sections` は空です        |
| `uncataloged[]`           | 探索するディレクトリにある `.svelte` ファイルのうち、隣にカタログファイルがないもの                                                                                                                      |
| `tailwind`                | [Tailwind CSS のエントリー](/ja/tailwind)が 1 つも見つからなかったとき（Tailwind が入っていない、または v3 のときも）は `null`。読み込めたときはエントリーごとのオブジェクトで、中身は下の表のとおりです |

`tailwind` のオブジェクトには次のフィールドがあります。

| フィールド     | 中身                                                                                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`         | エントリー。Vite の root からの相対パス                                                                                                                                |
| `version`      | Tailwind CSS のバージョン                                                                                                                                              |
| `prefix`       | テーマの `prefix`。なければ `null`                                                                                                                                     |
| `categories[]` | カテゴリーごとのユーティリティクラス。`id`、`title`、`tokens[]`（`class`（`prefix` つき。ブレークポイントとスペーシングの基準値では `null`）、`cssVariable`、`value`） |
| `variables`    | すべてのテーマ変数とその値。`{ "--color-brand-500": "#ff3e00" }` の形                                                                                                  |
| `error`        | エントリーを読み込めなかったときに、そのメッセージが入ります。このとき `categories` と `variables` は空です                                                            |

`categories` のクラスはテーマが定義しているものなので、エージェントがコンポーネントにスタイルを付けるときは、ここにあるものだけを使います。ダークモードの値、任意の値、バリアントは[含みません](/ja/tailwind#表示しないもの)。

`preview` はカタログのページのハッシュです。`/__zukan/#/preview/ui/Button?section=Primary` はそのセクションだけを表示するので、スクリーンショットに向いています。`&theme=dark` を付けるとダークテーマになります（[`theme` オプション](/ja/options)でテーマを固定しているときは無視されます）。このページはウィンドウいっぱいに広がるので、スマートフォンやタブレットの幅で見るときはウィンドウの幅を変えます。

## カタログの WebMCP ツール

[WebMCP](https://webmachinelearning.github.io/webmcp/) に対応したブラウザーでは、カタログのページが自分のデータをツールとしても公開します。ブラウザーを操作するエージェントは、画面を読まずにカタログを使えます。

| ツール                 | 働き                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list_components`      | コンポーネントの一覧（ID、名前、グループ、セクション名、説明の最初の行）と、カタログファイルのない `.svelte` ファイルを返します                                                                                                                                                                                                                                                                              |
| `get_component`        | 1 つのコンポーネントを、`catalog.json` と同じ形で返します                                                                                                                                                                                                                                                                                                                                                    |
| `open_component`       | コンポーネントのページを開きます。セクション、そのプレビューの幅とテーマも指定できます                                                                                                                                                                                                                                                                                                                       |
| `check_accessibility`  | 1 つのセクションを単独で描画し、axe-core が見つけた問題を返します                                                                                                                                                                                                                                                                                                                                            |
| `list_tailwind_tokens` | Tailwind CSS のデータがあるときだけ使えます。`category` を省くと、エントリーごとにカテゴリーとトークンの数を返します。カテゴリーの ID（`background-color`、`padding`、`font-size` など）を渡すとそのトークンを、`full-config` を渡すとすべてのテーマ変数を `{ 変数: 値 }` の形で、`tokens` ではなく `variables` に入れて返します。`query` は、クラス名・変数名・値のどれかにその文字を含むものだけに絞ります |

WebMCP に対応していないブラウザーではツールは使われず、そのためのコードも読み込みません。

## スキル

svelte-zukan には、Claude Code、Cursor、Codex など [Agent Skills](https://agentskills.io) を読むエージェント向けのスキルがあります。カタログに載せるものの探し方、カタログファイルの書き方、書いたものの確かめ方をまとめたものです。[skills CLI](https://github.com/vercel-labs/skills) でインストールします。

```sh
npx skills add oekazuma/svelte-zukan
```

CLI がどのエージェントに入れるかを尋ね、プロジェクト内のそれぞれのスキルのディレクトリに置きます。エージェントは `-a` で選べます（例: `-a claude-code`）。`-g` を付けると、すべてのプロジェクトで使えるように入ります。

npm のパッケージにも同じスキルが `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md` に入っていて、インストールしたバージョンに合っています。このフォルダーを自分でエージェントのスキルのディレクトリにコピーして使うこともできます。

```sh
mkdir -p .claude/skills && cp -r node_modules/svelte-zukan/skills/svelte-zukan .claude/skills/
```

## AGENTS.md に書く例

`AGENTS.md` や `CLAUDE.md` を読むエージェントには数行書いておけば足ります。

```md
## Component catalog

Components are cataloged with svelte-zukan. When you add or change a component in `src/lib`, add or update
`<Name>.zukan.svelte` next to it. Follow `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`, and check the
result in `/__zukan/catalog.json` on the dev server.
```
