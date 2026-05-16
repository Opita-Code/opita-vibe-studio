import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'staging',
      use: { 
        ...devices['Desktop Chrome'],
        baseURL: 'https://dev.opitacode.com',
      },
      timeout: 120 * 1000, // Agent needs time to think and generate
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 1420,
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
