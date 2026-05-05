import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamOpenAICompatible, streamGemini, SseError } from "../../src/providers/sse";

describe("streamOpenAICompatible", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeStreamResponse(events: string[], status = 200): Response {
    const body = events.join("\n");
    return new Response(body, {
      status,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  it("should yield content deltas from SSE events", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse([
          'data: {"choices":[{"delta":{"content":"Hola"},"index":0}]}',
          'data: {"choices":[{"delta":{"content":" "},"index":0}]}',
          'data: {"choices":[{"delta":{"content":"mundo"},"index":0}]}',
          "data: [DONE]",
        ]),
      );

    const deltas: string[] = [];
    for await (const delta of streamOpenAICompatible(
      "https://api.test.com/v1/chat/completions",
      { Authorization: "Bearer test-key" },
      { model: "test-model", messages: [{ role: "user", content: "hi" }] },
    )) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["Hola", " ", "mundo"]);
  });

  it("should skip unparseable SSE lines", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse([
          'data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}',
          "data: [DONE]",
          "event: ping",
          'data: {"not": "valid json',
        ]),
      );

    const deltas: string[] = [];
    for await (const delta of streamOpenAICompatible(
      "https://api.test.com/v1/chat/completions",
      {},
      { model: "test", messages: [] },
    )) {
      deltas.push(delta);
    }

    // Should only have the valid delta
    expect(deltas).toEqual(["Hello"]);
  });

  it("should throw SseError on non-ok response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("Unauthorized", { status: 401 }));

    await expect(async () => {
      for await (const _delta of streamOpenAICompatible(
        "https://api.test.com/v1/chat/completions",
        {},
        { model: "test", messages: [] },
      )) {
        // Should throw before yielding
      }
    }).rejects.toThrow(SseError);
  });

  it("should include stream:true in the request body", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        makeStreamResponse([
          'data: {"choices":[{"delta":{"content":"ok"},"index":0}]}',
          "data: [DONE]",
        ]),
      );

    for await (const _delta of streamOpenAICompatible(
      "https://api.test.com/v1/chat/completions",
      {},
      { model: "test", messages: [] },
    )) {
      // consume
    }

    const callBody = JSON.parse(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(callBody.stream).toBe(true);
  });
});

describe("streamGemini", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeGeminiStreamResponse(texts: string[], status = 200): Response {
    const events = texts.map(
      (t) =>
        `data: {"candidates":[{"content":{"parts":[{"text":"${t}"}],"role":"model"}}]}`,
    );
    const body = events.join("\n");
    return new Response(body, {
      status,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  it("should yield text parts from Gemini SSE", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(makeGeminiStreamResponse(["Hola", " mundo"]));

    const deltas: string[] = [];
    for await (const delta of streamGemini(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:streamGenerateContent?alt=sse&key=test",
      {},
      { contents: [{ parts: [{ text: "Hi" }] }] },
    )) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["Hola", " mundo"]);
  });

  it("should throw SseError on non-ok response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("Forbidden", { status: 403 }));

    await expect(async () => {
      for await (const _delta of streamGemini(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:streamGenerateContent?alt=sse&key=bad",
        {},
        { contents: [] },
      )) {
        // Should throw before yielding
      }
    }).rejects.toThrow(SseError);
  });
});
