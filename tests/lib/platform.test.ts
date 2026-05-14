import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("platform detection", () => {
  const original = (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

  beforeEach(() => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = original;
  });

  it("isTauri should return true when __TAURI_INTERNALS__ is present", async () => {
    const { isTauri } = await import("../../src/lib/platform");
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
  });

  it("isTauri should return false when __TAURI_INTERNALS__ is absent", async () => {
    const { isTauri } = await import("../../src/lib/platform");
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    expect(isTauri()).toBe(false);
  });

  it("getPlatform should return 'tauri' in Tauri environment", async () => {
    const { getPlatform } = await import("../../src/lib/platform");
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(getPlatform()).toBe("tauri");
  });

  it("getPlatform should return 'browser' in browser environment", async () => {
    const { getPlatform } = await import("../../src/lib/platform");
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    expect(getPlatform()).toBe("browser");
  });
});
