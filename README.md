# svelte-zukan

SvelteKit 向けのコンポーネントカタログ。コンポーネントの隣にカタログ用のファイルを置くだけで、一覧・プレビュー・コード表示がそろいます。

> 開発中です。API は予告なく変わります。

## 特徴（予定）

- `Button/zukan/Button.zukan.svelte` と `Button/zukan/Document.md` をコンポーネントの隣に置くと、カタログに自動で載る
- セクションごとに iframe でプレビューし、幅をドラッグやプリセット（375 / 768 / 1024 / 1280px）で切り替えられる
- Vite プラグインがセクションの中身をコード表示用に取り出し、参照している変数の定義も添える
- 利用側の SvelteKit アプリにルートとして組み込むので、エイリアスや Provider をそのまま使える
- カタログの見た目は利用側の Tailwind 設定などに依存せず、CSS カスタムプロパティでテーマを変えられる

## 使い方（予定）

```text
src/lib/Button/
├── Button.svelte
└── zukan/
    ├── Button.zukan.svelte
    └── Document.md
```

`import.meta.glob` は Vite が静的に解析するため、glob は利用側で 1 回だけ書いて渡します。

```ts
// src/routes/zukan/+layout.ts
export const load = () => ({
  groups: {
    components: import.meta.glob('/src/lib/**/zukan/*.zukan.svelte')
  }
});
```

## 開発

```sh
pnpm install
pnpm dev
```

## ライセンス

[MIT](LICENSE.md)
