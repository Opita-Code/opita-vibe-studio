import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("FileSystemBackend factory", () => {
  const original = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

  beforeEach(() => {
    // Reset module state between tests
    vi.resetModules();
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = original;
  });

  describe("setFileSystemBackend / getFileSystemBackend", () => {
    it("should store and return the injected backend", async () => {
      const { setFileSystemBackend, getFileSystemBackend } =
        await import("../../../src/lib/fs-backend/factory");
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");

      const backend = new TauriFS();
      setFileSystemBackend(backend);
      expect(getFileSystemBackend()).toBe(backend);
    });

    it("should throw when no backend is set", async () => {
      const { getFileSystemBackend } =
        await import("../../../src/lib/fs-backend/factory");

      // Reset internal state by calling setFileSystemBackend(null)
      const { setFileSystemBackend } =
        await import("../../../src/lib/fs-backend/factory");
      setFileSystemBackend(null);

      expect(() => getFileSystemBackend()).toThrow(
        "FileSystemBackend not initialized",
      );
    });

    it("should allow replacing the backend", async () => {
      const { setFileSystemBackend, getFileSystemBackend } =
        await import("../../../src/lib/fs-backend/factory");
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");

      const backend1 = new TauriFS();
      const backend2 = new TauriFS();
      setFileSystemBackend(backend1);
      setFileSystemBackend(backend2);
      expect(getFileSystemBackend()).toBe(backend2);
    });
  });

  describe("createFileSystemBackend", () => {
    it("should return a TauriFS when running in Tauri", async () => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
      const { createFileSystemBackend } =
        await import("../../../src/lib/fs-backend/factory");
      const { TauriFS } = await import("../../../src/lib/fs-backend/tauri");

      const backend = createFileSystemBackend();
      expect(backend).toBeInstanceOf(TauriFS);
    });

    it("should return BrowserFS when running in browser", async () => {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
      const { createFileSystemBackend } =
        await import("../../../src/lib/fs-backend/factory");
      const { BrowserFS } = await import("../../../src/lib/fs-backend/browser");

      const backend = createFileSystemBackend();
      expect(backend).toBeInstanceOf(BrowserFS);
    });
  });
});
