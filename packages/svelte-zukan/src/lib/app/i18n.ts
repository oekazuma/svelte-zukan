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
  outline: string;
  expand: string;
  collapse: string;
  loading: string;
  onThisPage: string;
  previous: string;
  next: string;
  shortcuts: string;
  shortcutSearch: string;
  shortcutNext: string;
  shortcutPrevious: string;
  shortcutExpanded: string;
  shortcutHelp: string;
  close: string;
  props: string;
  propName: string;
  propType: string;
  propDefault: string;
  propDescription: string;
  required: string;
  bindable: string;
  propsType: string;
  copyLink: string;
  background: string;
  backgroundTheme: string;
  backgroundChecker: string;
  backgroundGrid: string;
  widthInPixels: string;
  shortcutTheme: string;
  shortcutExpand: string;
  shortcutTree: string;
  checkA11y: string;
  a11yChecking: string;
  a11yPassed: string;
  a11yIssues: string;
  a11yFailed: string;
  a11yLearnMore: string;
  a11yRerun: string;
  impactCritical: string;
  impactSerious: string;
  impactModerate: string;
  impactMinor: string;
  a11yHighlight: string;
  vision: string;
  visionNone: string;
  visionBlurred: string;
  visionProtanopia: string;
  visionDeuteranopia: string;
  visionTritanopia: string;
  visionAchromatopsia: string;
  visionHintBlurred: string;
  visionHintProtanopia: string;
  visionHintDeuteranopia: string;
  visionHintTritanopia: string;
  visionHintAchromatopsia: string;
  scaledToFit: string;
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
    noSections: 'This file has no <Section>, so there is nothing to preview.',
    outline: 'Show outlines',
    expand: 'Expand',
    collapse: 'Exit expanded view (Esc)',
    loading: 'Loading the preview',
    onThisPage: 'On this page',
    previous: 'Previous',
    next: 'Next',
    shortcuts: 'Keyboard shortcuts',
    shortcutSearch: 'Search the components',
    shortcutNext: 'Next component',
    shortcutPrevious: 'Previous component',
    shortcutExpanded: 'Leave an expanded preview',
    shortcutHelp: 'Show these shortcuts',
    close: 'Close',
    props: 'Props',
    propName: 'Name',
    propType: 'Type',
    propDefault: 'Default',
    propDescription: 'Description',
    required: 'required',
    bindable: 'bindable',
    propsType: 'Typed by',
    copyLink: 'Copy link to this view',
    background: 'Background',
    backgroundTheme: 'Theme',
    backgroundChecker: 'Checkerboard',
    backgroundGrid: 'Grid',
    widthInPixels: 'Width in pixels',
    shortcutTheme: 'Switch between light and dark',
    shortcutExpand: 'Expand the preview in view, or leave it',
    shortcutTree: 'Move through the component list; open and close folders',
    checkA11y: 'Check accessibility',
    a11yChecking: 'Checking…',
    a11yPassed: 'No accessibility issues found',
    a11yIssues: 'Accessibility issues',
    a11yFailed: 'Could not run the check:',
    a11yLearnMore: 'Learn more',
    a11yRerun: 'Check again',
    impactCritical: 'critical',
    impactSerious: 'serious',
    impactModerate: 'moderate',
    impactMinor: 'minor',
    a11yHighlight: 'Highlight issues',
    vision: 'Simulate vision',
    visionNone: 'Normal',
    visionBlurred: 'Blurred',
    visionProtanopia: 'Protanopia',
    visionDeuteranopia: 'Deuteranopia',
    visionTritanopia: 'Tritanopia',
    visionAchromatopsia: 'Achromatopsia',
    visionHintBlurred: 'Details are hard to make out',
    visionHintProtanopia: 'Red is hard to tell apart',
    visionHintDeuteranopia: 'Green is hard to tell apart',
    visionHintTritanopia: 'Blue is hard to tell apart',
    visionHintAchromatopsia: 'No colors, only lightness',
    scaledToFit: 'Wider than the page: laid out at this width and scaled down to fit'
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
    noSections: 'このファイルには <Section> がないため、プレビューするものがありません。',
    outline: '要素の枠線を表示',
    expand: '拡大して表示',
    collapse: '拡大表示を終える（Esc）',
    loading: 'プレビューを読み込み中',
    onThisPage: 'このページの内容',
    previous: '前へ',
    next: '次へ',
    shortcuts: 'キーボードショートカット',
    shortcutSearch: 'コンポーネントを検索',
    shortcutNext: '次のコンポーネント',
    shortcutPrevious: '前のコンポーネント',
    shortcutExpanded: '拡大表示を終える',
    shortcutHelp: 'このショートカット一覧を表示',
    close: '閉じる',
    props: 'Props',
    propName: '名前',
    propType: '型',
    propDefault: '既定値',
    propDescription: '説明',
    required: '必須',
    bindable: 'bind 可',
    propsType: '型の定義',
    copyLink: 'この表示へのリンクをコピー',
    background: '背景',
    backgroundTheme: 'テーマの色',
    backgroundChecker: '市松模様',
    backgroundGrid: 'グリッド',
    widthInPixels: '幅（px）',
    shortcutTheme: 'ライトとダークを切り替える',
    shortcutExpand: '表示中のプレビューを拡大する（もう一度で戻る）',
    shortcutTree: 'コンポーネントの一覧を移動する・フォルダーを開閉する',
    checkA11y: 'アクセシビリティを検査',
    a11yChecking: '検査中…',
    a11yPassed: 'アクセシビリティの問題は見つかりませんでした',
    a11yIssues: 'アクセシビリティの問題',
    a11yFailed: '検査を実行できませんでした:',
    a11yLearnMore: '詳しく',
    a11yRerun: 'もう一度検査',
    impactCritical: '重大',
    impactSerious: '深刻',
    impactModerate: '中程度',
    impactMinor: '軽微',
    a11yHighlight: '問題を強調',
    vision: '見え方',
    visionNone: '通常',
    visionBlurred: 'ぼやけ',
    visionProtanopia: 'P 型色覚',
    visionDeuteranopia: 'D 型色覚',
    visionTritanopia: 'T 型色覚',
    visionAchromatopsia: '1 色覚',
    visionHintBlurred: '細かいところが見えにくい',
    visionHintProtanopia: '赤が見分けにくい',
    visionHintDeuteranopia: '緑が見分けにくい',
    visionHintTritanopia: '青が見分けにくい',
    visionHintAchromatopsia: '色がなく、明るさだけで見える',
    scaledToFit: 'ページより広いので、この幅で描画して縮小表示しています'
  }
};
