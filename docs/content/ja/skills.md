---
title: エージェントスキル
sidebar:
  order: 15
---

svelte-zukan には、Claude Code、Cursor、Codex などの AI コーディングエージェント向けに、2 つの [Agent Skills](https://agentskills.io) が付いています。スキルはエージェントに svelte-zukan の使い方を教えるものです。ふだんの言葉で頼むだけで、このドキュメントに沿ったカタログができます。

| スキル                                          | 使う場面                                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`svelte-zukan`](#svelte-zukan)                 | プロジェクトに svelte-zukan を導入し、カタログファイルを書いて、説明を付けて、確かめる |
| [`migrate-svelte-zukan`](#migrate-svelte-zukan) | Storybook や Histoire からカタログを移す                                               |

エージェントは頼まれた内容に合うスキルを自分で選ぶので、スキル名を指定する必要はありません。

## インストール

[skills CLI](https://github.com/vercel-labs/skills) でインストールします。

```sh
npx skills add oekazuma/svelte-zukan
```

CLI がどのスキルを、どのエージェントに入れるかを尋ね、プロジェクト内のそれぞれのエージェントのスキルのディレクトリに置きます。質問を省くには、スキルを `--skill` で（例: `--skill svelte-zukan`）、エージェントを `-a` で（例: `-a claude-code`）指定します。`-g` を付けると、すべてのプロジェクトで使えるように入ります。

npm のパッケージにも同じスキルが `node_modules/svelte-zukan/skills/` に入っていて、インストールしたバージョンに合っています。これを自分でエージェントのスキルのディレクトリにコピーして使うこともできます。

```sh
mkdir -p .claude/skills && cp -r node_modules/svelte-zukan/skills/* .claude/skills/
```

## svelte-zukan

最初の導入から、日々のカタログの更新まで使うスキルです。

- svelte-zukan を導入します。`package.json` と `vite.config` を読み、`zukan()` を `plugins` の先頭に置き、プロジェクトに必要な[オプション](/ja/options)だけを足します。グローバルな CSS や Provider があれば [wrapper](/ja/wrapper)、コンポーネントが 1 つのディレクトリにまとまっていれば `groups`、ダークモードのないアプリなら `theme: 'light'` を設定し、`build: true` は[静的なカタログ](/ja/static-export)がほしいときだけ入れます。[モノレポ](/ja/monorepo)にも対応しています
- コンポーネントの隣にカタログファイルを書きます。見ておきたい状態ごとにセクションを分け、実際に近い内容を入れます
- props ごとに JSDoc コメントを付け（[Props の一覧](/ja/catalog-files#props-の一覧)に出ます）、コンポーネントの用途を短く書いた `<Name>.zukan.md` を置きます
- [`catalog.json`](/ja/ai-agents#データとしてのカタログ)（エラーがないか、セクションがそろっているか、すべての prop に説明があるか）、プレビュー、[アクセシビリティ検査](/ja/accessibility)で結果を確かめます

たとえば次のように頼みます。

- 「このプロジェクトに svelte-zukan を入れて、`src/lib` のコンポーネントをカタログに載せて」
- 「Button に `size` を足したので、カタログと説明を更新して」
- 「新しく作った `DatePicker` のカタログファイルと説明を書いて」
- 「Button のセクションでアクセシビリティ検査をして、違反を直して」

## migrate-svelte-zukan

Storybook や Histoire から一度だけ移行するときのスキルです。導入と確認は `svelte-zukan` スキルに沿って進めるので、両方を入れてください。

| Storybook / Histoire                                                    | svelte-zukan                 |
| ----------------------------------------------------------------------- | ---------------------------- |
| ストーリーや variant                                                    | 同じ名前の `<Section>`       |
| `args`                                                                  | コンポーネントに書いた props |
| `argTypes` の説明                                                       | props の JSDoc               |
| コンポーネントの説明、MDX ファイルの本文、`<Name>.story.md`             | `<Name>.zukan.md`            |
| `preview.*` のグローバルな CSS と decorator、Histoire の setup ファイル | wrapper                      |
| `build-storybook` や `story:build` のスクリプト                         | `build: true`                |

次のものには置き換え先がありません。見つかったものはエージェントが報告します。

- controls は、見ておきたい値ごとに別のセクションにします
- アクション（`fn()`、`logEvent()`）は、その結果を状態としてセクションに表示するか、ハンドラーを省きます
- `play` 関数は操作テストで、svelte-zukan では実行できません
- `Example/Button` のようなストーリーのタイトルは引き継ぎません。カタログの ID は[ファイルのパス](/ja/catalog-ids)から決まります
- Introduction のように、特定のコンポーネントに属さないドキュメントのページは、そのまま残します。古いツールを削除するときは README に移します

古いツールは、エージェントに削除を頼むまで、カタログと並べてそのまま残ります。削除を頼んでも、`play` 関数のあるストーリーがあれば、その操作テストを消してよいと伝えるまで残します。

たとえば次のように頼みます。

- 「Storybook のストーリーとドキュメントを svelte-zukan に移して」
- 「Histoire を svelte-zukan に置き換えて」

## AGENTS.md に書く例

頼まなくてもエージェントがカタログを最新に保つように、`AGENTS.md` や `CLAUDE.md` に数行書いておきます。

```md
## Component catalog

Components are cataloged with svelte-zukan. When you add or change a component in `src/lib`, add or update
`<Name>.zukan.svelte` next to it. Follow `node_modules/svelte-zukan/skills/svelte-zukan/SKILL.md`, and check the
result in `/__zukan/catalog.json` on the dev server.
```
