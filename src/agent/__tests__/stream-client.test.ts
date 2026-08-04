/**
 * StreamClient — regression tests.
 *
 * Cubre el bug crítico del primer token perdido: la Lambda Function URL
 * antepone `{"headers":{...}}` + null bytes PEGADO al primer evento SSE,
 * y el parser descartaba esa línea completa ("EXITO" → "ITO").
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamSSE } from "../stream-client";
import type { SSEChunk } from "../types";

// ─── Helpers ────────────────────────────────────────────────────

function makeReadableStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

/** Emula la respuesta real de Lambda Function URL: prefix + null bytes + SSE. */
function lambdaFunctionUrlResponse(chunks: Uint8Array[]): Response {
  const headers = new Headers({ "Content-Type": "text/event-stream" });
  return new Response(makeReadableStream(chunks), { status: 200, headers });
}

async function collectSSE(): Promise<SSEChunk[]> {
  const out: SSEChunk[] = [];
  const generator = streamSSE(
    [{ id: "u1", role: "user", content: "di EXITO", timestamp: 0 }],
    { providerId: "deepseek", modelId: "deepseek-v4-flash" },
  );
  for await (const chunk of generator) {
    out.push(chunk);
  }
  return out;
}

const enc = new TextEncoder();

// ─── Tests ──────────────────────────────────────────────────────

describe("streamSSE — primer token (bug Lambda Function URL)", () => {
  let originalFetch: typeof fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("no pierde el primer token cuando el prefix viene pegado (caso real)", async () => {
    // Simula el stream exacto de prod: prefix JSON + 8 null bytes + primer data.
    // Este chunk llega TODO en una sola línea del primer read().
    const prefix =
      '{"headers":{"Content-Type":"text/event-stream"}}\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000';
    const firstChunk = prefix + 'data: {"content":"EX"}\n\n';
    const secondChunk = 'data: {"content":"ITO"}\n\ndata: [DONE]\n\n';

    mockFetch.mockResolvedValue(
      lambdaFunctionUrlResponse([enc.encode(firstChunk), enc.encode(secondChunk)]),
    );

    const out = await collectSSE();

    const textParts = out
      .filter((c): c is Extract<SSEChunk, { type: "text" }> => c.type === "text")
      .map((c) => c.content)
      .join("");

    expect(textParts).toBe("EXITO");
    expect(out.some((c) => c.type === "done")).toBe(true);
  });

  it("mantiene tokens cuando el prefix llega en un chunk separado", async () => {
    const prefixChunk = '{"headers":{"Content-Type":"text/event-stream"}}\u0000\u0000';
    const dataChunk = 'data: {"content":"HOLA"}\n\ndata: [DONE]\n\n';

    mockFetch.mockResolvedValue(
      lambdaFunctionUrlResponse([enc.encode(prefixChunk), enc.encode(dataChunk)]),
    );

    const out = await collectSSE();

    const textParts = out
      .filter((c): c is Extract<SSEChunk, { type: "text" }> => c.type === "text")
      .map((c) => c.content)
      .join("");

    expect(textParts).toBe("HOLA");
  });

  it("descarta líneas basura sin romper el stream", async () => {
    const stream =
      '{"headers":{"Content-Type":"text/event-stream"}}\u0000\u0000\u0000\u0000' +
      'data: {"content":"A"}\n\n' +
      'garbage line\n\n' +
      'data: {"content":"B"}\n\ndata: [DONE]\n\n';

    mockFetch.mockResolvedValue(lambdaFunctionUrlResponse([enc.encode(stream)]));

    const out = await collectSSE();

    const textParts = out
      .filter((c): c is Extract<SSEChunk, { type: "text" }> => c.type === "text")
      .map((c) => c.content)
      .join("");

    expect(textParts).toBe("AB");
  });

  it("mcp_tool_request en web: warning + stream continúa (no corta)", async () => {
    // Sin __TAURI_INTERNALS__ → contexto web.
    // @ts-expect-error — forzar entorno web
    delete globalThis.__TAURI_INTERNALS__;

    const stream =
      '{"headers":{"Content-Type":"text/event-stream"}}\u0000\u0000\u0000\u0000' +
      'data: {"type":"mcp_tool_request","tool":"list_files","toolCallId":"call_1","args":{}}\n\n' +
      'data: {"content":"respuesta final"}\n\ndata: [DONE]\n\n';

    mockFetch.mockResolvedValue(lambdaFunctionUrlResponse([enc.encode(stream)]));

    const out = await collectSSE();

    const errors = out.filter((c) => c.type === "error");
    const texts = out
      .filter((c): c is Extract<SSEChunk, { type: "text" }> => c.type === "text")
      .map((c) => c.content)
      .join("");

    // Debe emitir warning y CONTINUAR con la respuesta del modelo.
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].content).toContain("no disponible en la web");
    expect(texts).toBe("respuesta final");
    expect(out.some((c) => c.type === "done")).toBe(true);
  });

  it("mcp_tool_request en Tauri: emite tool_request normal", async () => {
    // Simular entorno Tauri.
    // @ts-expect-error — forzar entorno tauri
    globalThis.__TAURI_INTERNALS__ = {};

    const stream =
      '{"headers":{"Content-Type":"text/event-stream"}}\u0000\u0000\u0000\u0000' +
      'data: {"type":"mcp_tool_request","tool":"read_file","toolCallId":"call_2","args":{"path":"a.ts"}}\n\n' +
      'data: {"content":"ok"}\n\ndata: [DONE]\n\n';

    mockFetch.mockResolvedValue(lambdaFunctionUrlResponse([enc.encode(stream)]));

    const out = await collectSSE();

    const toolRequests = out.filter((c) => c.type === "tool_request");
    expect(toolRequests.length).toBe(1);
    expect(toolRequests[0].tool).toBe("read_file");
  });
});
