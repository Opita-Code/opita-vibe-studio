import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOpenAIProvider } from "../../src/providers/openai";
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

describe("OpenAI BYOK Provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should have correct id, name, and tier", () => {
    const provider = createOpenAIProvider("sk-test");
    expect(provider.id).toBe("openai");
    expect(provider.name).toBe("OpenAI");
    expect(provider.tier).toBe("byok");
  });

  it("should stream text chunks from SSE response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Hello", " world", " from", " OpenAI"]));

    const provider = createOpenAIProvider("sk-test");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toBe("Hello world from OpenAI");
  });

  it("should yield error chunk when no API key", async () => {
    const provider = createOpenAIProvider();
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("OpenAI");
  });

  it("should yield done chunk at the end", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createOpenAIProvider("sk-test");
    let lastChunk: ChatChunk | undefined;

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      lastChunk = chunk;
    }

    expect(lastChunk?.type).toBe("done");
  });

  it("should count tokens as chars/4", () => {
    const provider = createOpenAIProvider("sk-test");
    const messages = [makeMsg("Hello, how are you?")]; // 19 chars
    expect(provider.countTokens(messages)).toBe(Math.ceil(19 / 4));
  });

  it("should use custom model when specified", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(makeMockResponse(["OK"]));

    const provider = createOpenAIProvider("sk-test", "gpt-4o");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")], { model: "gpt-4o" })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);

    // Verify fetch was called with the right model
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.model).toBe("gpt-4o");
  });

  it("should validate key via API call", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));

    const provider = createOpenAIProvider("sk-valid");
    const valid = await provider.validateKey!("sk-valid");
    expect(valid).toBe(true);
  });
});
