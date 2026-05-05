import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createGeminiProvider } from "../../src/providers/gemini";
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

function makeGeminiSSEData(chunks: string[]): string {
  return chunks
    .map(
      (c) =>
        `data: {"candidates":[{"content":{"parts":[{"text":"${c}"}],"role":"model"}}]}\n\n`,
    )
    .join("");
}

function makeMockResponse(chunks: string[], status = 200) {
  const body = makeGeminiSSEData(chunks);
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("Gemini Provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should have correct id, name, and tier", () => {
    const provider = createGeminiProvider("test-key");
    expect(provider.id).toBe("gemini");
    expect(provider.name).toBe("Gemini Flash");
    expect(provider.tier).toBe("free");
  });

  it("should stream text chunks from Gemini SSE response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Hola", " mundo", "!"]));

    const provider = createGeminiProvider("test-key");
    const messages = [makeMsg("Dime hola")];
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat(messages)) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    expect(textChunks.length).toBeGreaterThan(0);
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toBe("Hola mundo!");
  });

  it("should yield done chunk at the end", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["Hola"]));

    const provider = createGeminiProvider("test-key");
    let lastChunk: ChatChunk | undefined;

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      lastChunk = chunk;
    }

    expect(lastChunk).toBeDefined();
    expect(lastChunk!.type).toBe("done");
  });

  it("should yield error chunk when no API key", async () => {
    const provider = createGeminiProvider();
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
  });

  it("should yield error chunk on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("API key not valid", {
        status: 403,
        statusText: "Forbidden",
      }),
    );

    const provider = createGeminiProvider("bad-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("403");
  });

  it("should count tokens as chars/4", () => {
    const provider = createGeminiProvider("test-key");
    const messages = [makeMsg("¿Cómo funciona Gemini?")]; // 22 chars
    const count = provider.countTokens(messages);
    expect(count).toBe(Math.ceil(22 / 4)); // ~6 tokens
  });

  it("should validate key via API call", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));

    const provider = createGeminiProvider("valid-key");
    const valid = await provider.validateKey!("valid-key");
    expect(valid).toBe(true);
  });

  it("should reject invalid key", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("Forbidden", { status: 403 }));

    const provider = createGeminiProvider("invalid-key");
    const valid = await provider.validateKey!("invalid-key");
    expect(valid).toBe(false);
  });
});
