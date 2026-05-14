import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./tests/setup/localstack.ts",
    include: ["tests/e2e/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
