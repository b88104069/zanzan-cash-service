import { defineConfig } from '@playwright/test';

// Gate 5 (ACTIVE): no backend server needed at all — this app is fully
// client-side (browser localStorage). Uses the environment's pre-installed
// Chromium rather than downloading one (PLAYWRIGHT_BROWSERS_PATH points at
// /opt/pw-browsers).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
