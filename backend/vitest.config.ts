import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Excludes test/integration/** deliberately — those run against a real
    // MySQL database (see vitest.integration.config.ts / `npm run
    // test:integration`) and must stay opt-in so the default `npm test`
    // keeps running with zero external dependencies, per Gate 2's PASS
    // criterion ("core domain runs entirely without WordPress" extends to
    // "without any real infrastructure" for its own test suite).
    include: ['test/**/*.test.ts'],
    exclude: ['test/integration/**', 'node_modules/**'],
    environment: 'node',
  },
});
