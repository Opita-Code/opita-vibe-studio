import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCustomProvider } from "../../src/providers/custom";
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

function makeSSEChunks(chunks: string[]): string {
  return (
    chunks
      .map((c) => `data: {"choices":[{"delta":{"content":"${c}"},"index":0}]}\n\n`)
      .join("") + "data: [DONE]\n\n"
  );
}

function makeMockResponse(chunks: string[], status = 200) {
  return new Response(makeSSEChunks(chunks), {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("Custom Endpoint BYOK Provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should have correct id, name, and tier", () => {
    const provider = createCustomProvider("https://my-llm.example.com/v1", "sk-test");
    expect(provider.id).toBe("custom");
    expect(provider.name).toBe("Endpoint Personalizado");
    expect(provider.tier).toBe("byok");
  });

  it("should stream text chunks from SSE response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Response", " from", " custom"]));

    const provider = createCustomProvider("https://my-llm.example.com/v1", "sk-test");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toBe("Response from custom");
  });

  it("should yield error chunk when not configured", async () => {
    const provider = createCustomProvider();
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("Endpoint personalizado");
  });

  it("should yield error chunk when only URL provided without key", async () => {
    const provider = createCustomProvider("https://test.example.com/v1");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe("error");
  });

  it("should yield error chunk when only key provided without URL", async () => {
    const provider = createCustomProvider(undefined, "sk-test");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe("error");
  });

  it("should yield done chunk at the end", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createCustomProvider("https://test.example.com/v1", "sk-test");
    let lastChunk: ChatChunk | undefined;

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      lastChunk = chunk;
    }

    expect(lastChunk?.type).toBe("done");
  });

  it("should append /chat/completions to base URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createCustomProvider("https://my-llm.example.com/v1", "sk-test");

    for await (const _chunk of provider.chat([makeMsg("Hi")])) {
      // consume
    }

    const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callUrl).toBe("https://my-llm.example.com/v1/chat/completions");
  });

  it("should handle trailing slash in base URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createCustomProvider("https://my-llm.example.com/v1/", "sk-test");

    for await (const _chunk of provider.chat([makeMsg("Hi")])) {
      // consume
    }

    const callUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callUrl).toBe("https://my-llm.example.com/v1/chat/completions");
  });

  it("should count tokens as chars/4", () => {
    const provider = createCustomProvider("https://test.example.com", "sk-test");
    const messages = [makeMsg("Custom provider test")]; // 20 chars
    expect(provider.countTokens(messages)).toBe(Math.ceil(20 / 4));
  });
});
