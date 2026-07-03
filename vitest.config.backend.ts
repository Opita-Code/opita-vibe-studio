/// <reference types="vitest" />
import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Backend-only vitest config.
 *
 * Sprint: 2026-07-03-cuentas-v3-consumer-vibe (T-4)
 * Run: npx vitest run --config vitest.config.backend.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './packages/vibe-ai-backend/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/vibe-ai-backend/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/**',          // Exclude frontend tests
      'tests/e2e/**',    // Exclude e2e tests
      'tests/unit/**',   // Exclude unit tests (require AWS mocking)
    ],
    testTimeout: 30_000,
  },
});