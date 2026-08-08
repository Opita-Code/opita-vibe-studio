/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // ── Tauri sirve assets locales → base relativo
  //    Web se sirve desde vibe.opitacode.com/app/
  base: process.env.TAURI_ENV_PLATFORM ? "./" : "/app/",

  plugins: [react()],

  // Prevent vite from obscuring rust errors
  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@opita/memory-sdk": path.resolve(__dirname, "./packages/memory-sdk/src/index.ts"),
      "@opita/dark-memory-bridge": path.resolve(__dirname, "./packages/dark-memory-bridge/src/index.ts"),
      // Test-only: the real @pulumi/aws is bundled inside .sst/platform and is
      // not resolvable from the root, which breaks vitest's transform of
      // sst.config.ts. Only sst.config.ts imports it and it never enters the
      // Vite bundle, so this alias is inert for the app build.
      "@pulumi/aws": path.resolve(__dirname, "./tests/stubs/pulumi-aws-stub.mjs"),
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    exclude: [
      "**/tests/e2e/**",
      "**/packages/**",
      "**/node_modules/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "src/**/*.{ts,tsx}",
        "landing/**/*.{js,mjs}",
        "scripts/**/*.{js,mjs}",
        "sst.config.ts",
        "packages/memory-sdk/src/**/*.ts",
        "packages/dark-memory-bridge/src/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/__tests__/**",
        "src/stories/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 70,
        lines: 80,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "zustand", "wouter", "date-fns"],
          editor: ["@codemirror/state", "@codemirror/view", "@codemirror/language"],
          preview: ["@codesandbox/sandpack-react"],
          ui: ["framer-motion", "lucide-react"],
          core: ["@tauri-apps/api", "jose"]
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
