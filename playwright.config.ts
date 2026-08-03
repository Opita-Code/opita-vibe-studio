import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// ⚠️ REGLA DURA (2026-08-03): Playwright ABOLIDO para tests.
// Esta config y la suite tests/e2e quedan como ARCHIVO REFERENCIA (no se ejecutan
// en CI ni en desarrollo). La validación browser se hace con dark-copilot (MCP
// Chromium real) sobre el dev server o el stage target.
// Decisión: dark-memory row 217 (pinned). Eliminar físicamente cuando el
// operador apruebe la conversión/borrado de la suite en el PR.

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
      // production-smoke.spec.ts solo corre contra prod (proyecto "production").
      // El dev server local no sirve la landing estática ni tiene el stack real.
      testIgnore: '**/production-smoke.spec.ts',
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
