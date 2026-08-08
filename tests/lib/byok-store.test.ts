import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../../src/stores/auth";
import {
  saveProviderKey,
  getProviderKey,
  deleteProviderKey,
  listConfiguredProviders,
  getByokProviderDisplayInfo,
  loadConfiguredProvidersToRegistry,
  testProviderConnection,
  maskKey,
  getProviderDef,
  BYOK_PROVIDERS,
} from "../../src/lib/byok-store";

// ─── Registry / provider mocks (dynamic imports in byok-store) ──

const registerProvider = vi.fn();
vi.mock("../../src/providers/registry", () => ({
  registerProvider,
}));

const createCustomProvider = vi.fn((endpoint: string, key: string) => ({
  id: "custom", endpoint, key,
}));
vi.mock("../../src/providers/custom", () => ({ createCustomProvider }));

const createDeepSeekProvider = vi.fn((key: string) => ({ id: "deepseek", key }));
vi.mock("../../src/providers/deepseek", () => ({ createDeepSeekProvider }));

const createOpenAIProvider = vi.fn((key: string) => ({ id: "openai", key }));
vi.mock("../../src/providers/openai", () => ({ createOpenAIProvider }));

const createOpenRouterProvider = vi.fn((key: string) => ({ id: "openrouter", key }));
vi.mock("../../src/providers/openrouter", () => ({ createOpenRouterProvider }));

const createChatGPTWebProvider = vi.fn((key: string) => ({ id: "chatgpt-web", key }));
vi.mock("../../src/providers/chatgpt-web", () => ({ createChatGPTWebProvider }));

const createAnthropicProvider = vi.fn((key: string) => ({ id: "anthropic", key }));
vi.mock("../../src/providers/anthropic", () => ({ createAnthropicProvider }));

const createGeminiProvider = vi.fn((key: string) => ({ id: "gemini", key }));
vi.mock("../../src/providers/gemini", () => ({ createGeminiProvider }));

const createGroqProvider = vi.fn((key: string) => ({ id: "groq", key }));
vi.mock("../../src/providers/groq", () => ({ createGroqProvider }));

const createMistralProvider = vi.fn((key: string) => ({ id: "mistral", key }));
vi.mock("../../src/providers/mistral", () => ({ createMistralProvider }));

const createCohereProvider = vi.fn((key: string) => ({ id: "cohere", key }));
vi.mock("../../src/providers/cohere", () => ({ createCohereProvider }));

const createPerplexityProvider = vi.fn((key: string) => ({ id: "perplexity", key }));
vi.mock("../../src/providers/perplexity", () => ({ createPerplexityProvider }));

const createTogetherProvider = vi.fn((key: string) => ({ id: "together", key }));
vi.mock("../../src/providers/together", () => ({ createTogetherProvider }));

const createMiniMaxProvider = vi.fn((key: string) => ({ id: "minimax", key }));
vi.mock("../../src/providers/minimax", () => ({ createMiniMaxProvider }));

// ─── fetch mock ──────────────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function okJson(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

function statusResponse(status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => ({}) };
}

function authenticate(token = "jwt-token") {
  useAuthStore.setState({
    authMode: "authenticated",
    session: { token, expiresAt: Date.now() + 3600_000 },
  });
}

function setConfigured(ids: string[]) {
  localStorage.setItem("vibe-byok-configured", JSON.stringify(ids));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useAuthStore.setState({
    authMode: "unauthenticated",
    session: null,
  });
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

describe("getProviderDef / BYOK_PROVIDERS", () => {
  it("should resolve known provider definitions", () => {
    expect(getProviderDef("openai")?.name).toBe("OpenAI");
    expect(getProviderDef("custom")?.requiresEndpoint).toBe(true);
  });

  it("should return undefined for unknown providers", () => {
    expect(getProviderDef("does-not-exist")).toBeUndefined();
  });

  it("should expose the canonical provider catalog", () => {
    expect(BYOK_PROVIDERS.map((p) => p.id)).toContain("chatgpt-web");
    expect(BYOK_PROVIDERS.map((p) => p.id)).toContain("deepseek");
    expect(BYOK_PROVIDERS.map((p) => p.id)).toContain("minimax");
  });
});

describe("saveProviderKey — validation + auth gating", () => {
  it("should throw if providerId or key is missing", async () => {
    await expect(saveProviderKey("", "key")).rejects.toThrow("requeridos");
    await expect(saveProviderKey("openai", "")).rejects.toThrow("requeridos");
  });

  it("should throw when not authenticated", async () => {
    await expect(saveProviderKey("openai", "sk-test-123")).rejects.toThrow(
      /cuenta gratuita|autenticación|sesión/i,
    );
  });
});

describe("saveProviderKey — authenticated flow", () => {
  beforeEach(() => {
    authenticate();
  });

  it("should store the key server-side and persist the entry locally", async () => {
    fetchMock.mockResolvedValueOnce(okJson({}));

    await saveProviderKey("openai", "sk-secret-123");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("api.opitacode.com"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
        body: expect.stringContaining('"action":"save_key"'),
      }),
    );

    const entry = await getProviderKey("openai");
    expect(entry?.key).toBe("aws-managed");
    expect(await listConfiguredProviders()).toContain("openai");
  });

  it("should store OAuth token metadata for chatgpt-web", async () => {
    fetchMock.mockResolvedValueOnce(okJson({}));

    await saveProviderKey("chatgpt-web", "oauth-at", undefined, {
      refreshToken: "rt",
      expiresAt: "2030-01-01T00:00:00Z",
    });

    const entry = await getProviderKey("chatgpt-web");
    expect(entry?.refreshToken).toBe("rt");
    expect(entry?.expiresAt).toBe("2030-01-01T00:00:00Z");
  });

  it("should logout and throw when the backend returns 401", async () => {
    fetchMock.mockResolvedValueOnce(statusResponse(401));

    await expect(saveProviderKey("openai", "sk-bad")).rejects.toThrow(
      /Sesión expirada/,
    );
    expect(useAuthStore.getState().authMode).toBe("unauthenticated");
  });

  it("should logout and throw when the JSON error mentions Token", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ error: "Token invalid" }));

    await expect(saveProviderKey("openai", "sk-bad")).rejects.toThrow(
      /Sesión expirada/,
    );
    expect(useAuthStore.getState().authMode).toBe("unauthenticated");
  });

  it("should rethrow backend JSON errors", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ error: "quota exceeded" }));
    await expect(saveProviderKey("openai", "sk-x")).rejects.toThrow(
      "quota exceeded",
    );
  });

  it("should rethrow non-ok backend responses", async () => {
    fetchMock.mockResolvedValueOnce(statusResponse(500));
    await expect(saveProviderKey("openai", "sk-x")).rejects.toThrow(
      /AWS devolvió error/,
    );
  });

  it("should rethrow fetch network failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(saveProviderKey("openai", "sk-x")).rejects.toThrow(
      "Failed to fetch",
    );
  });

  it("should avoid duplicating the provider in the configured list", async () => {
    setConfigured(["openai"]);
    fetchMock.mockResolvedValueOnce(okJson({}));

    await saveProviderKey("openai", "sk-again");
    expect(await listConfiguredProviders()).toEqual(["openai"]);
  });
});

describe("getProviderKey", () => {
  it("should return null for unconfigured provider", async () => {
    expect(await getProviderKey("openai")).toBeNull();
  });

  it("should return null for malformed JSON", async () => {
    localStorage.setItem("vibe-byok-openai", "{not-json");
    expect(await getProviderKey("openai")).toBeNull();
  });

  it("should return the stored fields", async () => {
    localStorage.setItem(
      "vibe-byok-openai",
      JSON.stringify({
        key: "sk-stored",
        endpoint: "https://custom.example",
        refreshToken: "rt",
        expiresAt: "2030-01-01",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      }),
    );
    const entry = await getProviderKey("openai");
    expect(entry).toEqual({
      key: "sk-stored",
      endpoint: "https://custom.example",
      refreshToken: "rt",
      expiresAt: "2030-01-01",
    });
  });
});

describe("deleteProviderKey", () => {
  it("should remove the entry and update the configured list", async () => {
    setConfigured(["openai", "gemini"]);
    localStorage.setItem("vibe-byok-openai", JSON.stringify({ key: "sk", createdAt: "x", updatedAt: "x" }));

    await deleteProviderKey("openai");

    expect(localStorage.getItem("vibe-byok-openai")).toBeNull();
    expect(await listConfiguredProviders()).toEqual(["gemini"]);
  });
});

describe("listConfiguredProviders", () => {
  it("should return empty array when no keys saved", async () => {
    expect(await listConfiguredProviders()).toEqual([]);
  });

  it("should return empty array when the stored list is malformed", async () => {
    localStorage.setItem("vibe-byok-configured", "nope");
    expect(await listConfiguredProviders()).toEqual([]);
  });
});

describe("testProviderConnection", () => {
  it("should accept aws-managed keys without network", async () => {
    expect(await testProviderConnection("openai", "aws-managed")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should validate a custom endpoint against /models", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    const ok = await testProviderConnection("custom", "sk-x", "https://api.example/v1");
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("should reject a custom endpoint that fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await testProviderConnection("custom", "sk-x", "https://api.example/v1/")).toBe(false);
  });

  it("should fall back to key length when a custom endpoint is missing", async () => {
    expect(await testProviderConnection("custom", "sk-123")).toBe(true);
    expect(await testProviderConnection("custom", "")).toBe(false);
  });

  it("should validate chatgpt-web against OpenAI models", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await testProviderConnection("chatgpt-web", "sk-oauth")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({ headers: { Authorization: "Bearer sk-oauth" } }),
    );
  });

  it("should validate generic providers via their /models endpoint", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await testProviderConnection("openai", "sk-openai")).toBe(true);
    expect(await testProviderConnection("deepseek", "sk-ds")).toBe(true);
  });

  it("should send no auth header for gemini", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await testProviderConnection("gemini", "gk-123")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com"),
      expect.objectContaining({ headers: {} }),
    );
  });

  it("should validate anthropic/perplexity by key length", async () => {
    expect(await testProviderConnection("anthropic", "sk-ant-1234567")).toBe(true);
    expect(await testProviderConnection("anthropic", "short")).toBe(false);
    expect(await testProviderConnection("perplexity", "pplx-12345678")).toBe(true);
  });

  it("should return false when the key fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("network down"));
    expect(await testProviderConnection("openai", "sk-x")).toBe(false);
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

  it("should mark configured providers as connected with a masked key", async () => {
    setConfigured(["openai"]);
    localStorage.setItem(
      "vibe-byok-openai",
      JSON.stringify({
        key: "sk-secret-123456",
        endpoint: "https://custom",
        createdAt: "x",
        updatedAt: "x",
      }),
    );

    const info = await getByokProviderDisplayInfo();
    const openai = info.find((p) => p.id === "openai")!;
    expect(openai.configured).toBe(true);
    expect(openai.status).toBe("connected");
    expect(openai.maskedKey).toBe(maskKey("sk-secret-123456"));
    expect(openai.endpoint).toBe("https://custom");
  });
});

describe("syncProviderToRegistry / loadConfiguredProvidersToRegistry", () => {
  beforeEach(() => {
    authenticate();
  });

  it("should register every configured provider on load", async () => {
    setConfigured(["openai", "deepseek", "custom", "gemini"]);
    localStorage.setItem("vibe-byok-openai", JSON.stringify({ key: "k1", createdAt: "x", updatedAt: "x" }));
    localStorage.setItem("vibe-byok-deepseek", JSON.stringify({ key: "k2", createdAt: "x", updatedAt: "x" }));
    localStorage.setItem("vibe-byok-custom", JSON.stringify({ key: "k3", endpoint: "https://e", createdAt: "x", updatedAt: "x" }));
    localStorage.setItem("vibe-byok-gemini", JSON.stringify({ key: "k4", createdAt: "x", updatedAt: "x" }));

    await loadConfiguredProvidersToRegistry();

    expect(createOpenAIProvider).toHaveBeenCalledWith("k1");
    expect(createDeepSeekProvider).toHaveBeenCalledWith("k2");
    expect(createCustomProvider).toHaveBeenCalledWith("https://e", "k3");
    expect(createGeminiProvider).toHaveBeenCalledWith("k4");
    expect(registerProvider).toHaveBeenCalledTimes(4);
  });

  it("should register other provider families", async () => {
    const ids = [
      "openrouter", "chatgpt-web", "anthropic", "groq",
      "mistral", "cohere", "perplexity", "together", "minimax",
    ];
    setConfigured(ids);
    for (const id of ids) {
      localStorage.setItem(
        `vibe-byok-${id}`,
        JSON.stringify({ key: `key-${id}`, createdAt: "x", updatedAt: "x" }),
      );
    }

    await loadConfiguredProvidersToRegistry();

    expect(registerProvider).toHaveBeenCalledTimes(ids.length);
    expect(createOpenRouterProvider).toHaveBeenCalledWith("key-openrouter");
    expect(createChatGPTWebProvider).toHaveBeenCalledWith("key-chatgpt-web");
    expect(createAnthropicProvider).toHaveBeenCalledWith("key-anthropic");
    expect(createGroqProvider).toHaveBeenCalledWith("key-groq");
    expect(createMistralProvider).toHaveBeenCalledWith("key-mistral");
    expect(createCohereProvider).toHaveBeenCalledWith("key-cohere");
    expect(createPerplexityProvider).toHaveBeenCalledWith("key-perplexity");
    expect(createTogetherProvider).toHaveBeenCalledWith("key-together");
    expect(createMiniMaxProvider).toHaveBeenCalledWith("key-minimax");
  });

  it("should skip configured ids without a stored entry", async () => {
    setConfigured(["openai"]);
    await loadConfiguredProvidersToRegistry();
    expect(registerProvider).not.toHaveBeenCalled();
  });
});
