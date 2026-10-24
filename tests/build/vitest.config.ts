import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    expect: { requireAssertions: true },
    environment: 'node',
    // one file at a time: each test of build.test.ts runs a full `vite build`, and dev.test.ts starts a browser
    fileParallelism: false,
    include: ['*.test.ts']
  }
});
