import { defineConfig } from 'blume';

export default defineConfig({
  title: 'svelte-zukan',
  description: 'A component catalog for Svelte, served by a Vite plugin.',
  content: { root: 'content' },
  logo: {
    image: { light: '/light-logo.svg', dark: '/dark-logo.svg', alt: 'svelte-zukan' },
    text: ''
  },
  feedback: false,
  navigation: {
    // an action's href cannot vary by locale, so theme.css shows the demo matching the page's language
    actions: [
      { href: 'https://oekazuma.github.io/svelte-zukan/demo/', label: 'Demo' },
      { href: 'https://oekazuma.github.io/svelte-zukan/demo/ja/', label: 'デモ' },
      { href: 'https://github.com/oekazuma/svelte-zukan', label: 'GitHub' }
    ]
  },
  github: { owner: 'oekazuma', repo: 'svelte-zukan', dir: 'docs' },
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' }
    ]
  },
  // pages that used to live under guides/
  redirects: ['', '/ja'].flatMap((locale) =>
    [
      'catalog-files',
      'wrapper',
      'catalog-ui',
      'sveltekit',
      'monorepo',
      'static-export',
      'ai-agents',
      'catalog-ids'
    ].map((page) => ({ from: `${locale}/guides/${page}`, to: `${locale}/${page}`, status: 301 as const }))
  ),
  deployment: {
    site: 'https://oekazuma.github.io',
    base: '/svelte-zukan'
  }
});
