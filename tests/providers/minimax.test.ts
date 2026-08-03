import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMiniMaxProvider } from "../../src/providers/minimax";
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

describe("MiniMax BYOK Provider", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should have correct id, name, and tier", () => {
    const provider = createMiniMaxProvider("mm-test-key");
    expect(provider.id).toBe("minimax");
    expect(provider.name).toBe("MiniMax");
    expect(provider.tier).toBe("byok");
  });

  it("should stream text chunks from SSE response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["Hola", " desde", " MiniMax", "!" ]));

    const provider = createMiniMaxProvider("mm-test-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === "text");
    const fullText = textChunks.map((c) => c.content).join("");
    expect(fullText).toBe("Hola desde MiniMax!");
  });

  it("should yield error chunk when no API key", async () => {
    const provider = createMiniMaxProvider();
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe("error");
    expect(chunks[0].content).toContain("MiniMax");
  });

  it("should yield done chunk at the end", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeMockResponse(["ok"]));

    const provider = createMiniMaxProvider("mm-test-key");
    const chunks: ChatChunk[] = [];

    for await (const chunk of provider.chat([makeMsg("Hi")])) {
      chunks.push(chunk);
    }

    expect(chunks[chunks.length - 1].type).toBe("done");
  });

  it("should use default model MiniMax-M3", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeMockResponse(["ok"]));
    globalThis.fetch = fetchMock;

    const provider = createMiniMaxProvider("mm-test-key");
    for await (const _ of provider.chat([makeMsg("Hi")])) {
      // consume stream
    }

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.minimax.io");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("MiniMax-M3");
  });

  it("should respect explicit model override", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeMockResponse(["ok"]));
    globalThis.fetch = fetchMock;

    const provider = createMiniMaxProvider("mm-test-key");
    for await (const _ of provider.chat([makeMsg("Hi")], { model: "MiniMax-M2.5-highspeed" })) {
      // consume stream
    }

    const [_, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("MiniMax-M2.5-highspeed");
  });
});
