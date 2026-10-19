import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import Inspect from 'vite-plugin-inspect';
import { zukan } from './src/lib/vite/index.js';

export default defineConfig(({ command }) => ({
  // the DevTools server keeps the process alive, so `vite build` would never exit; vitest also runs as 'serve' and only gets noise from it
  devtools: command === 'serve' && !process.env.VITEST,
  resolve: {
    // exact match so that `svelte-zukan/vite` is not captured
    alias: [{ find: /^svelte-zukan$/, replacement: fileURLToPath(new URL('./src/lib/index.ts', import.meta.url)) }]
  },
  plugins: [
    Inspect(),
    zukan({
      groups: { ui: 'src/lib', examples: 'src/examples' },
      wrapper: '.zukan/Wrapper.svelte',
      build: true,
      locale: 'ja'
    }),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
      },

      adapter: adapter()
    })
  ],
  test: {
    expect: { requireAssertions: true },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', headless: true }]
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**']
        }
      },

      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}', 'fixtures/**/*.test.ts'],
          // the fixtures link the repo into their node_modules; listing `exclude` drops vitest's default one
          exclude: ['**/node_modules/**', 'src/**/*.svelte.{test,spec}.{js,ts}']
        }
      }
    ]
  }
}));
