---
title: 設定
sidebar:
  order: 1
---

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
| `suffix`   | `string`                             | `'zukan'`  | カタログファイルの接尾辞。`/^[a-z0-9-]+$/i` に合う必要がある                                                                        |
| `groups`   | `Record<string, string \| string[]>` | 自動探索   | グループ名 → 探すディレクトリ。指定すると[自動探索](/ja/monorepo)は行わない。並び順はキーを書いた順。存在しないディレクトリはエラー |
| `wrapper`  | `string`                             | なし       | [プレビューを囲む](/ja/wrapper) `.svelte` のパス                                                                                    |
| `logo`     | `string \| false`                    | 同梱のロゴ | サイドバーのロゴ画像のパス。`false` でロゴを出さず `title` の文字列を表示                                                           |
| `title`    | `string`                             | `'zukan'`  | サイドバーのロゴの `alt` とページの `<title>`                                                                                       |
| `locale`   | `'en' \| 'ja'`                       | `'en'`     | UI の言語。`<html lang>` もこの言語になる                                                                                           |
| `build`    | `boolean \| { outDir?: string }`     | `false`    | `vite build` のときにカタログを[静的に書き出す](/ja/static-export)。`true` なら `outDir` は `'zukan-dist'`                          |

- パスはすべて Vite の root からの相対で、`.zukan/` のように `src` の外も指定できます
- 不正な値（`suffix` が規則に合わない、`locale` が未知、指定したファイルやディレクトリがない）は、設定の読み込み時にエラーになります
- `groups` のキーを数字だけにすると、JavaScript のオブジェクトの仕様で、宣言順ではなく数値順で並びます。グループ名には数字以外の文字を含めてください

## UI の言語

カタログの UI は既定で英語です。`locale: 'ja'` で日本語になります。アクセシビリティ検査の指摘もこの設定に従います。`groups` のキーやセクションのタイトルのように、利用側が書いた文字列は翻訳しません。プラグインのエラーメッセージは常に英語です。
