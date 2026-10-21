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
