# svelte-zukan /__zukan/ 化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `vite.config.ts` に `zukan()` を足すだけで、dev サーバーの `/__zukan/` にカタログが出るようにする。`build: true` なら `vite build` でカタログを静的な SPA として書き出す。

**Architecture:** プラグインが探索ディレクトリを決め（自動探索か `groups`）、`fs.globSync` で `*.<suffix>.svelte` を列挙して一覧の仮想モジュールを作る。dev では `configureServer` のミドルウェアが `/__zukan/` に HTML を返し、仮想エントリがライブラリの SPA（ハッシュでルーティング）を起動する。ビルドでは `environments.zukan` を足し、`buildApp` で JS のエントリをビルドして HTML を書き出す。

**Tech Stack:** Svelte 5.57 (runes), Vite 8.3（Environment API、`buildApp`）、SvelteKit 3.0.1 と `@sveltejs/vite-plugin-svelte`（ドッグフーディングと fixture のアプリ側だけ）、vitest 4、Node 22.17 以上

**Spec:** `docs/specs/2026-10-16-catalog.md`（今回の改訂版）

**旧計画の積み残し:** 旧計画のレビューで後回しにした軽微な指摘は、この計画の各タスクに割り振った（直すもの）か、spec の「やらないこと」に理由付きで入れた

**前提:** ロゴの SVG（`src/lib/app/logo.svg`、`src/lib/app/icon.svg`、`.github/logo.svg`、`.github/logo-dark.svg`、`static/favicon.svg`）は controller が配置済みで、Task 4 と Task 6 のコミットに含める。旧計画 `docs/plans/2026-10-16-catalog.md` の Task 1〜6 は完了している。Task 7 で先に積まれたコミット（2fb60eb, 509917c）は、この計画の Task 6 で作り直す。spec の「スパイクで確かめたこと」は controller が実施済み（コードはコミットしていない）。

## Global Constraints

- 新しい依存は足さない（`pnpm install` は不要）。`peerDependencies` から `@sveltejs/kit` を外し、`vite` を足すのは package.json の編集だけで済む
- オプションは `suffix`、`groups`、`wrapper`、`logo`、`title`、`locale`、`build` の 7 つ。既定値は spec のとおり（`suffix: 'zukan'`、`title: 'zukan'`、`locale: 'en'`、`build: false`、`build: true` のときの `outDir: 'zukan-dist'`）
- 接尾辞は `/^[a-z0-9-]+$/i` のみ受け付け、正規表現に入れるときはエスケープする
- 探すのは各パッケージの `src`（`groups` 指定時は書かれたディレクトリ）だけ。列挙は `fs.globSync`
- パスは `vite` の `normalizePath` を通してから比較・出力する
- カタログの URL はハッシュ: `#/<ID>`、`#/preview/<ID>?section=<title>`
- UI の文言はすべて spec の辞書（en / ja）から出す。プラグインのエラーメッセージは英語のみ
- ライブラリのコードは `$app/*` を import しない
- コミットメッセージは `feat: ...` / `fix: ...` / `chore: ...` の日本語。経緯や Co-Authored-By は書かない
- 各タスクの終わりに `pnpm lint`、`pnpm check`、`node_modules/.bin/vitest run --project server` が通ること。client テストは `node_modules/.bin/vitest run --config .superpowers/vitest.sandbox.config.ts --no-file-parallelism`（この設定はコミットしない）
- サブエージェントは dev サーバーや静的サーバーを起動しない。ブラウザでの確認は controller が preview 機能で行う

## Review Focus

- 同じ dev サーバーにつながったアプリのタブが、カタログファイルの編集で再読み込みされない（`zukan:reload` を使う。Task 3 のテスト、Task 6 の確認）
- `wrapper` が import したグローバル CSS が、カタログの UI 側に効かない（プレビューのときだけ動的 import。Task 4 のテスト、Task 6 の確認）
- `/` を含むグループ名や、途中に `preview` を含む ID がハッシュで正しく往復する（Task 4 の `parseHash` / `formatHash` のテスト）
- 書き出したカタログをサブパス（例: `/docs/zukan/`）に置いても、深いリンクとプレビューが開く（Task 5 のテスト、Task 6 の確認）
- SvelteKit の更新で、カタログのビルドに Kit の置き換え（`__SVELTEKIT_*__`）が残り、`$app/*` を使うコンポーネントが壊れる（Task 7 の自動テスト）
- Vite の `base` を設定したアプリで `/__zukan/` が開く（Task 3 のテスト、Task 7 の確認）

## ファイル構成

| ファイル                                       | 役割                                                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/vite/index.ts`                        | `zukan(options?)`。オプションの検証、transform、仮想モジュール、dev のミドルウェア、監視、`fs.allow`、ビルド                                             |
| `src/lib/vite/discover.ts`（新規）             | `discoverGroups` と `listCatalog`                                                                                                                        |
| `src/lib/vite/html.ts`（新規）                 | dev とビルドの HTML を作る `renderHtml`                                                                                                                  |
| `src/lib/vite/extract.ts`                      | `title` の検証を細かくする（Task 1）                                                                                                                     |
| `src/lib/app/`（新規）                         | カタログの SPA。`App.svelte`（ハッシュのルーター）、`Sidebar.svelte`、`List.svelte`、`Detail.svelte`、`Preview.svelte`、`hash.ts`、`i18n.ts`、`logo.svg` |
| `src/lib/components/`                          | `Badge`、`CodeBlock`、`PreviewFrame`、`EntryList` は残し、文言を辞書から受け取る                                                                         |
| `src/lib/Section.svelte`、`src/lib/context.ts` | 変更なし                                                                                                                                                 |
| 削除                                           | `src/lib/Zukan.svelte`、`src/lib/components/Detail.svelte`・`Preview.svelte`（`app/` に移す）、`src/lib/entries.ts`、`Groups` 型                         |
| `fixtures/monorepo/`                           | モノレポ確認用                                                                                                                                           |

---

### Task 1: 接尾辞オプションと `.md` の 1 対 1 対応

**Files:** Modify `src/lib/vite/index.ts`・`src/lib/vite/extract.ts`、Test `src/lib/vite/index.test.ts`・`src/lib/vite/extract.test.ts`

**Interfaces:**

- Produces:
  - `type ZukanOptions = { suffix?; groups?; wrapper?; logo?; title?; locale?; build? }`（spec の型どおり。このタスクでは `suffix` だけを使い、ほかは受け取るだけ）
  - `zukan(options?: ZukanOptions): Plugin`
  - `createMatchers(suffix: string): { isCatalogId(id): boolean; isCatalogFile(file): boolean; isDocFile(file): boolean; docFileOf(catalogFile): string; catalogFileOf(docFile): string }`（`isZukanId` を置き換える）

- [ ] **Step 1: 失敗するテストを書く**
  - `createMatchers('zukan')`: `/a/Foo.zukan.svelte`、`?v=1` 付きは `isCatalogId` が true。`?svelte&type=style&lang.css` 付き、`\0` 付き、`/a/Foo.svelte` は false
  - `createMatchers('catalog')`: `/a/Foo.catalog.svelte` は true、`/a/Foo.zukan.svelte` は false
  - `docFileOf('/a/Foo.zukan.svelte')` は `'/a/Foo.zukan.md'`、`catalogFileOf` はその逆
  - `rejects invalid suffix`: `'a.b'` と `''` は throw（メッセージに `suffix`）
  - transform: `Foo.zukan.md` があれば HTML が入り、`addWatchFile` がその絶対パスで呼ばれる。`suffix: 'catalog'` なら `Foo.catalog.md` を読む
  - hotUpdate: `Foo.zukan.md` の create / update / delete で `getModulesByFile` が `normalizePath('<dir>/Foo.zukan.svelte')` で呼ばれる（`readdirSync` は使わない）。`Foo.zukan.svelte` がモジュールグラフにまだないとき（`getModulesByFile` が `undefined`）も例外にならない
  - `filter agrees with isCatalogId`: `transform.filter.id` の `include` と `exclude` を ID のいくつかに当てた結果が、`isCatalogId` と一致する（旧計画の「フィルターのテストが浅い」への対応）
  - extract（旧計画の積み残し）:
    - `throws on empty title`: `title=""` と `title="  "` は空のタイトルとしてエラー
    - `missing and dynamic title have different messages`: `title` なしと `title={x}` でメッセージが別
    - `collects dotted component root`: `<Foo.Bar />` で `Foo` の定義が添えられる
    - `collects transition and animate names`: `transition:fade`、`in:fly`、`animate:flip` の名前の定義が添えられる
- [ ] **Step 2: 失敗を確認** → **Step 3: 実装** → **Step 4: PASS を確認**
- [ ] **Step 5: コミット** `feat: カタログファイルの接尾辞を設定できるようにする`

### Task 2: 探索と一覧の組み立て

**Files:** Create `src/lib/vite/discover.ts`、Test `src/lib/vite/discover.test.ts`、Modify `src/lib/types.ts`

**Interfaces:**

- Consumes: `createMatchers`（Task 1）
- Produces:
  - `type CatalogGroup = { name: string; dirs: string[] }`（`dirs` は `normalizePath` 済みの絶対パス）
  - `discoverGroups(root: string, groups?: Record<string, string | string[]>): CatalogGroup[]`
  - `type CatalogItem = { group: string; name: string; dir: string; path: string; file: string }`（`path` は spec の ID）
  - `listCatalog(groups: CatalogGroup[], suffix: string): CatalogItem[]`

- [ ] **Step 1: 失敗するテストを書く。** 一時ディレクトリに構成を作る（ワークスペースのリンクは `fs.symlinkSync`）
  - 探索: `single package`、`workspace dependency`（`app` → `@acme/ui` の順）、`skips installed packages`（実ディレクトリの `node_modules/lodash`）、`dependencies before devDependencies`、`groups option`（キー順、自動探索しない）、`missing groups dir throws`
  - ID:
    - `same name in different dirs`: `src/lib/forms/Button.zukan.svelte` と `src/lib/nav/Button.zukan.svelte` → `app/lib/forms/Button` と `app/lib/nav/Button`、`name` はどちらも `Button`、`dir` は `lib/forms` と `lib/nav`
    - `collapses Dir/Dir`: `src/lib/Button/Button.zukan.svelte` → `app/lib/Button`、`dir` は `lib`
    - `groups option is relative to the given dir`、`root file has empty dir`
    - `stable when files are added`: 別ディレクトリに同名ファイルを足して作り直しても、既存の項目の `path` が変わらない
    - `suffix: 'catalog'`、`scoped group name`（`@acme/ui/lib/Card`）、`rel may contain preview`（`ui/preview/Foo` はエラーにならない）
  - 並び順: グループ順、グループ内は `rel` を `Intl.Collator('en', { numeric: true, sensitivity: 'base' })` で比べ、同順位はコードポイント順。`alert` が `Button` より前、`Item2` が `Item10` より前
  - エラー（ファイルパスかグループ名を含む）: グループ名 `preview` と `preview/x`、まとめた結果の重複、グループをまたぐ重複
  - `group without files is dropped`、`no files at all → []`
- [ ] **Step 2: 失敗を確認** → **Step 3: 実装** → **Step 4: PASS を確認**
- [ ] **Step 5: コミット** `feat: カタログファイルを探索して一覧を組み立てる`

### Task 3: dev の `/__zukan/`、一覧の仮想モジュール、監視、`fs.allow`

**Files:** Create `src/lib/vite/html.ts`、Modify `src/lib/vite/index.ts`、Test `src/lib/vite/index.test.ts`・`src/lib/vite/html.test.ts`

**Interfaces:**

- Consumes: `discoverGroups`、`listCatalog`（Task 2）
- Produces:
  - 仮想モジュール ID: エントリ `\0virtual:svelte-zukan/entry`、一覧 `\0virtual:svelte-zukan/catalog`（どちらも `resolveId` で `virtual:svelte-zukan/...` から解決）
  - `generateCatalogModule(items: CatalogItem[]): string`
  - `generateEntryModule(opts: { appFile: string; logo: string | null; wrapper: string | null; title: string; locale: 'en' | 'ja' }): string`（`appFile` などは `normalizePath` 済みの絶対パス。`logo` は `?url` 付きで import する。`wrapper` は `() => import(...)` の関数として渡す）
  - `renderHtml(opts: { title: string; locale: 'en' | 'ja'; entrySrc: string; icon: string }): string`（`icon` は SVG の文字列。`<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">` に URL エンコードして埋め込む）
  - `extendFsAllow(root: string, dirs: string[], allow: string[] | undefined): string[] | undefined`
  - `resolveOptions(root: string, options: ZukanOptions)`: 既定値を入れ、`locale`・`suffix`・`wrapper`・`logo` のファイルの存在を検証した結果を返す

- [ ] **Step 1: 失敗するテストを書く**
  - `renderHtml`: `<html lang="ja">`、`<title>` が `title`、`<script type="module" src="...">` が `entrySrc`、`<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,...">` があり、デコードすると渡した SVG に戻る。`title` の `<` などはエスケープされる
  - `generateCatalogModule`: `import("/abs/Card.zukan.svelte")` と `"path":"@acme/ui/lib/Card"` を含む
  - `generateEntryModule`: `logo: null` なら logo の import がない。`wrapper: null` なら `wrapper` は `null`
  - `resolveOptions`: 既定値、`locale: 'fr'` で throw、存在しない `wrapper` / `logo` で throw（パスを含む英語のメッセージ）
  - middleware: 偽の `server`（`middlewares.use` を記録、`transformIndexHtml` は入力をそのまま返す）で、`/__zukan/` と `/__zukan/?x` には HTML を返し、`/` と `/__zukanx` は `next()` に回す。`server.config.base` が `/app/` でも `/app/__zukan/` を扱う
  - `extendFsAllow`: 探索ディレクトリがすべて `searchForWorkspaceRoot(root)` の内側なら `undefined`。外側があれば `[searchForWorkspaceRoot(root), ...allow, ...外側]`
  - hotUpdate:
    - 探索ディレクトリ内の `X.zukan.svelte` の create / delete で、一覧の仮想モジュールが無効化され、client 環境では `hot.send({ type: 'custom', event: 'zukan:reload' })`。`full-reload` は送らない
    - 探索ディレクトリ外の作成は無視
  - `configureServer` が root 外の探索ディレクトリだけを `server.watcher.add` する
  - `printUrls`: `server.printUrls` を包み、カタログの URL を 1 行足す
- [ ] **Step 2: 失敗を確認** → **Step 3: 実装**（探索は `configResolved` で 1 回行い、create / delete のたびに `listCatalog` をやり直す。SPA 本体の `appFile` はプラグインのファイル位置から `new URL('../app/App.svelte', import.meta.url)` で求める） → **Step 4: PASS を確認**
- [ ] **Step 5: コミット** `feat: dev サーバーの /__zukan/ にカタログを出す`

### Task 4: カタログの SPA

**Files:**

- Create: `src/lib/app/App.svelte`、`Sidebar.svelte`、`List.svelte`、`Detail.svelte`、`Preview.svelte`、`hash.ts`、`i18n.ts`（`logo.svg` と `icon.svg` は配置済みのものを使う）
- Modify: `src/lib/components/CodeBlock/CodeBlock.svelte`（文言を props で受け取る。コピーボタンを `<summary>` の行のツールバーへ移す。失敗時の表示）、`PreviewFrame/PreviewFrame.svelte`（文言を props で受け取る。Home / End キー、`aria-valuemin` を表示領域の幅にそろえる、測るまで幅の表示と aria 値を出さない）、`EntryList.svelte`（`dir` を添える）、`src/lib/index.ts`（`Section` だけを export）、`src/lib/types.ts`（`Groups` を削除）、`package.json`（`peerDependencies` から `@sveltejs/kit` を外し `vite` を足す）
- Delete: `src/lib/Zukan.svelte`、`src/lib/components/Detail.svelte`、`src/lib/components/Preview.svelte`、`src/lib/entries.ts`、`src/lib/entries.test.ts`
- Test: `src/lib/app/hash.test.ts`、`src/lib/app/i18n.test.ts`、`src/lib/components/EntryList.svelte.test.ts`（client）、`PreviewFrame.svelte.test.ts` と `CodeBlock.svelte.test.ts`（client、追加分）、既存の client テストの修正

**Interfaces:**

- Consumes: `generateEntryModule` が渡す props（Task 3）、`CatalogItem`（Task 2）
- Produces:
  - `App` props: `{ catalog: (CatalogItem & { load: () => Promise<ZukanModule> })[]; logo: string | null; wrapper: (() => Promise<{ default: Component }>) | null; title: string; locale: 'en' | 'ja' }`
  - `parseHash(hash: string): { view: 'list' } | { view: 'detail'; path: string } | { view: 'preview'; path: string; section: string | null }`
  - `formatHash(view: 'detail' | 'preview', path: string, section?: string): string`
  - `messages: Record<'en' | 'ja', Messages>`（キーは spec の辞書の表のとおり）

- [ ] **Step 1: 失敗するテストを書く**
  - `parseHash` / `formatHash`:
    - `''`・`'#'`・`'#/'` は list
    - `formatHash('detail', '@acme/ui/lib/Card')` が `'#/%40acme/ui/lib/Card'`、`parseHash` で `@acme/ui/lib/Card` に戻る
    - `formatHash('preview', 'ui/preview/Foo', 'a b?c')` が往復する（`section` も戻る）
    - `#/preview/ui/Button` は section が `null`
    - 日本語の ID も往復する
  - `i18n`: `en` と `ja` のキーの集合が一致し、空文字がない
  - `EntryList`（client）: `shows dir to tell same names apart`。`name` が同じ 2 件で、それぞれの `dir` が表示され、リンク先（`#/...`）が別になる
  - 既存の client テストで、日本語の文言（`コード`、`コピー`、`プレビューの幅` など）で要素を探しているものを、英語の既定値で探すように直す
  - PreviewFrame（client。旧計画の積み残し）:
    - `keyboard resize`: ハンドルにフォーカスして ArrowLeft で 10px 狭くなり、Home で 200px、End で表示領域の幅
    - `drag resize`: ハンドルで `pointerdown` → `pointermove`（+50px）→ `pointerup` を送ると幅が 50px 広がり、ドラッグ中だけ iframe に `pointer-events: none` が付く。右ボタン（`button: 2`）では始まらない
    - `aria-valuemin follows a narrow stage`: 表示領域を 150px にすると `aria-valuemin` が 150 で、`aria-valuenow` がそれを下回らない
    - `height follows the preview`: `src` を `about:blank` にし、読み込み後に `contentDocument` に `[data-zukan-preview]` の要素（高さ 300px）を入れると、iframe の高さが 300px になる
  - CodeBlock（client）: `copy failure is shown`: `navigator.clipboard.writeText` が reject すると `copyFailed` の文言が出る。コピーボタンが `<summary>` と同じツールバーにある
- [ ] **Step 2: 失敗を確認** → **Step 3: 実装**
  - `App` は `hashchange` を購読し、`parseHash` の結果でサイドバー付きの list / detail と、UI なしの preview を出し分ける
  - preview のときだけ `wrapper` を動的 import して囲む。`section` があれば `setPreviewSection`
  - `import.meta.hot?.on('zukan:reload', () => location.reload())`
  - `document.title` は spec のとおり（一覧は `title`、詳細は `<name> | <title>`）
  - ロゴ: `logo` があれば `<img alt={title}>`、なければ同梱の `logo.svg`（高さ 32px 程度）（`logo: false` は `generateEntryModule` が `null` を渡し、`title` の文字列を表示する。同梱ロゴとの区別は、`logo` が `undefined` か `false` かで Task 3 が決める）
  - ルート要素で内部の CSS 変数を定義する（以前の `Zukan.svelte` と同じ既定値）
  - 以前の `Zukan.svelte` で入れた対応を引き継ぐ: 読み込み失敗の表示、詳細を切り替えたときに前の項目の PreviewFrame の状態を持ち越さない（`{#key}`）、サイドバーの `<nav aria-label>`、一覧の `h1`
- [ ] **Step 4: PASS を確認**（server と client）
- [ ] **Step 5: コミット** `feat: カタログを SvelteKit に依存しない SPA にする`

### Task 5: 静的書き出し

**Files:** Modify `src/lib/vite/index.ts`、Test `src/lib/vite/index.test.ts`

**Interfaces:**

- Consumes: `renderHtml`、`generateEntryModule`（Task 3）
- Produces:
  - `detectSvelteKit(plugins: unknown[]): Promise<boolean>`（入れ子の配列と Promise を平らにし、名前が `vite-plugin-sveltekit` で始まるものがあるか）
  - `build` が有効なとき、`config` フックの戻り値に `environments.zukan`（`consumer: 'client'`、Kit を検出したときだけ `define: { __SVELTEKIT_PAYLOAD__: 'undefined', __SVELTEKIT_HAS_SERVER_LOAD__: 'false', __SVELTEKIT_HAS_UNIVERSAL_LOAD__: 'false' }`、`build.outDir`、`build.manifest: false`、`build.rolldownOptions.input: { zukan: 'virtual:svelte-zukan/entry' }`、出力ファイル名は `assets/[name]-[hash].js` / `.css` などの固定の規則）
  - `buildApp` フック: `builder.build(builder.environments.zukan)` → entry チャンクを探して `<outDir>/index.html` を `renderHtml({ entrySrc: './' + fileName })` で書く → `<outDir>/_app/version.json` があれば消す

- [ ] **Step 1: 失敗するテストを書く**
  - `build: false`（既定）なら `config` は `environments.zukan` を返さず、`buildApp` は何もしない
  - `detectSvelteKit`: `[Promise.resolve([{ name: 'vite-plugin-sveltekit-setup' }])]` で true、`[[{ name: 'vite-plugin-svelte' }], null, false]` で false
  - Kit を検出しなかったとき、`environments.zukan` に `define` が入らない
  - `build: true` なら `outDir` が `<root>/zukan-dist`、`build: { outDir: 'out/catalog' }` なら `<root>/out/catalog`
  - `buildApp`: 偽の `builder`（`build` が entry チャンク `assets/zukan-abc.js` を含む出力を返す）で、`index.html` の script が `./assets/zukan-abc.js` になる。`_app/version.json` が消える
- [ ] **Step 2: 失敗を確認** → **Step 3: 実装** → **Step 4: PASS を確認**
- [ ] **Step 5: コミット** `feat: vite build でカタログを静的に書き出せるようにする`

### Task 6: ドッグフーディングと README

**Files:**

- Move: `src/lib/components/{Badge,CodeBlock}/zukan/*` をコンポーネントの隣へ（`git mv`。`Document.md` は `<Name>.zukan.md` に改名し、中の相対 import を直す）。`src/examples/Button/zukan/*` も同様
- Create: `src/examples/nav/Button/Button.zukan.svelte`（同名の確認用）、`src/examples/PageInfo/PageInfo.svelte` と `PageInfo.zukan.svelte`（`$app/state` の `page.url.pathname` と `$app/paths` の `resolve('/')` を表示するだけのコンポーネント。Kit の実行時 API がカタログでどう動くかの確認用）、`.zukan/Wrapper.svelte`（グローバル CSS を 1 つ import し、`children` を囲む例）、`.zukan/global.css`（例: `body { background: #fffbe6 }`）
- Delete: `src/routes/zukan/`
- Modify: `src/routes/+page.svelte`（ライブラリの紹介と、dev なら `/__zukan/` へのリンク）、`vite.config.ts`（`zukan({ groups: { ui: 'src/lib', examples: 'src/examples' }, wrapper: '.zukan/Wrapper.svelte', build: true, locale: 'ja' })`、`resolve.alias` は残す）、`package.json`（`files` を `!dist/**/*.zukan.svelte`、`!dist/**/*.zukan.md` に。`description` と `keywords` を spec の「対応範囲」のとおりに）、`.gitignore`（`/zukan-dist`）、`README.md`

- [ ] **Step 1: ファイルを移して直す**
- [ ] **Step 2: README を書き直す**（spec の「README」の節のとおり。先頭は `<picture>` で `.github/logo-dark.svg` と `.github/logo.svg` を切り替える。「Svelte の公式プロジェクトではない」の一行を入れる）
- [ ] **Step 3: `pnpm lint`、`pnpm check`、server / client テスト、`pnpm build` を通す。** `zukan-dist/index.html` と `zukan-dist/assets/` があり、`zukan-dist/_app` がないこと。`pnpm pack --dry-run` に `.zukan.` を含むファイルがないこと
- [ ] **Step 4: コミット** `feat: カタログファイルをコンポーネントの隣に置く形に移す`、`chore: README を書き直す`
- [ ] **Step 5（controller）: preview 機能で dev を起動して確かめる**
  - `/__zukan/` の一覧が `ui` → `examples` の順でバッジ付き。`Button` が 2 つ並び、片方に `nav` が添えられる。UI が日本語、`<html lang="ja">`、サイドバーのロゴとタブのファビコンが同梱の zukan のもの
  - 詳細、プレビュー、コード、`.md`
  - プレビューの背景が `.zukan/global.css` の色で、カタログの UI 側の背景は変わらない
  - アプリの `/` を別タブで開いたまま、カタログファイルを新規作成・削除・編集すると、カタログのタブだけが再読み込みされる。`Button.svelte` の編集は両方のタブに HMR で反映される
  - `$app/paths` の `resolve` を使う小さなコンポーネントをカタログで表示し、結果を README に書く
- [ ] **Step 6（controller）:** `zukan-dist` をサブパス（例: `/docs/zukan/`）で静的配信し、一覧、`#/examples/nav/Button` の深いリンク、プレビューが開くこと。`#/examples/PageInfo` がエラーにならずに描画されること（`__SVELTEKIT_PAYLOAD__` の define が効いている確認）

### Task 7: fixture（モノレポの SvelteKit と素の Vite）

**Files:**

- Create: `fixtures/monorepo/apps/catalog/`（`package.json`: name `catalog`、`dependencies` に `@fixture/ui` と `svelte-zukan`。`vite.config.ts`: `zukan()` を設定なしで登録し、`sveltekit()` と adapter-static。`src/app.html`、`src/routes/+page.svelte`、`src/routes/+layout.ts`。2 つ目の確認用に `vite.config.base.ts`（`base: '/app/'` の設定）も置く）
- Create: `fixtures/monorepo/packages/ui/`（`package.json`: name `@fixture/ui`、`imports: { "#lib/*": "./src/lib/*" }`。`src/lib/Card/Card.svelte` が `#lib/label.js` を import、`Card.zukan.svelte`、`Card.zukan.md`、同名確認用の `src/lib/forms/Button.zukan.svelte` と `src/lib/nav/Button.zukan.svelte`）
- Create: `fixtures/monorepo/packages/ui/src/lib/PageInfo/PageInfo.svelte` と `PageInfo.zukan.svelte`（`$app/state` を使う）
- Create: `fixtures/vite-svelte/`（素の Vite + Svelte。`package.json`: name `vite-svelte`、`vite.config.ts`: `svelte()` と `zukan({ build: true })`、`index.html`、`src/main.ts`、`src/lib/Counter/Counter.svelte` と `Counter.zukan.svelte`）
- Create: `fixtures/build.test.ts`（server プロジェクトに含める。下の Step 1）
- Create: `fixtures/monorepo/setup.mjs`（`apps/catalog/node_modules/@fixture/ui` → `../../../packages/ui`、`apps/catalog/node_modules/svelte-zukan` → repo ルート、の symlink を作る）
- Modify: `.gitignore`（`fixtures/**/.svelte-kit`、`fixtures/**/build`、`fixtures/**/dist`、`fixtures/**/zukan-dist`）、`vite.config.ts`（server プロジェクトの `include` に `fixtures/**/*.test.ts`）、`.github/workflows/ci.yml`（`windows-latest` で server プロジェクトのテストだけを回すジョブを足す。spec の「Windows のドライブ文字付きパスは CI で確かめる」への対応）

fixture の `vite.config.ts` は、環境変数 `ZUKAN_FROM_DIST` があれば `svelte-zukan/vite`（setup.mjs の symlink 経由で repo ルートの dist）を、なければ repo の `src/lib/vite/index.ts` を相対パスで読む。カタログファイルの `svelte-zukan` も同じく、なければ `resolve.alias` で `src/lib/index.ts` に向ける。自動テストは dist を作らずに src で回し、controller の確認は dist で行う

fixture には `pnpm-workspace.yaml` を置かない。置くと Vite の `searchForWorkspaceRoot` がそこで止まり、repo ルートの `dist` が許可範囲の外になって、プラグインの処理と関係なく 403 になるため。

- [ ] **Step 1: 自動テストを書く**（`fixtures/build.test.ts`、タイムアウト 120 秒）
  - `beforeAll` で `node fixtures/monorepo/setup.mjs` を実行する
  - `kit monorepo build`: `fixtures/monorepo/apps/catalog` を `cwd` にして `node <repo>/node_modules/vite/bin/vite.js build` を子プロセスで実行する（SvelteKit は `process.cwd()` をプロジェクトのルートとして使うため、vitest のワーカー内で `createBuilder` は使わない）。終了コード 0、`zukan-dist/index.html` があり、`zukan-dist/assets/*.js` のどれにも `/__SVELTEKIT_[A-Z_]+__/` が残っていない、`zukan-dist/_app` がない
  - `plain vite build`: `fixtures/vite-svelte` で同じく `vite build`。終了コード 0、アプリの `dist/` と `zukan-dist/index.html` の両方ができる
- [ ] **Step 2: ファイルを作り、テストが通ることを確かめる。** `pnpm lint` と `pnpm check` が通ること
- [ ] **Step 3: コミット** `chore: SvelteKit と素の Vite の fixture を追加する`
- [ ] **Step 4（controller）: `node fixtures/monorepo/setup.mjs` と `pnpm build`（repo ルートの dist を作る）のあと、`ZUKAN_FROM_DIST=1` で、preview 機能で fixture のアプリの dev を起動して確かめる**
  - 設定なしでグループ `@fixture/ui` が付き、`#/@fixture/ui/lib/Card` の詳細とプレビューが開く
  - `Button` が 2 つ並び、`lib/forms` と `lib/nav` で見分けられる
  - Card 内の `#lib/label.js` が ui 側で解決される
  - `node_modules` 経由で読んだ `svelte-zukan` の `Section` が、SPA と同じコンテキストを使う（`section` 指定のプレビューで、指定したセクションだけが出る）
  - `packages/ui/src/lib/New/New.zukan.svelte` を新規作成すると、再起動なしで一覧に出る
  - 403 が出ない
  - `vite.config.base.ts` で起動すると `/app/__zukan/` が開く
  - `build: true` を付けた `vite build` で `zukan-dist/index.html` が書き出され、静的配信で開く。`#/@fixture/ui/lib/PageInfo` がビルド版でもエラーにならずに描画される
- [ ] **Step 5（controller）: 素の Vite の fixture を `ZUKAN_FROM_DIST=1` で dev 起動して確かめる**
  - `/__zukan/` の一覧・詳細・プレビューが開き、アプリの `/` も動く
  - `Counter.svelte` の編集がアプリとカタログの両方に HMR で反映される。`Counter.zukan.svelte` の編集ではカタログのタブだけが再読み込みされる
  - `build: true` の `vite build` の結果を静的配信して、カタログが開く
- [ ] **Step 6: 結果を台帳に書く**
