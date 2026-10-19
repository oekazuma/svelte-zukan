export type Messages = {
  nav: string;
  listHeading: string;
  empty: string;
  notFound: string;
  loadFailed: string;
  code: string;
  copy: string;
  copied: string;
  copyFailed: string;
  previewWidth: string;
  fullWidth: string;
};

export const messages: Record<'en' | 'ja', Messages> = {
  en: {
    nav: 'Components',
    listHeading: 'Components',
    empty: 'No catalog files found. Searched:',
    notFound: 'Not found',
    loadFailed: 'Failed to load:',
    code: 'Code',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    previewWidth: 'Preview width',
    fullWidth: '100%'
  },
  ja: {
    nav: 'コンポーネント',
    listHeading: 'コンポーネント一覧',
    empty: 'カタログファイルが見つかりません。探した場所:',
    notFound: '見つかりません',
    loadFailed: '読み込めませんでした:',
    code: 'コード',
    copy: 'コピー',
    copied: 'コピーしました',
    copyFailed: 'コピーできませんでした',
    previewWidth: 'プレビューの幅',
    fullWidth: '100%'
  }
};
