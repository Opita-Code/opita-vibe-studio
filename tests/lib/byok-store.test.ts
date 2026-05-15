import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProviderKey,
  getProviderKey,
  listConfiguredProviders,
  getByokProviderDisplayInfo,
  maskKey,
} from "../../src/lib/byok-store";

beforeEach(() => {
  localStorage.clear();
});

describe("maskKey", () => {
  it("should mask API key leaving first 3 and last 4 chars", () => {
    expect(maskKey("sk-proj-abc123def456")).toBe("sk-...f456");
  });

  it("should handle short keys", () => {
    expect(maskKey("abc")).toBe("***");
  });

  it("should show first 3 chars correctly", () => {
    const key = "sk-proj-abc123def456";
    const masked = maskKey(key);
    expect(masked.startsWith("sk-")).toBe(true);
    expect(masked.endsWith("3456")).toBe(false); // suffix should be last 4
  });
});

describe("saveProviderKey — auth-gated operations", () => {
  // NOTE: saveProviderKey, deleteProviderKey now require authentication
  // (the key is stored server-side via AWS Lambda). Without auth, they throw.

  it("should throw if providerId or key is missing", async () => {
    await expect(saveProviderKey("", "key")).rejects.toThrow("requeridos");
    await expect(saveProviderKey("openai", "")).rejects.toThrow("requeridos");
  });

  it("should throw when not authenticated", async () => {
    await expect(saveProviderKey("openai", "sk-test-123")).rejects.toThrow(
      /cuenta gratuita|autenticación|sesión/i,
    );
  });

  it("should return null for unconfigured provider", async () => {
    const result = await getProviderKey("openai");
    expect(result).toBeNull();
  });
});

describe("listConfiguredProviders", () => {
  it("should return empty array when no keys saved", async () => {
    const list = await listConfiguredProviders();
    expect(list).toEqual([]);
  });
});

describe("getByokProviderDisplayInfo", () => {
  it("should return all providers with not_configured status", async () => {
    const info = await getByokProviderDisplayInfo();
    expect(info.length).toBeGreaterThan(0);
    info.forEach((p) => {
      expect(p.configured).toBe(false);
      expect(p.status).toBe("not_configured");
    });
  });
});
