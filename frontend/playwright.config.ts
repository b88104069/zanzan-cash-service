import { defineConfig } from '@playwright/test';

// Uses the environment's pre-installed Chromium rather than downloading one
// (see this session's environment notes: PLAYWRIGHT_BROWSERS_PATH points at
// /opt/pw-browsers). The backend must already be running separately
// (see e2e/README.md) — this config only starts the frontend dev server.
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
