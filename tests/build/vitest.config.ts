import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    expect: { requireAssertions: true },
    environment: 'node',
    // both files relink the fixtures with monorepo/setup.mjs
    fileParallelism: false,
    include: ['*.test.ts']
  }
});
