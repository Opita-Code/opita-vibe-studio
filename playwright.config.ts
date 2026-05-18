import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  globalSetup: './tests/e2e/global-setup.ts',
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
    {
      name: 'production',
      testMatch: 'production-smoke.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://vibe.opitacode.com',
      },
      timeout: 60 * 1000,
    },
  ],
  webServer: process.env.PW_PROJECT === 'production' ? undefined : {
    command: 'npm run dev',
    port: 1420,
    reuseExistingServer: true,
    timeout: 30 * 1000,
  },
});
