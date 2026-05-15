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
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "zustand", "wouter", "date-fns"],
          editor: ["@monaco-editor/react", "monaco-editor"],
          preview: ["@codesandbox/sandpack-react"],
          ui: ["framer-motion", "lucide-react"],
          core: ["@tauri-apps/api", "idb-keyval", "jose"]
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
