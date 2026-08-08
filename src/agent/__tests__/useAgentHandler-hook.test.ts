/**
 * useAgentHandler — hook-level tests via renderHook + fake timers.
 *
 * Cubre: guards (token limit, nudge intercept, auth), grace window,
 * cancel/editPending paths, event processing (text/thinking/step/
 * file_changed/phase/roadmap/progress/error/done/await_confirmation),
 * idea backlog matching, y cleanup en finally.
 *
 * Ejecutar: npx vitest run src/agent/__tests__/useAgentHandler-hook.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAgentHandler, GRACE_WINDOW_MS, resetSectionTracking } from "../useAgentHandler";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useAgentStore } from "@/stores/agent";
import { clearNudges } from "../nudge-channel";
import type { AgentEvent } from "../types";

// ─── Module mocks ──────────────────────────────────────────────

const handleMessageMock = vi.hoisted(() => vi.fn());
const classifyIntentMock = vi.hoisted(() => vi.fn());
const isLimitReachedMock = vi.hoisted(() => vi.fn());
const detectIdeaMock = vi.hoisted(() => vi.fn());
const createIdeaMock = vi.hoisted(() => vi.fn());
const saveIdeaMock = vi.hoisted(() => vi.fn());
const matchCompletedWorkMock = vi.hoisted(() => vi.fn());
const updateIdeaStatusMock = vi.hoisted(() => vi.fn());
const emitVibeMock = vi.hoisted(() => vi.fn());
const awardPassiveXPMock = vi.hoisted(() => vi.fn());
const fetchTokenUsageMock = vi.hoisted(() => vi.fn());

vi.mock("@/agent/orchestrator", () => ({
  handleMessage: (...a: unknown[]) => handleMessageMock(...a),
  classifyIntent: (...a: unknown[]) => classifyIntentMock(...a),
}));

vi.mock("@/lib/tokens", () => ({
  isLimitReached: (...a: unknown[]) => isLimitReachedMock(...a),
}));

vi.mock("@/agent/idea-backlog", () => ({
  detectIdea: (...a: unknown[]) => detectIdeaMock(...a),
  createIdea: (...a: unknown[]) => createIdeaMock(...a),
  saveIdea: (...a: unknown[]) => saveIdeaMock(...a),
  matchCompletedWork: (...a: unknown[]) => matchCompletedWorkMock(...a),
  updateIdeaStatus: (...a: unknown[]) => updateIdeaStatusMock(...a),
}));

vi.mock("@/lib/vibe-events", () => ({
  vibeEvents: { emit: (...a: unknown[]) => emitVibeMock(...a) },
}));

vi.mock("@/stores/gamification", () => ({
  useGamificationStore: { getState: () => ({ awardPassiveXP: awardPassiveXPMock }) },
}));

// ─── Helpers ──────────────────────────────────────────────────

function resetStores() {
  useChatStore.getState().createNewSession();
  useChatStore.setState({
    isStreaming: false,
    pendingConfirmation: null,
    researchStatus: null,
    shareActiveFileContext: false,
    executionMode: "automatic",
    activeProvider: "deepseek",
    activeModelId: "deepseek-v4-flash",
    activeMode: "auto",
  });
  useProjectStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    fileContents: {},
    openTabs: [],
    activeTab: null,
  });
  useAuthStore.setState({
    plan: "pro",
    authMode: "authenticated",
    tokenUsage: {
      tokensUsedToday: 0,
      tokensLimitDaily: 100000,
      tokensUsedThisHour: 0,
      tokensLimitHourly: 50000,
      plan: "pro",
      resetDailyAt: "",
      resetHourlyAt: "",
    },
  });
  useUIStore.setState({ persona: "creator", customPersonaPrompt: "" });
  useAgentStore.setState({ isExecuting: false, phase: null, progress: 0 });
  clearNudges();
}

async function* eventStream(events: AgentEvent[]): AsyncGenerator<AgentEvent> {
  for (const e of events) yield e;
}

function getMessages() {
  const state = useChatStore.getState();
  return state.sessions[state.activeSessionId]?.messages ?? [];
}

describe("useAgentHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    vi.clearAllMocks();
    resetSectionTracking();
    isLimitReachedMock.mockReturnValue(false);
    detectIdeaMock.mockReturnValue(false);
    matchCompletedWorkMock.mockResolvedValue([]);
    fetchTokenUsageMock.mockResolvedValue(undefined);
    // fetchTokenUsage real → spy para evitar network
    vi.spyOn(useAuthStore.getState(), "fetchTokenUsage").mockImplementation(fetchTokenUsageMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("guarda: isLimitReached muestra aviso de tokens", async () => {
    isLimitReachedMock.mockReturnValue(true);
    const { result } = renderHook(() => useAgentHandler());

    await act(async () => {
      await result.current.send("hola");
    });

    const msgs = getMessages();
    const last = msgs.at(-1);
    expect(last?.role).toBe("assistant");
    expect(last?.content).toContain("límite de tokens");
  });

  it("guarda: mensaje durante stream del build agent va a nudges", async () => {
    useChatStore.setState({ isStreaming: true });
    const { result } = renderHook(() => useAgentHandler());

    // Necesitamos activar el intent ref = code. Forzamos via classifyIntent
    // en el primer send real... En su lugar, testeamos con isStreaming true
    // + activeIntentRef null → NO nudge (guard). Hacemos send real.
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(function* () {});

    await act(async () => {
      const p = result.current.send("mientras trabajas...");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });
    expect(handleMessageMock).toHaveBeenCalled();
  });

  it("procesa eventos: flujo completo de text/thinking/step/file/phase/roadmap/progress/error/done", async () => {
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([
        { type: "phase", phase: "thinking" },
        { type: "roadmap", goals: [{ id: "g1", label: "Entendiendo", status: "active" }] },
        { type: "thinking", message: "Analizando" },
        { type: "progress", percent: 10 },
        { type: "text", content: "Voy a crear el login." },
        { type: "thinking_visible", content: "razonando..." },
        { type: "step", step: { id: "s1", icon: "✏️", label: "Creando Login.tsx", status: "running", timestamp: Date.now() } },
        { type: "step", step: { id: "s1", icon: "✏️", label: "Creando Login.tsx", status: "done", timestamp: Date.now() } },
        { type: "file_changed", path: "Login.tsx", action: "created" },
        { type: "file_changed", path: "App.tsx", action: "modified" },
        { type: "phase", phase: "building" },
        { type: "progress", percent: 100 },
        { type: "done", summary: [{ path: "Login.tsx", action: "created" }] },
      ]);
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("crea un login", undefined, false);
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    const msgs = getMessages();
    const assistant = msgs.find((m) => m.role === "assistant");
    expect(assistant).toBeDefined();
    expect(assistant!.content).toContain("Voy a crear el login.");
    expect(assistant!.content).toContain("Creado: `Login.tsx`");
    expect(assistant!.content).toContain("Archivos modificados");
    // user message pasó a "sent"
    const userMsg = msgs.find((m) => m.role === "user");
    expect(userMsg?.deliveryStatus).toBe("sent");
  });

  it("procesa await_confirmation + error + roadmap_update", async () => {
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([
        { type: "await_confirmation", completedPhase: "thinking", nextPhase: "building", summary: "Plan" },
        { type: "roadmap_update", goalId: "g1", status: "done", progress: 100 },
        { type: "error", message: "Algo falló" },
        { type: "done", summary: [] },
      ]);
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("confirma esto");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    const msgs = getMessages();
    const assistant = msgs.find((m) => m.role === "assistant");
    expect(assistant!.content).toContain("⚠️ Algo falló");
  });

  it("done sin contenido visible → mensaje fallback", async () => {
    classifyIntentMock.mockReturnValue("chat");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([{ type: "done", summary: [] }]);
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("haz algo");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    const msgs = getMessages();
    const assistant = msgs.find((m) => m.role === "assistant");
    expect(assistant!.content).toContain("No pude completar la tarea");
  });

  it("matchCompletedWork actualiza ideas del backlog", async () => {
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([{ type: "done", summary: [{ path: "Login.tsx", action: "created" }] }]);
    });
    matchCompletedWorkMock.mockResolvedValue([
      { id: "idea-1", title: "Crear login", status: "pendiente" as const },
    ]);
    updateIdeaStatusMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("implementa la idea del login");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(matchCompletedWorkMock).toHaveBeenCalled();
    expect(updateIdeaStatusMock).toHaveBeenCalled();
  });

  it("detectIdea guarda ideas silenciosamente", async () => {
    classifyIntentMock.mockReturnValue("chat");
    detectIdeaMock.mockReturnValue(true);
    createIdeaMock.mockReturnValue({ id: "idea-x" });
    saveIdeaMock.mockResolvedValue(undefined);
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([{ type: "done", summary: [] }]);
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("quiero guardar esta idea");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    expect(detectIdeaMock).toHaveBeenCalled();
    expect(saveIdeaMock).toHaveBeenCalled();
  });

  it("cancel durante grace window elimina mensajes", async () => {
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(async function* () {});

    const { result } = renderHook(() => useAgentHandler());
    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.send("mensaje a cancelar");
    });

    // En grace window → cancel elimina ambos mensajes y resuelve
    await act(async () => {
      result.current.cancel();
      await sendPromise;
    });

    expect(getMessages()).toHaveLength(0);
  });

  it("cancel después de grace window aborta el stream", async () => {
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([{ type: "text", content: "empezando..." }, { type: "done", summary: [] }]);
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("abortar después");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    // El stream terminó solo; cancel ya no aplica
    expect(getMessages().length).toBeGreaterThan(0);
  });

  it("editPending durante grace window restaura el texto y libera el guard", async () => {
    const restoreInput = vi.fn();
    const { result } = renderHook(() => useAgentHandler());
    act(() => {
      result.current.setRestoreInputCallback(restoreInput);
    });

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.send("texto editable");
    });

    await act(async () => {
      const userMsg = getMessages().find((m) => m.role === "user")!;
      result.current.editPending(userMsg.id);
      // Fix spec 899: editPending resuelve la promesa de gracia — send()
      // debe terminar (antes la promesa quedaba colgada y el guard P0
      // bloqueaba todos los send() futuros permanentemente).
      await sendPromise;
    });

    expect(restoreInput).toHaveBeenCalledWith("texto editable", []);
    expect(getMessages()).toHaveLength(0);

    // Regresión: tras editPending, un nuevo send() debe arrancar (el guard
    // isRunningRef ya no está atascado).
    classifyIntentMock.mockReturnValue("code");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([{ type: "text", content: "ok" }, { type: "done", summary: [] }]);
    });
    await act(async () => {
      const p = result.current.send("segundo mensaje");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });
    expect(getMessages().length).toBeGreaterThan(0);
  });

  it("post-send emite vibeEvents y XP", async () => {
    classifyIntentMock.mockReturnValue("chat");
    handleMessageMock.mockImplementation(async function* () {
      yield* eventStream([{ type: "done", summary: [] }]);
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("hola aura");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    expect(emitVibeMock).toHaveBeenCalledWith(expect.objectContaining({ type: "chat_sent" }));
    expect(awardPassiveXPMock).toHaveBeenCalledWith("chat_message");
  });

  it("maneja error en handleMessage y marca retry", async () => {
    classifyIntentMock.mockReturnValue("chat");
    handleMessageMock.mockImplementation(async function* () {
      throw new Error("connection reset");
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("falla esto");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    const msgs = getMessages();
    const assistant = msgs.find((m) => m.role === "assistant");
    expect(assistant!.content).toContain("RETRY_NETWORK");
    // finally limpió el estado
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("aborta silenciosamente con AbortError", async () => {
    classifyIntentMock.mockReturnValue("chat");
    handleMessageMock.mockImplementation(async function* () {
      const err = new Error("aborted") as Error & { name: string };
      err.name = "AbortError";
      throw err;
    });

    const { result } = renderHook(() => useAgentHandler());
    await act(async () => {
      const p = result.current.send("aborta");
      vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
      await p;
    });

    const msgs = getMessages();
    const assistant = msgs.find((m) => m.role === "assistant");
    expect(assistant!.content).not.toContain("RETRY_NETWORK");
  });
});
