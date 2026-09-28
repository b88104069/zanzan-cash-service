import { defineConfig } from '@playwright/test';

// Gate 5 closure evidence: runs the same e2e/parity.spec.ts checklist
// against the real deployed GitHub Pages URL instead of the local dev
// server — no webServer block, since there is nothing local to start.
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
    baseURL: 'https://b88104069.github.io/zanzan-cash-service/',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      proxy: { server: process.env.HTTPS_PROXY ?? 'http://127.0.0.1:43925' },
      args: ['--disable-http2', '--disable-background-networking'],
    },
    // This session's outbound HTTPS goes through a local egress proxy with
    // its own CA, which Chromium's bundled cert store doesn't trust —
    // unrelated to the real github.io TLS certificate. Safe to bypass only
    // for this closure-evidence run against the sandboxed test environment.
    ignoreHTTPSErrors: true,
  },
});
