import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// ZUKAN_FROM_DIST=1: the built package (`pnpm run package`), linked by ../monorepo/setup.mjs; otherwise the package's source
const { zukan } = process.env.ZUKAN_FROM_DIST
  ? await import('svelte-zukan/vite')
  : await import('../../../packages/svelte-zukan/src/lib/vite/index.js');

export default defineConfig({
  resolve: {
    alias: process.env.ZUKAN_FROM_DIST
      ? []
      : [
          {
            find: /^svelte-zukan$/,
            replacement: fileURLToPath(new URL('../../../packages/svelte-zukan/src/lib/index.ts', import.meta.url))
          }
        ]
  },
  plugins: [svelte(), zukan({ build: true })]
});
