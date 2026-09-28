import { defineConfig } from '@playwright/test';

// Accounting Module v0.1 prototype deployment validation: runs the same
// e2e specs (parity.spec.ts + accounting.spec.ts, unmodified) against the
// real GitHub Pages preview subpath for feature/accounting-module,
// deployed alongside the untouched production root by
// .github/workflows/deploy-pages-preview.yml. Mirrors playwright.prod.config.ts's
// sandbox-proxy workarounds (unrelated to the real site's own TLS/hosting).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 2,
  expect: { timeout: 10_000 },
  use: {
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
    baseURL: 'https://b88104069.github.io/zanzan-cash-service/preview/accounting-module/',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      proxy: { server: process.env.HTTPS_PROXY ?? 'http://127.0.0.1:43925' },
      args: ['--disable-http2', '--disable-background-networking'],
    },
    ignoreHTTPSErrors: true,
  },
});
