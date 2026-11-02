import { defineConfig, mergeConfig, type Rollup } from 'vite';
import base from './vite.config.ts';

const outputs: Record<string, Rollup.OutputOptions | Rollup.OutputOptions[]> = {
  cjs: { format: 'cjs' },
  iife: { format: 'iife' },
  dir: { dir: 'dist' },
  array: [{ entryFileNames: 'js/[name].js' }],
  'chunks and names': {
    manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
    entryFileNames: 'js/[name].js',
    chunkFileNames: 'js/[name].js',
    assetFileNames: 'a/[name][extname]'
  },
  inlineDynamicImports: { inlineDynamicImports: true }
};

export default mergeConfig(
  base,
  defineConfig({ build: { rollupOptions: { output: outputs[process.env.FIXTURE_OUTPUT ?? ''] } } })
);
