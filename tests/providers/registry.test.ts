import { describe, it, expect, beforeEach } from "vitest";
import {
  initializeProviders,
  getProvider,
  registerProvider,
  unregisterProvider,
  listProviders,
  listProviderIds,
  resetRegistry,
} from "../../src/providers/registry";
import type { AIProvider, ChatChunk, ChatOptions, Message } from "../../src/lib/types";

function makeTestProvider(
  id: string,
  name: string,
  tier: "free" | "byok" = "free",
): AIProvider {
  return {
    id,
    name,
    tier,
    chat: async function* (
      _messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      yield { type: "text", content: `response from ${id}` };
      yield { type: "done", content: "" };
    },
    countTokens: (_messages: Message[]) => 10,
  };
}

describe("Provider Registry", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("should initialize with default providers", () => {
    initializeProviders();
    const ids = listProviderIds();
    expect(ids).toContain("deepseek");
    expect(ids).toContain("gemini");
    expect(ids).toContain("openai");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("custom");
  });

  it("should get a provider by id", () => {
    initializeProviders();
    const provider = getProvider("deepseek");
    expect(provider).toBeDefined();
    expect(provider.id).toBe("deepseek");
    expect(provider.name).toBe("DeepSeek V3");
  });

  it("should throw when getting unknown provider", () => {
    initializeProviders();
    expect(() => getProvider("nonexistent")).toThrow();
  });

  it("should register a new provider", () => {
    initializeProviders();
    const testProvider = makeTestProvider("test", "Test Provider");
    registerProvider(testProvider);

    const retrieved = getProvider("test");
    expect(retrieved.name).toBe("Test Provider");
  });

  it("should replace an existing provider on re-register", () => {
    initializeProviders();
    const replacement = makeTestProvider("deepseek", "DeepSeek Custom");
    registerProvider(replacement);

    const provider = getProvider("deepseek");
    expect(provider.name).toBe("DeepSeek Custom");
  });

  it("should unregister a provider", () => {
    initializeProviders();
    const result = unregisterProvider("custom");
    expect(result).toBe(true);
    expect(() => getProvider("custom")).toThrow();
  });

  it("should return false when unregistering unknown provider", () => {
    initializeProviders();
    const result = unregisterProvider("nonexistent");
    expect(result).toBe(false);
  });

  it("should list providers with info", () => {
    initializeProviders();
    resetRegistry(); // Start fresh
    // Register test providers
    const free = makeTestProvider("free-provider", "Free", "free");
    const byok = makeTestProvider("byok-provider", "BYOK", "byok");
    registerProvider(free);
    registerProvider(byok);

    const providers = listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(2);

    const freeInfo = providers.find((p) => p.id === "free-provider");
    expect(freeInfo).toBeDefined();
    expect(freeInfo!.tier).toBe("free");

    const byokInfo = providers.find((p) => p.id === "byok-provider");
    expect(byokInfo).toBeDefined();
    expect(byokInfo!.tier).toBe("byok");
  });

  it("should list provider IDs", () => {
    initializeProviders();
    const ids = listProviderIds();
    expect(ids).toContain("deepseek");
    expect(ids).toContain("gemini");
    expect(Array.isArray(ids)).toBe(true);
  });

  it("should initialize on first getProvider call", () => {
    // Don't call initializeProviders — it should auto-init
    resetRegistry();
    const provider = getProvider("deepseek");
    expect(provider).toBeDefined();
    expect(provider.id).toBe("deepseek");
  });

  it("should handle empty registry before initialization", () => {
    resetRegistry();
    const providers = listProviders();
    // Should auto-initialize and return default providers
    expect(providers.length).toBeGreaterThan(0);
  });
});
