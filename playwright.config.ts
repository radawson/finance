import { defineConfig } from '@playwright/test'

/**
 * E2E config. Drives the real app (custom server.js on :3003) in a browser.
 * The dev DB (docker postgres) must be running and seeded.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3003',
    browserName: 'chromium',
    viewport: { width: 1366, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3003/api/version',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      use: { storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
})
