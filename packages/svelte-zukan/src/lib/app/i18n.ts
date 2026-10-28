import type { TailwindCategoryId } from '../types.js';

export type Messages = {
  nav: string;
  listHeading: string;
  empty: string;
  notFound: string;
  notFoundHint: string;
  notFoundBack: string;
  skipToContent: string;
  loadFailed: string;
  renderFailed: string;
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
  a11yReview: string;
  a11yReviewHint: string;
  a11yFailed: string;
  a11yLearnMore: string;
  a11yRerun: string;
  impactCritical: string;
  impactSerious: string;
  impactModerate: string;
  impactMinor: string;
  a11yHighlight: string;
  a11yTools: string;
  a11yTextZoom: string;
  a11yTextZoomHint: string;
  a11yTabOrder: string;
  a11yTabOrderHint: string;
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
  measure: string;
  uncataloged: string;
  uncatalogedHint: string;
  openInEditor: string;
  searchCatalog: string;
  searchPlaceholder: string;
  searchPlaceholderTailwind: string;
  searchResults: string;
  searchGroups: string;
  searchAllGroups: string;
  searchComponents: string;
  searchSections: string;
  searchProps: string;
  searchDescriptions: string;
  shortcutSearchCatalog: string;
  shortcutSearchCatalogTailwind: string;
  tailwind: string;
  filterTokens: string;
  sampleText: string;
  sampleTextValue: string;
  fullConfig: string;
  copyClass: string;
  copyVariable: string;
  noTokens: string;
  tailwindError: string;
  tokenVariable: string;
  tokenValue: string;
  computedSize: string;
  tailwindCategories: string;
  groupColors: string;
  groupSizing: string;
  groupTypography: string;
  groupBorders: string;
  groupEffects: string;
  groupLayout: string;
  otherVariables: string;
  tokenCount: string;
  variableCount: string;
};

export const messages: Record<'en' | 'ja', Messages> = {
  en: {
    nav: 'Components',
    listHeading: 'Components',
    empty: 'No catalog files found. Searched:',
    notFound: 'Not found',
    notFoundHint: 'No component or page has this address. It may have been renamed or removed.',
    notFoundBack: 'All components',
    skipToContent: 'Skip to content',
    loadFailed: 'Failed to load:',
    renderFailed: 'Failed to render:',
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
    a11yReview: 'Needs a manual check',
    a11yReviewHint:
      'axe-core could not decide these on its own, for example the contrast of text over an image or a gradient. Read about each rule and check it yourself.',
    a11yFailed: 'Could not run the check:',
    a11yLearnMore: 'Learn more',
    a11yRerun: 'Check again',
    impactCritical: 'critical',
    impactSerious: 'serious',
    impactModerate: 'moderate',
    impactMinor: 'minor',
    a11yHighlight: 'Outline where issues were found',
    a11yTools: 'Check',
    a11yTextZoom: 'Text 200%',
    a11yTextZoomHint:
      "Doubles the text size in the preview, as raising the browser's default font size does. Text with a fixed px size stays as it is",
    a11yTabOrder: 'Tab order',
    a11yTabOrderHint: 'Numbers the elements the Tab key moves to, in that order',
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
    scaledToFit: 'Wider than the page: laid out at this width and scaled down to fit',
    measure: 'Measure elements on hover',
    uncataloged: 'Components without a catalog file',
    uncatalogedHint:
      'These .svelte files have no catalog file next to them. Add one to show a component in the catalog.',
    openInEditor: 'Open in editor',
    searchCatalog: 'Search the catalog',
    searchPlaceholder: 'Names, sections, props and descriptions',
    searchPlaceholderTailwind: 'Names, sections, props, descriptions and Tailwind CSS tokens',
    searchResults: 'Results',
    searchGroups: 'Groups',
    searchAllGroups: 'All',
    searchComponents: 'Components',
    searchSections: 'Sections',
    searchProps: 'Props',
    searchDescriptions: 'Descriptions',
    shortcutSearchCatalog: 'Search names, sections, props and descriptions',
    shortcutSearchCatalogTailwind: 'Search names, sections, props, descriptions and Tailwind CSS tokens',
    tailwind: 'Tailwind CSS',
    filterTokens: 'Filter tokens',
    sampleText: 'Sample text',
    sampleTextValue: 'The quick brown fox jumps over the lazy dog',
    fullConfig: 'Full config',
    copyClass: 'Copy class',
    copyVariable: 'Copy variable',
    noTokens: 'No matching tokens',
    tailwindError: 'Could not load the Tailwind CSS data:',
    tokenVariable: 'Variable',
    tokenValue: 'Value',
    computedSize: 'Computed size',
    tailwindCategories: 'Tailwind CSS categories',
    groupColors: 'Colors',
    groupSizing: 'Spacing & sizing',
    groupTypography: 'Typography',
    groupBorders: 'Borders',
    groupEffects: 'Effects',
    groupLayout: 'Layout',
    otherVariables: 'Other',
    tokenCount: 'Tokens',
    variableCount: 'Theme variables'
  },
  ja: {
    nav: 'コンポーネント',
    listHeading: 'コンポーネント一覧',
    empty: 'カタログファイルが見つかりません。探した場所:',
    notFound: '見つかりません',
    notFoundHint: 'このアドレスのコンポーネントやページはありません。名前が変わったか、削除された可能性があります。',
    notFoundBack: 'コンポーネント一覧へ',
    skipToContent: '本文へスキップ',
    loadFailed: '読み込めませんでした:',
    renderFailed: '表示できませんでした:',
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
    propDefault: 'デフォルト',
    propDescription: '説明',
    required: '必須',
    bindable: 'バインド可能',
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
    a11yReview: '手動での確認が必要',
    a11yReviewHint:
      'axe-core だけでは判定できなかった項目です。画像やグラデーションの上にある文字のコントラストなどが当たります。ルールごとの説明を読み、自分で確かめてください。',
    a11yFailed: '検査を実行できませんでした:',
    a11yLearnMore: '詳しく',
    a11yRerun: 'もう一度検査',
    impactCritical: '重大',
    impactSerious: '深刻',
    impactModerate: '中程度',
    impactMinor: '軽微',
    a11yHighlight: '問題が見つかった箇所を枠で囲む',
    a11yTools: '確かめる',
    a11yTextZoom: '文字 200%',
    a11yTextZoomHint:
      'ブラウザーの既定の文字サイズを上げたときと同じように、プレビューの文字を 2 倍にします。px で大きさを固定した文字は変わりません',
    a11yTabOrder: 'Tab の順番',
    a11yTabOrderHint: 'Tab キーでフォーカスが移る要素に、移る順の番号を付けます',
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
    scaledToFit: 'ページより広いので、この幅で描画して縮小表示しています',
    measure: 'カーソルを当てた要素を計測',
    uncataloged: 'カタログファイルがないコンポーネント',
    uncatalogedHint:
      '次の .svelte ファイルには、隣にカタログファイルがありません。カタログファイルを置くと、カタログに加わります。',
    openInEditor: 'エディターで開く',
    searchCatalog: 'カタログを検索',
    searchPlaceholder: '名前・セクション・Props・説明',
    searchPlaceholderTailwind: '名前・セクション・Props・説明・Tailwind CSS のトークン',
    searchResults: '検索結果',
    searchGroups: 'グループ',
    searchAllGroups: 'すべて',
    searchComponents: 'コンポーネント',
    searchSections: 'セクション',
    searchProps: 'Props',
    searchDescriptions: '説明',
    shortcutSearchCatalog: '名前・セクション・Props・説明から探す',
    shortcutSearchCatalogTailwind: '名前・セクション・Props・説明・Tailwind CSS のトークンから探す',
    tailwind: 'Tailwind CSS',
    filterTokens: 'トークンを絞り込む',
    sampleText: 'サンプルテキスト',
    sampleTextValue: 'いろはにほへと ちりぬるを The quick brown fox',
    fullConfig: 'すべてのテーマ変数',
    copyClass: 'クラス名をコピー',
    copyVariable: '変数名をコピー',
    noTokens: '一致するトークンがありません',
    tailwindError: 'Tailwind CSS のデータを読み込めませんでした:',
    tokenVariable: '変数',
    tokenValue: '値',
    computedSize: '計算後のサイズ',
    tailwindCategories: 'Tailwind CSS のカテゴリー',
    groupColors: '色',
    groupSizing: '余白とサイズ',
    groupTypography: '文字',
    groupBorders: '枠線と角丸',
    groupEffects: '効果',
    groupLayout: 'レイアウト',
    otherVariables: 'その他',
    tokenCount: 'トークン',
    variableCount: 'テーマ変数'
  }
};

/** the category names of the Tailwind CSS page; class names and variables are never translated */
export const categoryTitles: Record<'en' | 'ja', Record<TailwindCategoryId | 'full-config', string>> = {
  en: {
    'background-color': 'Background Color',
    'text-color': 'Text Color',
    'border-color': 'Border Color',
    padding: 'Padding',
    margin: 'Margin',
    'font-size': 'Font Size',
    'font-weight': 'Font Weight',
    'font-family': 'Font Family',
    'letter-spacing': 'Letter Spacing',
    'line-height': 'Line Height',
    'drop-shadow': 'Drop Shadow',
    'border-radius': 'Border Radius',
    'border-width': 'Border Width',
    width: 'Width',
    height: 'Height',
    'box-shadow': 'Box Shadow',
    opacity: 'Opacity',
    breakpoints: 'Breakpoints',
    'z-index': 'Z-index',
    spacing: 'Spacing',
    'full-config': messages.en.fullConfig
  },
  ja: {
    'background-color': '背景色',
    'text-color': '文字色',
    'border-color': '枠線の色',
    padding: 'パディング',
    margin: 'マージン',
    'font-size': 'フォントサイズ',
    'font-weight': 'フォントの太さ',
    'font-family': 'フォントファミリー',
    'letter-spacing': '文字間隔',
    'line-height': '行の高さ',
    'drop-shadow': 'ドロップシャドウ',
    'border-radius': '角丸',
    'border-width': '枠線の太さ',
    width: '幅',
    height: '高さ',
    'box-shadow': 'ボックスシャドウ',
    opacity: '不透明度',
    breakpoints: 'ブレークポイント',
    'z-index': '重なり順（z-index）',
    spacing: 'スペーシング',
    'full-config': messages.ja.fullConfig
  }
};

/** the groups of the Tailwind CSS page's category list, in order */
export const categoryGroups: { title: keyof Messages; ids: TailwindCategoryId[] }[] = [
  { title: 'groupColors', ids: ['background-color', 'text-color', 'border-color'] },
  { title: 'groupSizing', ids: ['padding', 'margin', 'spacing', 'width', 'height'] },
  { title: 'groupTypography', ids: ['font-size', 'font-weight', 'font-family', 'letter-spacing', 'line-height'] },
  { title: 'groupBorders', ids: ['border-width', 'border-radius'] },
  { title: 'groupEffects', ids: ['box-shadow', 'drop-shadow', 'opacity'] },
  { title: 'groupLayout', ids: ['breakpoints', 'z-index'] }
];
