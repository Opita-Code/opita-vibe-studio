import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOpenRouterProvider } from "../../src/providers/openrouter";
import type { Message, ChatChunk } from "../../src/lib/types";

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

function makeSSEBody(chunks: string[]): string {
  return (
    chunks
      .map((c) => `data: {"choices":[{"delta":{"content":"${c}"},"index":0}]}\n\n`)
      .join("") + "data: [DONE]\n\n"
  );
}

function makeMockResponse(chunks: string[], status = 200) {
  return new Response(makeSSEBody(chunks), {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("OpenRouter BYOK Provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should have correct id, name, and tier", () => {
    const provider = createOpenRouterProvider("sk-or-test");
    expect(provider.id).toBe("openrouter");
    expect(provider.name).toBe("OpenRouter");
    expect(provider.tier).toBe("byok");
  });

  it("should stream text chunks from SSE response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Via", " OpenRouter", "!"]));

    const provider = createOpenRouterProvider("sk-or-test");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toBe("Via OpenRouter!");
  });

  it("should yield error chunk when no API key", async () => {
    const provider = createOpenRouterProvider();
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("OpenRouter");
  });

  it("should yield done chunk at the end", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createOpenRouterProvider("sk-or-test");
    let lastChunk: ChatChunk | undefined;

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      lastChunk = chunk;
    }

    expect(lastChunk?.type).toBe("done");
  });

  it("should send OpenRouter-specific headers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createOpenRouterProvider("sk-or-test");

    for await (const _chunk of provider.chat([makeMsg("Hi")])) {
      // consume
    }

    const headers = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .headers;
    expect(headers["HTTP-Referer"]).toBe("https://vibe-studio.opita.co");
    expect(headers["X-Title"]).toBe("Vibe Studio");
  });

  it("should count tokens as chars/4", () => {
    const provider = createOpenRouterProvider("sk-or-test");
    const messages = [makeMsg("Test message for OpenRouter")]; // 27 chars
    expect(provider.countTokens(messages)).toBe(Math.ceil(27 / 4));
  });

  it("should use custom default model", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createOpenRouterProvider("sk-or-test", "anthropic/claude-3-haiku");

    for await (const _chunk of provider.chat([makeMsg("Hi")])) {
      // consume
    }

    const body = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body.model).toBe("anthropic/claude-3-haiku");
  });

  it("should validate key via API call", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));

    const provider = createOpenRouterProvider("sk-or-valid");
    const valid = await provider.validateKey!("sk-or-valid");
    expect(valid).toBe(true);
  });
});
