import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['test/integration/setup.ts'],
    environment: 'node',
    // Integration tests share one real MySQL database; running them in
    // parallel workers would race on the same rows.
    fileParallelism: false,
  },
});
