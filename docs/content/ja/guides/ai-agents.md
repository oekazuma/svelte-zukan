---
title: AI エージェント
sidebar:
  order: 7
---

AI のコーディングエージェントはブラウザーを使わずにカタログファイルを書いて確かめられます。そのために svelte-zukan が用意しているのは、テキストで読めるドキュメント、データとしてのカタログ、この 2 つの使い方を書いたスキルの 3 つです。

## テキストで読めるドキュメント

- [`llms.txt`](https://oekazuma.github.io/svelte-zukan/llms.txt) にページの一覧が、[`llms-full.txt`](https://oekazuma.github.io/svelte-zukan/llms-full.txt) に全ページの本文がまとまっています
- どのページも Markdown で読めます。`https://oekazuma.github.io/svelte-zukan/quickstart.md` のように、URL の末尾に `.md` を付けます

## データとしてのカタログ

dev サーバーは `/__zukan/catalog.json` を返します。`build: true` で `vite build` すると、同じデータを `index.html` の隣の `catalog.json` に書き出します。中のパスは Vite の root からの相対パスです。

| フィールド                | 中身                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `components[].id`         | [カタログ ID](/ja/guides/catalog-ids)                                                                        |
| `components[].file`       | カタログファイル                                                                                             |
| `components[].component`  | `Button.zukan.svelte` の隣にある `Button.svelte`。なければ `null`                                            |
| `components[].doc`        | `.md` ファイルの Markdown。なければ `null`                                                                   |
| `components[].props`      | [Props の一覧](/ja/guides/catalog-files#props-の一覧)。名前、型、既定値、必須か、bind できるか、説明（HTML） |
| `components[].sections[]` | セクションごとの `title`、コード表示と同じ `code`、プレビューのページのハッシュ `preview`                    |
| `components[].error`      | カタログファイルをコンパイルできないときの理由。このとき `sections` は空です                                 |
| `uncataloged[]`           | 探索するディレクトリにある `.svelte` ファイルのうち、隣にカタログファイルがないもの                          |

`preview` はカタログのページのハッシュです。`/__zukan/#/preview/ui/Button?section=Primary` はそのセクションだけを表示するので、スクリーンショットに向いています。`&theme=dark` を付けるとダークテーマになります。このページはウィンドウいっぱいに広がるので、スマートフォンやタブレットの幅で見るときはウィンドウの幅を変えます。

## スキル

パッケージには [Agent Skills](https://agentskills.io) を読むエージェント向けのスキル `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md` が入っています。カタログに載せるものの探し方、カタログファイルの書き方、書いたものの確かめ方をまとめたものです。エージェントがスキルを探す場所にフォルダーごとコピーして使います。Claude Code なら `.claude/skills/svelte-zukan/` です。

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
