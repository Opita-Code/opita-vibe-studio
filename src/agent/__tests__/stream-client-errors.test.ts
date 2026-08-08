/**
 * stream-client — error paths + edge chunks coverage.
 *
 * Complementa stream-client.test.ts: cubre 429, JSON error body,
 * sin body, parsed.error, reasoning, [DONE], malformed JSON,
 * translateRawError, think blocks, y errores de fetch/abort.
 *
 * Ejecutar: npx vitest run src/agent/__tests__/stream-client-errors.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamSSE } from "../stream-client";
import type { SSEChunk } from "../types";

const enc = new TextEncoder();

function sseResponse(stream: string, contentType = "text/event-stream"): Response {
  return new Response(
    new ReadableStream({
      start(c) { c.enqueue(enc.encode(stream)); c.close(); },
    }),
    { status: 200, headers: { "Content-Type": contentType } },
  );
}

async function collect(stream: string | Response, opts: { contentType?: string } = {}) {
  let mockFetch: ReturnType<typeof vi.fn>;
  const original = globalThis.fetch;
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  try {
    mockFetch.mockResolvedValue(
      typeof stream === "string" ? sseResponse(stream, opts.contentType) : stream,
    );
    const out: SSEChunk[] = [];
    for await (const c of streamSSE(
      [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
      { providerId: "deepseek" },
    )) {
      out.push(c);
    }
    return out;
  } finally {
    globalThis.fetch = original;
  }
}

describe("streamSSE — error paths", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("429 → error de límite", async () => {
    const resp = new Response("", { status: 429 });
    const out = await collect(resp);
    const errors = out.filter((c) => c.type === "error");
    expect(errors.length).toBe(1);
    expect(errors[0].content).toContain("Límite");
  });

  it("HTTP error genérico con body JSON → translateBackendError", async () => {
    const resp = new Response(JSON.stringify({ error: "quota_exceeded" }), { status: 500 });
    const out = await collect(resp);
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("límite de uso");
  });

  it("HTTP error con code técnico → usa message del servidor", async () => {
    const resp = new Response(JSON.stringify({ error: "internal_error", message: "boom" }), { status: 500 });
    const out = await collect(resp);
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("boom");
  });

  it("HTTP error con code técnico sin message → mensaje genérico", async () => {
    const resp = new Response(JSON.stringify({ error: "internal_error" }), { status: 500 });
    const out = await collect(resp);
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("Error del servidor");
  });

  it("HTTP error sin body parseable → raw code", async () => {
    const resp = new Response("", { status: 502 });
    const out = await collect(resp);
    const errors = out.filter((c) => c.type === "error");
    expect(errors.length).toBe(1);
  });

  it("sin response.body → error de respuesta vacía", async () => {
    const resp = new Response(null, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    const out = await collect(resp);
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("Respuesta vacía");
  });

  it("content-type JSON con error → translateBackendError", async () => {
    const out = await collect(
      JSON.stringify({ error: "upgrade_required", message: "necesitas pro" }),
      { contentType: "application/json" },
    );
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("UPGRADE_REQUIRED");
  });

  it("parsed.error del backend → error traducido y corta", async () => {
    const out = await collect('data: {"error":"rate_limited"}\n\n');
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("Demasiadas solicitudes");
    expect(out.some((c) => c.type === "done")).toBe(false);
  });

  it("chunk reasoning explícito del backend", async () => {
    const out = await collect('data: {"type":"reasoning","content":"pienso"}\n\ndata: [DONE]\n\n');
    const reasoning = out.filter((c) => c.type === "reasoning");
    expect(reasoning.length).toBe(1);
    expect(reasoning[0].content).toBe("pienso");
  });

  it("[DONE] en línea propia termina", async () => {
    const out = await collect('data: {"content":"hola"}\n\ndata: [DONE]\n\n');
    expect(out.some((c) => c.type === "done")).toBe(true);
  });

  it("JSON malformado sin 'error' → se salta (silencioso)", async () => {
    const out = await collect('data: not-json\n\ndata: {"content":"ok"}\n\ndata: [DONE]\n\n');
    const texts = out.filter((c) => c.type === "text").map((c) => c.content).join("");
    expect(texts).toBe("ok");
  });

  it("JSON malformado con 'error' → translateRawError", async () => {
    const out = await collect('data: something error happened\n\n');
    const errors = out.filter((c) => c.type === "error");
    expect(errors.length).toBe(1);
  });

  it("translateRawError: context length → mensaje largo", async () => {
    // data NO-json con "error" → translateRawError
    const out = await collect('data: error request too long for context\n\n');
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("demasiado largo");
  });

  it("translateRawError: invalid key", async () => {
    const out = await collect('data: error invalid api key\n\n');
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("clave de API es inválida");
  });

  it("translateRawError: timeout", async () => {
    const out = await collect('data: error request timeout\n\n');
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("tardó demasiado");
  });

  it("translateRawError: modelo vacío", async () => {
    const out = await collect('data: error model output must contain a response\n\n');
    const errors = out.filter((c) => c.type === "error");
    expect(errors[0].content).toContain("respondió vacío");
  });

  it("procesa bloques <think> dentro de content", async () => {
    const out = await collect('data: {"content":"antes <think>razón</think> después"}\n\ndata: [DONE]\n\n');
    const reasoning = out.filter((c) => c.type === "reasoning").map((c) => c.content).join("");
    const texts = out.filter((c) => c.type === "text").map((c) => c.content).join("");
    expect(reasoning).toContain("razón");
    expect(texts).toContain("antes");
    expect(texts).toContain("después");
  });

  it("envía Authorization solo con JWT real (no placeholder)", async () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      mockFetch.mockResolvedValue(sseResponse('data: [DONE]\n\n'));
      const { useAuthStore } = await import("@/stores/auth");
      useAuthStore.setState({ session: { token: "real.jwt.token", expiresAt: 0 } });
      for await (const _c of streamSSE(
        [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
        { providerId: "deepseek" },
      )) { /* drain */ }
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["Authorization"]).toBe("Bearer real.jwt.token");
      useAuthStore.setState({ session: null });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("abort → error de cancelación", async () => {
    const ac = new AbortController();
    const original = globalThis.fetch;
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      mockFetch.mockImplementation((_url: string, _init?: RequestInit) => {
        const err = new Error("aborted") as Error & { name: string };
        err.name = "AbortError";
        return Promise.reject(err);
      });
      const out: SSEChunk[] = [];
      for await (const c of streamSSE(
        [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
        { providerId: "deepseek", signal: ac.signal },
      )) {
        out.push(c);
      }
      const errors = out.filter((c) => c.type === "error");
      expect(errors[0].content).toContain("Generación cancelada");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("Failed to fetch → error de conexión", async () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
      const out: SSEChunk[] = [];
      for await (const c of streamSSE(
        [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
        { providerId: "deepseek" },
      )) {
        out.push(c);
      }
      const errors = out.filter((c) => c.type === "error");
      expect(errors[0].content).toContain("No se pudo conectar");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("error inesperado → mensaje genérico", async () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      mockFetch.mockRejectedValue(new Error("random boom"));
      const out: SSEChunk[] = [];
      for await (const c of streamSSE(
        [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
        { providerId: "deepseek" },
      )) {
        out.push(c);
      }
      const errors = out.filter((c) => c.type === "error");
      expect(errors[0].content).toContain("Error inesperado");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("envía customTools cuando hay", async () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    try {
      mockFetch.mockResolvedValue(sseResponse('data: [DONE]\n\n'));
      for await (const _c of streamSSE(
        [{ id: "u1", role: "user", content: "x", timestamp: 0 }],
        { providerId: "deepseek", customTools: [{ name: "my_tool", description: "d", parameters: {} }] },
      )) { /* drain */ }
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.customTools).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
