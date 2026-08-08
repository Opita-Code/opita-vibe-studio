/**
 * build-agent — runBuildAgent ReAct loop coverage.
 *
 * Cubre: loop completo con tools, errores consecutivos, delivery
 * strategies, modo interactivo con confirmación, nudges, roadmap
 * update por tools, y helpers internos (buildRoadmap via eventos).
 *
 * Ejecutar: npx vitest run src/agent/__tests__/build-agent.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Message } from "@/lib/types";
import type { AgentEvent } from "../types";
import { runBuildAgent, type BuildAgentConfig } from "../build-agent";
import { clearNudges, pushNudge } from "../nudge-channel";
import { useChatStore } from "@/stores/chat";
import type { RoadmapGoal } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────

const streamSSEMock = vi.hoisted(() => vi.fn());
const executeToolMock = vi.hoisted(() => vi.fn());
const getToolsMock = vi.hoisted(() => vi.fn());

vi.mock("../stream-client", () => ({ streamSSE: streamSSEMock }));
vi.mock("@/tools/executor", () => ({ executeTool: executeToolMock }));
vi.mock("@/stores/custom-tools", () => ({
  useCustomToolsStore: { getState: () => ({ getTools: getToolsMock }) },
}));

// ─── Helpers ────────────────────────────────────────────────────

const msgs: Message[] = [
  { id: "u1", role: "user", content: "crea un componente login", timestamp: 0 },
];

function config(overrides: Partial<BuildAgentConfig> = {}): BuildAgentConfig {
  return {
    providerId: "deepseek",
    executionMode: "auto",
    ...overrides,
  };
}

async function collectEvents(cfg: BuildAgentConfig = config()): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const e of runBuildAgent(msgs, cfg)) {
    events.push(e);
  }
  return events;
}

describe("runBuildAgent", () => {
  beforeEach(() => {
    streamSSEMock.mockReset();
    executeToolMock.mockReset();
    getToolsMock.mockReset().mockReturnValue([]);
    clearNudges();
    useChatStore.setState({
      researchStatus: null,
      pendingConfirmation: null,
      isStreaming: false,
    });
  });

  afterEach(() => clearNudges());

  it("fluye texto simple y termina con done", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "Analizando... " };
      yield { type: "text", content: "listo." };
      yield { type: "done" };
    });

    const events = await collectEvents();

    const texts = events.filter((e) => e.type === "text");
    expect(texts.length).toBeGreaterThanOrEqual(2);
    expect(events[0]).toMatchObject({ type: "phase", phase: "building" });
    expect(events.some((e) => e.type === "roadmap")).toBe(true);
    expect(events.some((e) => e.type === "thinking")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "done" });
    expect(streamSSEMock).toHaveBeenCalledTimes(1);
  });

  it("incluye addon de feature-branch en el system prompt", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "ok" };
      yield { type: "done" };
    });

    await collectEvents(config({ deliveryStrategy: "feature-branch" }));
    const systemMsg = streamSSEMock.mock.calls[0][0][0] as Message;
    expect(systemMsg.content).toContain("rama separada");
  });

  it("incluye addon de pr en el system prompt", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "ok" };
      yield { type: "done" };
    });

    await collectEvents(config({ deliveryStrategy: "pr" }));
    const systemMsg = streamSSEMock.mock.calls[0][0][0] as Message;
    expect(systemMsg.content).toContain("Pull Request");
  });

  it("ejecuta tool y retroalimenta resultado al LLM", async () => {
    executeToolMock.mockResolvedValue({
      name: "read_file",
      success: true,
      result: "[src/App.tsx — 1 líneas]\nexport default function App(){}",
    });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: "c1", args: { path: "src/App.tsx" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Listo." };
        yield { type: "done" };
      });

    const events = await collectEvents();

    expect(executeToolMock).toHaveBeenCalledTimes(1);
    expect(executeToolMock).toHaveBeenCalledWith({ name: "read_file", args: { path: "src/App.tsx" } });
    const steps = events.filter((e) => e.type === "step");
    expect(steps.length).toBeGreaterThanOrEqual(2);
    // read_file no es file action → no file_changed
    expect(events.some((e) => e.type === "file_changed")).toBe(false);
  });

  it("emite file_changed para write_file exitoso", async () => {
    executeToolMock.mockResolvedValue({
      name: "write_file",
      success: true,
      result: "Archivo 'Login.tsx' escrito.",
    });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "write_file", toolCallId: "c2", args: { path: "Login.tsx", content: "x" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Hecho." };
        yield { type: "done" };
      });

    const events = await collectEvents();
    const fileChanges = events.filter((e) => e.type === "file_changed");
    expect(fileChanges).toHaveLength(1);
    expect(fileChanges[0]).toMatchObject({ path: "Login.tsx", action: "created" });
  });

  it("step error con tool fallida (sin file_changed)", async () => {
    executeToolMock.mockResolvedValue({ name: "read_file", success: false, error: "no existe" });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: "c3", args: { path: "nope.ts" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "No encontré el archivo." };
        yield { type: "done" };
      });

    const events = await collectEvents();
    const errSteps = events.filter((e) => e.type === "step" && e.step.status === "error");
    expect(errSteps.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.type === "file_changed")).toBe(false);
  });

  it("aborta tras 3 errores consecutivos", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "error", content: "network down" };
      yield { type: "error", content: "network down" };
      yield { type: "error", content: "network down" };
      yield { type: "done" };
    });

    const events = await collectEvents();
    const errors = events.filter((e) => e.type === "error");
    expect(errors.length).toBeGreaterThanOrEqual(4); // 3 + "Demasiados errores"
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("procesa reasoning chunks como thinking_visible", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "reasoning", content: "primero leo el archivo" };
      yield { type: "text", content: "voy a ver." };
      yield { type: "done" };
    });

    const events = await collectEvents();
    const thinking = events.filter((e) => e.type === "thinking_visible");
    expect(thinking.length).toBeGreaterThanOrEqual(1);
  });

  it("inyecta nudges pendientes como contexto de usuario", async () => {
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });
    pushNudge("usa TypeScript estricto");
    pushNudge("agrega tests");

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "read_file", toolCallId: "c4", args: { path: "a.ts" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "final" };
        yield { type: "done" };
      });

    const events = await collectEvents();
    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents.some((t) => (t.content as string).includes("Ajustando según tu indicación"))).toBe(true);
    // El nudge llegó al segundo call de streamSSE
    const secondCall = streamSSEMock.mock.calls[1][0] as Message[];
    const nudgeMsg = secondCall.find((m) => m.content.includes("Orientación del usuario"));
    expect(nudgeMsg).toBeDefined();
    expect(nudgeMsg!.content).toContain("TypeScript estricto");
  });

  it("modo interactivo: espera confirmación y cancela si el usuario la rechaza", async () => {
    // La pausa interactiva solo ocurre si la primera iteración pidió un tool
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });
    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Plan propuesto: crear Login." };
        yield { type: "tool_request", tool: "read_file", toolCallId: "c10", args: { path: "a.ts" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Hecho." };
        yield { type: "done" };
      });
    // pendingConfirmation distinto de null + isStreaming false → cancelado
    useChatStore.setState({ pendingConfirmation: { phase: "thinking", plan: "plan" }, isStreaming: false });

    const events = await collectEvents(config({ executionMode: "interactive" }));
    const conf = events.filter((e) => e.type === "await_confirmation");
    expect(conf.length).toBeGreaterThanOrEqual(1);
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("modo interactivo: confirma y continúa al siguiente loop", async () => {
    // Primera iteración: texto + tool → pausa → confirma
    // Segunda iteración: texto final
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });
    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Plan propuesto." };
        yield { type: "tool_request", tool: "read_file", toolCallId: "c11", args: { path: "a.ts" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Cambios aplicados." };
        yield { type: "done" };
      });

    // pendingConfirmation null → confirmado
    useChatStore.setState({ pendingConfirmation: null, isStreaming: true });

    const events = await collectEvents(config({ executionMode: "interactive" }));
    const conf = events.filter((e) => e.type === "await_confirmation");
    expect(conf.length).toBeGreaterThanOrEqual(1);
    expect(streamSSEMock).toHaveBeenCalledTimes(2);
  });

  it("modo interactivo respeta abort signal durante espera", async () => {
    const ac = new AbortController();
    executeToolMock.mockResolvedValue({ name: "read_file", success: true, result: "x" });
    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "Plan propuesto." };
        yield { type: "tool_request", tool: "read_file", toolCallId: "c12", args: { path: "a.ts" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "ok" };
        yield { type: "done" };
      });
    useChatStore.setState({ pendingConfirmation: { phase: "x", plan: "y" }, isStreaming: true });

    ac.abort();
    const events = await collectEvents(config({ executionMode: "interactive", signal: ac.signal }));
    expect(events.at(-1)).toMatchObject({ type: "done" });
  });

  it("roadmap con useTDD y deliveryStrategy incluye steps extra", async () => {
    streamSSEMock.mockImplementation(async function* () {
      yield { type: "text", content: "ok" };
      yield { type: "done" };
    });

    await collectEvents(config({ useTDD: true, deliveryStrategy: "pr" }));
    // Primer evento emitido es phase, luego roadmap — verificar via second call
    const roadmapEvents: AgentEvent[] = [];
    for await (const e of runBuildAgent(msgs, config({ useTDD: true, deliveryStrategy: "pr" }))) {
      roadmapEvents.push(e);
    }
    const roadmap = roadmapEvents.find((e) => e.type === "roadmap") as { type: "roadmap"; goals: RoadmapGoal[] } | undefined;
    const ids = roadmap?.goals.map((g) => g.id) ?? [];
    expect(ids).toContain("verify");
    expect(ids).toContain("deliver");
  });

  it("marca research status para tools OSINT", async () => {
    const setResearchStatusSpy = vi.spyOn(useChatStore.getState(), "setResearchStatus");
    executeToolMock.mockResolvedValue({ name: "docs_search", success: true, result: "x" });

    streamSSEMock
      .mockImplementationOnce(async function* () {
        yield { type: "tool_request", tool: "docs_search", toolCallId: "c5", args: { query: "react" } };
        yield { type: "done" };
      })
      .mockImplementationOnce(async function* () {
        yield { type: "text", content: "ok" };
        yield { type: "done" };
      });

    await collectEvents();
    expect(setResearchStatusSpy).toHaveBeenCalledWith("searching");
    expect(setResearchStatusSpy).toHaveBeenCalledWith(null);
    setResearchStatusSpy.mockRestore();
  });
});
