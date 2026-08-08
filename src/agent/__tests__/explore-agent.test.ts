/**
 * explore-agent — runExploreAgent ReAct loop coverage.
 *
 * Cubre: flujo de texto, tools con research status, errores
 * consecutivos, abort signal, sliding window, y terminación.
 *
 * Ejecutar: npx vitest run src/agent/__tests__/explore-agent.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";
import type { AgentEvent } from "../types";
import { runExploreAgent, type ExploreAgentConfig } from "../explore-agent";
import { useChatStore } from "@/stores/chat";

const streamSSEMock = vi.hoisted(() => vi.fn());
const executeToolMock = vi.hoisted(() => vi.fn());

vi.mock("../stream-client", () => ({ streamSSE: streamSSEMock }));
vi.mock("@/tools/executor", () => ({ executeTool: executeToolMock }));

const msgs: Message[] = [
  { id: "u1", role: "user", content: "explícame la autenticación", timestamp: 0 },
];

function config(overrides: Partial<ExploreAgentConfig> = {}): ExploreAgentConfig {
  return { providerId: "deepseek", ...overrides };
}

async function collectEvents(cfg: ExploreAgentConfig = config()): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of runExploreAgent(msgs, cfg)) {
    events.push(e);
  }
  return events;
}

describe("runExploreAgent", () => {
  beforeEach(() => {
    streamSSEMock.mockReset();
    executeToolMock.mockReset();
    useChatStore.setState({ researchStatus: null });
  });

  it("fluye texto simple y termina", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "La auth usa OCAIS. " };
      yield { type: "text", content: "Es RS256." };
      yield { type: "done" };
    });

    const events = await collectEvents();
    expect(events[0]).toMatchObject({ type: "phase", phase: "thinking" });
    expect(events.some((e) => e.type === "thinking")).toBe(true);
    const texts = events.filter((e) => e.type === "text");
    expect(texts.length).toBe(2);
    expect(events.at(-1)).toMatchObject({ type: "done", summary: [] });
    expect(streamSSEMock).toHaveBeenCalledTimes(1);
  });

  it("ejecuta tool con research status y feedback", async () => {
    executeToolMock.mockResolvedValue({ name: "docs_search", success: true, result: "resultados" });
    const setResearchStatusSpy = vi.spyOn(useChatStore.getState(), "setResearchStatus");

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "docs_search", toolCallId: "c1", args: { query: "react" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Encontré docs." };
        yield { type: "done" };
      });

    const events = await collectEvents();
    expect(executeToolMock).toHaveBeenCalledTimes(1);
    expect(executeToolMock).toHaveBeenCalledWith({ name: "docs_search", args: { query: "react" } });
    expect(setResearchStatusSpy).toHaveBeenCalledWith("searching");
    expect(setResearchStatusSpy).toHaveBeenCalledWith(null);
    const steps = events.filter((e) => e.type === "step");
    expect(steps.length).toBeGreaterThanOrEqual(2);

    const secondCall = streamSSEMock.mock.calls[1][0] as Message[];
    expect(secondCall.some((m) => m.content.includes("docs_search"))).toBe(true);
    setResearchStatusSpy.mockRestore();
  });

  it("tool fallida → step error y continúa", async () => {
    executeToolMock.mockResolvedValue({ name: "cve_check", success: false, error: "OSV down" });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "cve_check", toolCallId: "c2", args: { package: "lodash" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "No pude verificar." };
        yield { type: "done" };
      });

    const events = await collectEvents();
    const errSteps = events.filter(
      (e): e is Extract<AgentEvent, { type: "step" }> => e.type === "step" && e.step.status === "error",
    );
    expect(errSteps.length).toBeGreaterThanOrEqual(1);
  });

  it("emite thinking_visible para reasoning", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "reasoning", content: "déjame pensar" };
      yield { type: "done" };
    });

    const events = await collectEvents();
    expect(events.some((e) => e.type === "thinking_visible")).toBe(true);
  });

  it("rompe tras MAX_CONSECUTIVE_ERRORS", async () => {
    executeToolMock.mockResolvedValue({ name: "read_file", success: false, error: "x" });

    // 3 iteraciones con tool fallida
    for (let i = 0; i < 3; i++) {
      streamSSEMock.mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: `c${i}`, args: { path: "a.ts" } };
        yield { type: "done" };
      });
    }
    streamSSEMock.mockImplementationOnce(async function* () {
      yield { type: "text", content: "nunca llega" };
      yield { type: "done" };
    });

    const events = await collectEvents();
    const errors = events.filter((e) => e.type === "error");
    expect(errors.some((e) => (e.message as string).includes("Demasiados errores"))).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("respeta abort signal entre iteraciones", async () => {
    const ac = new AbortController();
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: "c5", args: { path: "a.ts" } };
        yield { type: "done" };
      })
      .mockImplementation(async function* () {
        yield { type: "text", content: "después" };
        yield { type: "done" };
      });

    ac.abort();
    const events = await collectEvents(config({ signal: ac.signal }));
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("sliding window recorta toolMessages", async () => {
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });

    // Simular 15 iteraciones de tools para sobrepasar MAX_TOOL_MESSAGES=12
    for (let i = 0; i < 14; i++) {
      streamSSEMock.mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: `sw${i}`, args: { path: "a.ts" } };
        yield { type: "done" };
      });
    }
    streamSSEMock.mockImplementationOnce(async function* () {
      yield { type: "text", content: "fin" };
      yield { type: "done" };
    });

    const events = await collectEvents();
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("incluye addon de investigación en system prompt", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "ok" };
      yield { type: "done" };
    });

    await collectEvents();
    const systemMsg = streamSSEMock.mock.calls[0][0][0] as Message;
    expect(systemMsg.content).toContain("Modo investigación profunda");
  });
});
