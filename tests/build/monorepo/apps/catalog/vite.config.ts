import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// ZUKAN_FROM_DIST=1: the built package (`pnpm run package`), linked by setup.mjs; otherwise the package's source
const { zukan } = process.env.ZUKAN_FROM_DIST
  ? await import('svelte-zukan/vite')
  : await import('../../../../../packages/svelte-zukan/src/lib/vite/index.js');

export const config = (
  kit: { paths?: { base: '' | `/${string}` }; output?: { bundleStrategy: 'split' | 'single' | 'inline' } } = {}
) =>
  defineConfig({
    resolve: {
      alias: process.env.ZUKAN_FROM_DIST
        ? []
        : [
            {
              find: /^svelte-zukan$/,
              replacement: fileURLToPath(
                new URL('../../../../../packages/svelte-zukan/src/lib/index.ts', import.meta.url)
              )
            }
          ]
    },
    plugins: [zukan({ build: true }), sveltekit({ adapter: adapter(), ...kit })]
  });

export default config();
