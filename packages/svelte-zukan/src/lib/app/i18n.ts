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
  mobile: string;
  tablet: string;
  laptop: string;
  desktop: string;
  fullWidth: string;
  search: string;
  noMatches: string;
  menu: string;
  darkMode: string;
  openInNewTab: string;
  noSections: string;
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
    mobile: 'Mobile',
    tablet: 'Tablet',
    laptop: 'Laptop',
    desktop: 'Desktop',
    fullWidth: 'Full width',
    search: 'Search',
    noMatches: 'No matches',
    menu: 'Menu',
    darkMode: 'Dark mode',
    openInNewTab: 'Open in new tab',
    noSections: 'This file has no <Section>, so there is nothing to preview.'
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
    mobile: 'スマートフォン',
    tablet: 'タブレット',
    laptop: 'ノート PC',
    desktop: 'デスクトップ',
    fullWidth: '全幅',
    search: '検索',
    noMatches: '一致するものがありません',
    menu: 'メニュー',
    darkMode: 'ダークモード',
    openInNewTab: '新しいタブで開く',
    noSections: 'このファイルには <Section> がないため、プレビューするものがありません。'
  }
};
