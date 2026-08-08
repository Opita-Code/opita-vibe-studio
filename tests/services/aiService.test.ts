import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamAwsSse } from "@/services/aiService";
import { useAuthStore } from "@/stores/auth";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ─── Helpers ─────────────────────────────────────────────────────

/** Builds a ReadableStream over the given chunks from a real reader. */
function streamResponse(chunks: string[], contentType = "text/event-stream") {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: new Headers({ "content-type": contentType }),
  };
}

/** Collects all yielded events from a generator. */
async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

const sse = (data: string) => `data: ${data}\n\n`;
const json = (obj: unknown) => JSON.stringify(obj);

describe("aiService - streamAwsSse", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore.setState({ session: { token: "test-token", expiresAt: 999 } } as any);
  });

  // ── HTTP-level error handling ─────────────────────────────

  it("yields UPGRADE_REQUIRED when server responds with 403 upgrade_required", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "upgrade_required", message: "Pay up" }),
    });

    const generator = streamAwsSse([], "deepseek");
    const result = await generator.next();

    expect(result.value).toEqual({
      type: "error",
      errorType: "server",
      content: "UPGRADE_REQUIRED: Pay up",
    });
  });

  it("sends action and subagentId in the body payload", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => ({ done: true, value: undefined }),
        }),
      },
      headers: new Headers({ "content-type": "text/event-stream" }),
    });

    const generator = streamAwsSse([], "deepseek", "dummy", undefined, undefined, {
      action: "subagent",
      subagentId: "sdd-apply",
    });

    await generator.next();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"subagent"'),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"subagentId":"sdd-apply"'),
      }),
    );
  });

  it("omits the Authorization header for placeholder sessions", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore.setState({ session: { token: "__opita_session", expiresAt: 999 } } as any);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
      headers: new Headers({ "content-type": "text/event-stream" }),
    });

    await collect(streamAwsSse([], "deepseek"));
    const [, init] = mockFetch.mock.calls[0] as [string, { headers?: Record<string, string> }];
    expect(init.headers?.Authorization).toBeUndefined();
  });

  it("yields a rate-limit error on HTTP 429", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0].type).toBe("error");
    expect(events[0]).toMatchObject({ errorType: "rate-limit" });
  });

  it("translates each backend error code into friendly Spanish", async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ error: "quota_exceeded" }, /límite de uso/],
      [{ error: "unauthorized" }, /sesión ha expirado/],
      [{ error: "rate_limited" }, /Demasiadas solicitudes/],
      [{ error: "model_unavailable" }, /no está disponible/],
      [{ error: "some_technical_slug" }, /Error del servidor/],
      [{ error: "400" }, /^400$/],
      [{ error: "quota_exceeded", message: "custom msg" }, /custom msg/],
    ];

    for (const [body, pattern] of cases) {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => body });
      const events = await collect(streamAwsSse([], "deepseek"));
      const ev = events[0] as { content: string };
      expect(ev.content).toMatch(pattern);
    }
  });

  it("yields a server error when the response body is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: null,
      headers: new Headers(),
    });

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0]).toEqual({
      type: "error",
      errorType: "server",
      content: "Respuesta vacía del servidor.",
    });
  });

  it("treats application/json responses as errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {},
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "unauthorized" }),
    });

    const events = await collect(streamAwsSse([], "deepseek"));
    expect((events[0] as { content: string }).content).toMatch(/sesión ha expirado/);
  });

  // ── SSE parsing ─────────────────────────────────────────────

  it("yields text events from SSE chunks", async () => {
    mockFetch.mockResolvedValueOnce(
      streamResponse([sse(json({ content: "Hola " })), sse(json({ content: "mundo" }))]),
    );

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events).toEqual([
      { type: "text", content: "Hola " },
      { type: "text", content: "mundo" },
      { type: "done", content: "" },
    ]);
  });

  it("handles the Lambda prefix (JSON headers + null bytes) before the first event", async () => {
    const prefixed =
      '{"headers":{"Content-Type":"text/event-stream"}}\u0000\u0000\u0000' +
      sse(json({ content: "EXITO" })) +
      sse(json({ content: "!!" }));
    mockFetch.mockResolvedValueOnce(streamResponse([prefixed]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events.map((e) => (e as { content: string }).content)).toEqual([
      "EXITO",
      "!!",
      "",
    ]);
  });

  it("keeps incomplete lines in the buffer across chunks", async () => {
    // Split point inside the JSON: chunk1 ends mid-object, chunk2 completes it
    const half1 = `data: ${'{"content":"par'}`;
    const half2 = `t2"}\n\ndata: ${json({ content: "done-part" })}\n\n`;
    mockFetch.mockResolvedValueOnce(streamResponse([half1, half2]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events.map((e) => (e as { content: string }).content)).toEqual([
      "part2",
      "done-part",
      "",
    ]);
  });

  it("yields done on [DONE]", async () => {
    mockFetch.mockResolvedValueOnce(streamResponse([sse("[DONE]")]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events).toEqual([{ type: "done", content: "" }]);
  });

  it("yields done when the stream closes without [DONE]", async () => {
    mockFetch.mockResolvedValueOnce(streamResponse([]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events).toEqual([{ type: "done", content: "" }]);
  });

  it("yields reasoning events", async () => {
    mockFetch.mockResolvedValueOnce(
      streamResponse([sse(json({ type: "reasoning", content: "pensando..." }))]),
    );

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events).toEqual([
      { type: "reasoning", content: "pensando..." },
      { type: "done", content: "" },
    ]);
  });

  it("yields an error for inline backend errors", async () => {
    mockFetch.mockResolvedValueOnce(
      streamResponse([sse(json({ type: "error", error: "quota_exceeded" }))]),
    );

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0]).toMatchObject({ type: "error", errorType: "server" });
  });

  it("blocks mcp_tool_request on the web runtime", async () => {
    mockFetch.mockResolvedValueOnce(
      streamResponse([
        sse(
          json({
            type: "mcp_tool_request",
            tool: "read_local_file",
            args: { path: "a.ts" },
            toolCallId: "tc-1",
          }),
        ),
        sse(json({ content: "continues..." })),
      ]),
    );

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0]).toEqual({
      type: "error",
      errorType: "server",
      content: "⚠️ El modelo intentó usar una herramienta no disponible en la web. Continuando con la respuesta...",
    });
    expect(events[1]).toEqual({ type: "text", content: "continues..." });
  });

  it("forwards mcp_tool_request on the Tauri runtime", async () => {
    (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    try {
      mockFetch.mockResolvedValueOnce(
        streamResponse([
          sse(
            json({
              type: "mcp_tool_request",
              tool: "write_local_file",
              args: { path: "b.ts" },
              toolCallId: "tc-2",
            }),
          ),
        ]),
      );

      const events = await collect(streamAwsSse([], "deepseek"));
      expect(events[0]).toEqual({
        type: "mcp_tool_request",
        content: "",
        tool: "write_local_file",
        args: { path: "b.ts" },
        toolCallId: "tc-2",
      });
    } finally {
      delete (globalThis as Record<string, unknown>).__TAURI_INTERNALS__;
    }
  });

  it("splits <think> blocks into reasoning/text events", async () => {
    const payload = `Antes<think>Razonamiento interno</think>Después`;
    mockFetch.mockResolvedValueOnce(streamResponse([sse(json({ content: payload }))]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events.map((e) => e.type)).toContain("reasoning");
    expect(events.map((e) => e.type)).toContain("text");
  });

  it("translates raw non-JSON error lines", async () => {
    mockFetch.mockResolvedValueOnce(
      streamResponse([`data: model output must contain reasoning error\n\n`]),
    );

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events).toEqual([
      {
        type: "error",
        errorType: "server",
        content: "El modelo respondió vacío. Intenta reformular tu mensaje o usa otro modelo.",
      },
    ]);
  });

  it("warns and skips raw non-JSON non-error lines", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockFetch.mockResolvedValueOnce(streamResponse([`data: hello not json\n\n`]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    // No events produced for the skipped chunk
    expect(events.length).toBe(1); // the final done event
  });

  it("skips empty data lines", async () => {
    mockFetch.mockResolvedValueOnce(streamResponse([`data: \n\n`]));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events).toEqual([{ type: "done", content: "" }]);
  });

  // ── runtime errors ──────────────────────────────────────────

  it("yields an abort error when the reader is aborted", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({ read: async () => { throw abortError; } }) },
      headers: new Headers({ "content-type": "text/event-stream" }),
    });

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0]).toMatchObject({ type: "error", errorType: "abort" });
  });

  it("yields a network error for failed fetches", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0]).toMatchObject({ type: "error", errorType: "network" });
  });

  it("yields a generic server error for unexpected exceptions", async () => {
    mockFetch.mockRejectedValueOnce(new Error("boom"));

    const events = await collect(streamAwsSse([], "deepseek"));
    expect(events[0]).toMatchObject({ type: "error", errorType: "server" });
    expect((events[0] as { content: string }).content).toContain("Error inesperado");
  });
});
