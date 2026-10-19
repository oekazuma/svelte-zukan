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
  deployment: {
    site: 'https://oekazuma.github.io',
    base: '/svelte-zukan'
  }
});
