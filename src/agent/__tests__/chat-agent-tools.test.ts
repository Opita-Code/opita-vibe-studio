/**
 * Tests para el ReAct loop ligero del chat-agent.
 *
 * Verifica que:
 * 1. Un stream sin tool_requests fluye texto normal.
 * 2. Un tool_request se ejecuta y el resultado se retroalimenta (toolMessages).
 * 3. Múltiples tools encadenadas funcionan.
 * 4. Errores de tool no bloquean el stream (se muestran como step error).
 *
 * Ejecutar: npx vitest run src/agent/__tests__/chat-agent-tools.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";
import type { SSEChunk } from "../types";
import { runChatAgent } from "../chat-agent";

// ─── Mocks ──────────────────────────────────────────────────────

const streamSSEMock = vi.hoisted(() => vi.fn());
const executeToolMock = vi.hoisted(() => vi.fn());

vi.mock("../stream-client", () => ({
  streamSSE: streamSSEMock,
}));

vi.mock("@/tools/executor", () => ({
  executeTool: executeToolMock,
}));

// ─── Helpers ────────────────────────────────────────────────────

const msgs: Message[] = [
  { id: "u1", role: "user", content: "muéstrame cómo se vería", timestamp: 0 },
];

function config(overrides: Record<string, unknown> = {}) {
  return {
    intent: "chat" as const,
    providerId: "deepseek",
    ...overrides,
  };
}

async function collectEvents(chunks: SSEChunk[]) {
  streamSSEMock.mockImplementation(async function* () {
    for (const c of chunks) yield c;
  });
  const events: { type: string; [k: string]: unknown }[] = [];
  for await (const e of runChatAgent(msgs, config())) {
    events.push(e as unknown as { type: string });
  }
  return events;
}

// ─── Suite ──────────────────────────────────────────────────────

describe("runChatAgent ReAct loop", () => {
  beforeEach(() => {
    streamSSEMock.mockReset();
    executeToolMock.mockReset();
  });

  it("fluye texto normal cuando no hay tool_requests", async () => {
    const events = await collectEvents([
      { type: "text", content: "Hola! " },
      { type: "text", content: "¿en qué te ayudo?" },
      { type: "done" },
    ]);

    const texts = events.filter((e) => e.type === "text");
    expect(texts).toHaveLength(2);
    expect(events.at(-1)?.type).toBe("done");
    // Sin tool_requests → no steps
    expect(events.some((e) => e.type === "step")).toBe(false);
    // streamSSE llamado UNA vez (sin loop extra)
    expect(streamSSEMock).toHaveBeenCalledTimes(1);
  });

  it("ejecuta tool_request y retroalimenta el resultado al LLM", async () => {
    executeToolMock.mockResolvedValue({
      name: "read_file",
      success: true,
      result: "[src/App.tsx — 1 líneas]\nexport default function App(){}",
    });

    // Iteración 1: LLM pide read_file → tool se ejecuta
    // Iteración 2: LLM responde texto final
    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield {
          type: "tool_request",
          tool: "read_file",
          toolCallId: "call_1",
          args: { path: "src/App.tsx" },
        };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Ya vi tu App.tsx." };
        yield { type: "done" };
      });

    const events = await collectEvents([]);

    // Step del tool emitido
    const steps = events.filter((e) => e.type === "step");
    expect(steps.length).toBeGreaterThanOrEqual(2); // running + done

    // El tool se ejecutó una vez
    expect(executeToolMock).toHaveBeenCalledTimes(1);
    expect(executeToolMock).toHaveBeenCalledWith({
      name: "read_file",
      args: { path: "src/App.tsx" },
    });

    // Segunda iteración: el toolMessages incluye tool_use + tool_result
    const secondCallArgs = streamSSEMock.mock.calls[1][0] as Message[];
    const toolMsgs = secondCallArgs.filter((m) => m.content.includes("<tool_"));
    expect(toolMsgs.length).toBe(2);
    expect(toolMsgs[0].content).toContain('name="read_file"');
    expect(toolMsgs[1].content).toContain("App.tsx");

    // Texto final llega al usuario
    const texts = events.filter((e) => e.type === "text");
    expect(texts.some((t) => (t.content as string).includes("Ya vi"))).toBe(true);
  });

  it("errores de tool se muestran como step error y continúan", async () => {
    executeToolMock.mockResolvedValue({
      name: "read_file",
      success: false,
      error: "Archivo no encontrado",
    });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield {
          type: "tool_request",
          tool: "read_file",
          toolCallId: "call_x",
          args: { path: "no-existe.ts" },
        };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "No encontré ese archivo." };
        yield { type: "done" };
      });

    const events = await collectEvents([]);

    // Step con status error
    const errorSteps = events.filter(
      (e) => e.type === "step" && (e as { step?: { status?: string } }).step?.status === "error",
    );
    expect(errorSteps.length).toBeGreaterThanOrEqual(1);
    // file_changed NO se emite para tools fallidas
    expect(events.some((e) => e.type === "file_changed")).toBe(false);
  });

  it("encadena múltiples tools en iteraciones sucesivas", async () => {
    executeToolMock
      .mockResolvedValueOnce({ name: "read_file", success: true, result: "content" })
      .mockResolvedValueOnce({ name: "refresh_preview", success: true, result: "Preview actualizado." });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: "c1", args: { path: "a.ts" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "refresh_preview", toolCallId: "c2", args: {} };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Listo." };
        yield { type: "done" };
      });

    const events = await collectEvents([]);

    expect(executeToolMock).toHaveBeenCalledTimes(2);
    expect(executeToolMock).toHaveBeenNthCalledWith(1, { name: "read_file", args: { path: "a.ts" } });
    expect(executeToolMock).toHaveBeenNthCalledWith(2, { name: "refresh_preview", args: {} });
    expect(streamSSEMock).toHaveBeenCalledTimes(3);
    expect(events.some((e) => e.type === "file_changed")).toBe(false);
  });

  it("corta el loop cuando el LLM no pide más tools", async () => {
    streamSSEMock.mockImplementationOnce(async function* () {
      yield { type: "text", content: "respuesta única" };
      yield { type: "done" };
    });

    const events = await collectEvents([]);

    expect(streamSSEMock).toHaveBeenCalledTimes(1); // sin loop extra
    expect(events.at(-1)?.type).toBe("done");
  });
});
