import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDeepSeekProvider } from "../../src/providers/deepseek";
import type { Message, ChatChunk, AIProvider } from "../../src/lib/types";

function makeMsg(
  content: string,
  role: "user" | "assistant" | "system" = "user",
): Message {
  return {
    id: `msg-${Date.now()}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

function makeSSEData(chunks: string[]): string {
  return chunks
    .map((c) => `data: {"choices":[{"delta":{"content":"${c}"},"index":0}]}\n\n`)
    .join("");
}

function makeMockResponse(chunks: string[], status = 200) {
  const body = makeSSEData(chunks) + "data: [DONE]\n\n";
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("DeepSeek Provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should have correct id, name, and tier", () => {
    const provider = createDeepSeekProvider("sk-test-key");
    expect(provider.id).toBe("deepseek");
    expect(provider.name).toBe("DeepSeek V3");
    expect(provider.tier).toBe("free");
  });

  it("should stream text chunks from SSE response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Hola", ", ¿", "cómo", " estás?"]));

    const provider = createDeepSeekProvider("sk-test-key");
    const messages = [makeMsg("Dime hola")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat(messages)) {
      chunks.push(chunk);
    }

    // Should have text chunks + done chunk
    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toBe("Hola, ¿cómo estás?");
  });

  it("should yield done chunk at the end", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["Hola"]));

    const provider = createDeepSeekProvider("sk-test-key");
    let lastChunk: ChatChunk | undefined;

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      lastChunk = chunk;
    }

    expect(lastChunk).toBeDefined();
    expect(lastChunk!.type).toBe("done");
  });

  it("should yield error chunk when no API key", async () => {
    const provider = createDeepSeekProvider();
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
  });

  it("should yield error chunk on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Unauthorized", {
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    const provider = createDeepSeekProvider("sk-bad-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("401");
  });

  it("should count tokens as chars/4", () => {
    const provider = createDeepSeekProvider("sk-test-key");
    const messages = [makeMsg("Hola, ¿cómo estás?")]; // 18 chars
    const count = provider.countTokens(messages);
    expect(count).toBe(Math.ceil(18 / 4)); // ~5 tokens
  });

  it("should validate key via API call", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const provider = createDeepSeekProvider("sk-valid-key");
    const valid = await provider.validateKey!("sk-valid-key");
    expect(valid).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("should reject invalid key", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    const provider = createDeepSeekProvider("sk-invalid-key");
    const valid = await provider.validateKey!("sk-invalid-key");
    expect(valid).toBe(false);
  });

  // ── Adapter compliance ────────────────────────────────────

  it("should conform to AIProvider interface", () => {
    const provider: AIProvider = createDeepSeekProvider("sk-test-key");
    expect(provider.id).toBe("deepseek");
    expect(provider.name).toBe("DeepSeek V3");
    expect(provider.tier).toBe("free");
    expect(typeof provider.chat).toBe("function");
    expect(typeof provider.countTokens).toBe("function");
    expect(typeof provider.validateKey).toBe("function");
  });

  // ── SseError handling ─────────────────────────────────────

  it("should yield error chunk on 500 server error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    const provider = createDeepSeekProvider("sk-test-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("500");
  });

  it("should yield error chunk on network error (SseError)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));

    const provider = createDeepSeekProvider("sk-test-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
  });

  // ── Token counting edge cases ─────────────────────────────

  it("should count 0 tokens for empty messages", () => {
    const provider = createDeepSeekProvider("sk-test-key");
    expect(provider.countTokens([])).toBe(0);
  });

  it("should count multiple messages cumulatively", () => {
    const provider = createDeepSeekProvider("sk-test-key");
    const messages = [
      makeMsg("ABC", "system"),
      makeMsg("DEFG", "user"),
      makeMsg("HIJKL", "assistant"),
    ];
    const totalChars = messages.reduce((s, m) => s + m.content.length, 0);
    expect(provider.countTokens(messages)).toBe(Math.ceil(totalChars / 4));
  });

  // ── Streaming options ─────────────────────────────────────

  it("should handle multiple chunks from SSE", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Uno ", "dos ", "tres ", "cuatro"]));

    const provider = createDeepSeekProvider("sk-test-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("test")])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBe(4);
    expect(textChunks.map((c) => c.content).join("")).toBe("Uno dos tres cuatro");
  });
});
