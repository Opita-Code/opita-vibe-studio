import { describe, it, expect, beforeEach } from "vitest";
import {
  saveProviderKey,
  getProviderKey,
  deleteProviderKey,
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

describe("saveProviderKey and getProviderKey", () => {
  it("should save and retrieve a provider key", async () => {
    await saveProviderKey("openai", "sk-test-123");
    const result = await getProviderKey("openai");
    expect(result).not.toBeNull();
    expect(result!.key).toBe("sk-test-123");
  });

  it("should store endpoint for custom providers", async () => {
    await saveProviderKey("custom", "ck-test-456", "https://my-llm.example.com/v1");
    const result = await getProviderKey("custom");
    expect(result!.endpoint).toBe("https://my-llm.example.com/v1");
  });

  it("should return null for unconfigured provider", async () => {
    const result = await getProviderKey("nonexistent");
    expect(result).toBeNull();
  });

  it("should throw if providerId or key is missing", async () => {
    await expect(saveProviderKey("", "key")).rejects.toThrow("requeridos");
    await expect(saveProviderKey("openai", "")).rejects.toThrow("requeridos");
  });
});

describe("deleteProviderKey", () => {
  it("should delete a provider key", async () => {
    await saveProviderKey("openai", "sk-test-123");
    await deleteProviderKey("openai");
    const result = await getProviderKey("openai");
    expect(result).toBeNull();
  });

  it("should update configured providers list after delete", async () => {
    await saveProviderKey("openai", "sk-test-123");
    await saveProviderKey("openrouter", "or-test-456");
    expect((await listConfiguredProviders()).length).toBe(2);

    await deleteProviderKey("openai");
    const configured = await listConfiguredProviders();
    expect(configured).not.toContain("openai");
    expect(configured).toContain("openrouter");
  });
});

describe("listConfiguredProviders", () => {
  it("should return empty array when no keys saved", async () => {
    const list = await listConfiguredProviders();
    expect(list).toEqual([]);
  });

  it("should list configured provider IDs", async () => {
    await saveProviderKey("openai", "sk-test-123");
    await saveProviderKey("openrouter", "or-test-456");
    const list = await listConfiguredProviders();
    expect(list).toContain("openai");
    expect(list).toContain("openrouter");
    expect(list.length).toBe(2);
  });
});

describe("getByokProviderDisplayInfo", () => {
  it("should return all providers with not_configured status", async () => {
    const info = await getByokProviderDisplayInfo();
    expect(info.length).toBe(4);
    info.forEach((p) => {
      expect(p.configured).toBe(false);
      expect(p.status).toBe("not_configured");
    });
  });

  it("should mark configured providers", async () => {
    await saveProviderKey("openai", "sk-test-123");
    const info = await getByokProviderDisplayInfo();
    const openai = info.find((p) => p.id === "openai");
    expect(openai?.configured).toBe(true);
    expect(openai?.status).toBe("connected");
    expect(openai?.maskedKey).toBeTruthy();
  });
});
