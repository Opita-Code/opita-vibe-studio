import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useChatStore,
  MAX_CONTEXT_MESSAGES,
  getContextMessages,
  getContextCount,
  RESEARCH_STATUS_LABELS,
} from "../../src/stores/chat";
import type { Message } from "../../src/lib/types";

// ── Agent store mock ─────────────────────────────────────────────
// resetAgentContext() uses a dynamic import() inside chat.ts to avoid
// a circular dep. We mock at module level so the spy is in place before
// any store action fires.
const mockClearExecution = vi.fn();
vi.mock("../../src/stores/agent", () => ({
  useAgentStore: {
    getState: () => ({ clearExecution: mockClearExecution }),
  },
}));

beforeEach(() => {
  useChatStore.setState({
    sessions: {
      "default": { id: "default", title: "Test", messages: [], updatedAt: Date.now() }
    },
    activeSessionId: "default",
    isStreaming: false,
    activeProvider: "deepseek",
    pipelinePhase: null,
  });
});

const getMessages = () => {
  const state = useChatStore.getState();
  return state.sessions[state.activeSessionId]?.messages || [];
};

describe("ChatStore", () => {
  it("should start with empty messages", () => {
    expect(getMessages()).toHaveLength(0);
  });

  it("should add a message", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: "Hola",
      timestamp: Date.now(),
    };
    useChatStore.getState().addMessage(msg);
    expect(getMessages()).toHaveLength(1);
    expect(getMessages()[0].content).toBe("Hola");
  });

  it("should toggle streaming state", () => {
    useChatStore.getState().setStreaming(true);
    expect(useChatStore.getState().isStreaming).toBe(true);
    useChatStore.getState().setStreaming(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should set active provider", () => {
    useChatStore.getState().setActiveProvider("gemini");
    expect(useChatStore.getState().activeProvider).toBe("gemini");
  });

  it("should set pipeline phase", () => {
    useChatStore.getState().setPipelinePhase("construir");
    expect(useChatStore.getState().pipelinePhase).toBe("construir");
    useChatStore.getState().setPipelinePhase(null);
    expect(useChatStore.getState().pipelinePhase).toBeNull();
  });

  it("should append content to the last message", () => {
    const msg: Message = {
      id: "1",
      role: "assistant",
      content: "Hola",
      timestamp: Date.now(),
    };
    useChatStore.getState().addMessage(msg);
    useChatStore.getState().appendToLastMessage(", ¿cómo estás?");
    expect(getMessages()[0].content).toBe("Hola, ¿cómo estás?");
  });

  it("should clear all messages", () => {
    useChatStore.getState().addMessage({
      id: "1",
      role: "user",
      content: "test",
      timestamp: Date.now(),
    });
    useChatStore.getState().clearMessages();
    expect(getMessages()).toHaveLength(0);
  });

  // ── replaceLastMessageContent ─────────────────────────────

  it("should replace last message content", () => {
    const msg: Message = {
      id: "1",
      role: "assistant",
      content: "Hola",
      timestamp: Date.now(),
    };
    useChatStore.getState().addMessage(msg);
    useChatStore.getState().replaceLastMessageContent("Chau");
    expect(getMessages()[0].content).toBe("Chau");
  });

  it("should not fail when replacing on empty messages", () => {
    expect(() => {
      useChatStore.getState().replaceLastMessageContent("nada");
    }).not.toThrow();
    expect(getMessages()).toHaveLength(0);
  });

  // ── Context eviction ──────────────────────────────────────

  it("should evict oldest messages when exceeding MAX_CONTEXT_MESSAGES", () => {
    const store = useChatStore.getState();
    for (let i = 0; i < MAX_CONTEXT_MESSAGES + 5; i++) {
      store.addMessage({
        id: `msg-${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Mensaje ${i}`,
        timestamp: Date.now() + i,
      });
    }

    const messages = getMessages();
    expect(messages.length).toBe(MAX_CONTEXT_MESSAGES);
    // Los mensajes más viejos deberían haberse descartado
    expect(messages[0].id).toBe(`msg-${5}`);
    expect(messages[messages.length - 1].id).toBe(
      `msg-${MAX_CONTEXT_MESSAGES + 4}`,
    );
  });

  it("should not evict when under MAX_CONTEXT_MESSAGES", () => {
    const store = useChatStore.getState();
    for (let i = 0; i < 5; i++) {
      store.addMessage({
        id: `msg-${i}`,
        role: "user",
        content: `Mensaje ${i}`,
        timestamp: Date.now() + i,
      });
    }

    expect(getMessages().length).toBe(5);
  });

  // ── Selectors ─────────────────────────────────────────────

  it("getContextMessages should evict old messages when exceeding token budget", () => {
    // Each message ~1000 chars = ~250 tokens. 130 messages = ~32500 tokens (over 32K budget)
    const messages: Message[] = [];
    for (let i = 0; i < 150; i++) {
      messages.push({
        id: `msg-${i}`,
        role: "user",
        content: "A".repeat(1000), // ~250 tokens each
        timestamp: Date.now() + i,
      });
    }

    const context = getContextMessages(messages);
    // Should be fewer than 150 since we exceed the 32K token budget
    expect(context.length).toBeLessThan(150);
    expect(context.length).toBeGreaterThan(0);
    // Most recent messages should be preserved
    expect(context[context.length - 1].id).toBe("msg-149");
  });

  it("getContextMessages should return all when under limit", () => {
    const messages: Message[] = [];
    for (let i = 0; i < 5; i++) {
      messages.push({
        id: `msg-${i}`,
        role: "user",
        content: `Mensaje ${i}`,
        timestamp: Date.now() + i,
      });
    }

    expect(getContextMessages(messages).length).toBe(5);
  });

  it("getContextCount should equal getContextMessages length", () => {
    const messages: Message[] = [];
    for (let i = 0; i < 150; i++) {
      messages.push({
        id: `msg-${i}`,
        role: "user",
        content: "A".repeat(1000),
        timestamp: Date.now() + i,
      });
    }

    expect(getContextCount(messages)).toBe(getContextMessages(messages).length);
  });

  it("getContextCount should return actual count when under limit", () => {
    const messages: Message[] = [];
    for (let i = 0; i < 3; i++) {
      messages.push({
        id: `msg-${i}`,
        role: "user",
        content: `Mensaje ${i}`,
        timestamp: Date.now() + i,
      });
    }

    expect(getContextCount(messages)).toBe(3);
  });

  // ── appendToLastMessage edge cases ────────────────────────

  it("appendToLastMessage should not fail with no messages", () => {
    expect(() => {
      useChatStore.getState().appendToLastMessage("más contenido");
    }).not.toThrow();
    expect(getMessages()).toHaveLength(0);
  });
});

// ── Session lifecycle ─────────────────────────────────────────────
describe("Session lifecycle", () => {
  const makeMsg = (id: string): Message => ({
    id,
    role: "user",
    content: `Mensaje ${id}`,
    timestamp: Date.now(),
  });

  beforeEach(() => {
    mockClearExecution.mockClear();
    useChatStore.setState({
      sessions: {
        default: { id: "default", title: "Test", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "default",
      isStreaming: false,
      isExecutingMCP: false,
      pipelinePhase: null,
      chainingSteps: 0,
      chainingErrors: 0,
      pendingConfirmation: null,
      abortController: null,
    });
  });

  // ── switchSession ────────────────────────────────────────────

  it("switchSession changes active session to the target", () => {
    useChatStore.setState({
      sessions: {
        default: { id: "default", title: "A", messages: [makeMsg("m1")], updatedAt: Date.now() },
        other: { id: "other", title: "B", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "default",
    });

    useChatStore.getState().switchSession("other");

    const s = useChatStore.getState();
    expect(s.activeSessionId).toBe("other");
  });

  it("switchSession to non-existent id is a no-op", () => {
    useChatStore.getState().switchSession("nonexistent");

    expect(useChatStore.getState().activeSessionId).toBe("default");
  });

  it("switchSession with same id is a no-op", () => {
    useChatStore.setState({ pipelinePhase: "verificar", chainingSteps: 5 });

    useChatStore.getState().switchSession("default");

    expect(useChatStore.getState().pipelinePhase).toBe("verificar");
    expect(useChatStore.getState().chainingSteps).toBe(5);
  });

  // ── createNewSession ─────────────────────────────────────────

  it("createNewSession always creates a new session and switches to it", () => {
    useChatStore.getState().createNewSession();

    const s = useChatStore.getState();
    expect(Object.keys(s.sessions)).toHaveLength(2);
    expect(s.activeSessionId).not.toBe("default");
    const newSession = s.sessions[s.activeSessionId];
    expect(newSession.title).toBe("Nueva conversación");
    expect(newSession.messages).toHaveLength(0);
  });

  it("createNewSession creates a new session when active has messages", () => {
    useChatStore.getState().addMessage(makeMsg("m1"));

    useChatStore.getState().createNewSession();

    const s = useChatStore.getState();
    expect(Object.keys(s.sessions)).toHaveLength(2);
    expect(s.activeSessionId).not.toBe("default");
  });

  // ── deleteSession ───────────────────────────────────────────

  it("deleteSession removes the target and switches active if needed", () => {
    useChatStore.setState({
      sessions: {
        a: { id: "a", title: "A", messages: [makeMsg("m1")], updatedAt: Date.now() },
        b: { id: "b", title: "B", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "a",
    });

    useChatStore.getState().deleteSession("a");

    const s = useChatStore.getState();
    expect(s.sessions["a"]).toBeUndefined();
    expect(s.activeSessionId).toBe("b");
  });

  it("deleteSession creates a fresh session when all sessions are deleted", () => {
    useChatStore.getState().deleteSession("default");

    const s = useChatStore.getState();
    expect(Object.keys(s.sessions)).toHaveLength(1);
    expect(s.sessions[s.activeSessionId]).toBeDefined();
    expect(s.sessions[s.activeSessionId].messages).toHaveLength(0);
  });
});

// ── Remaining actions / selectors ───────────────────────────────

describe("ChatStore — misc mutations", () => {
  const makeMsg = (id: string, role: "user" | "assistant" = "user"): Message => ({
    id,
    role,
    content: `Mensaje ${id}`,
    timestamp: Date.now(),
  });

  beforeEach(() => {
    useChatStore.setState({
      sessions: {
        default: { id: "default", title: "Test", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "default",
      abortController: null,
    });
  });

  it("editMessage should rewrite content and truncate following messages", () => {
    const store = useChatStore.getState();
    store.addMessage(makeMsg("m1"));
    store.addMessage(makeMsg("m2", "assistant"));
    store.addMessage(makeMsg("m3"));
    store.editMessage("m2", "editado");

    const messages = useChatStore.getState().sessions["default"].messages;
    expect(messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(messages[1].content).toBe("editado");
  });

  it("editMessage should be a no-op for unknown ids", () => {
    const store = useChatStore.getState();
    store.addMessage(makeMsg("m1"));
    store.editMessage("missing", "x");
    expect(useChatStore.getState().sessions["default"].messages).toHaveLength(1);
  });

  it("addMessageStep should append a step to the target message", () => {
    const store = useChatStore.getState();
    store.addMessage(makeMsg("m1", "assistant"));
    store.addMessageStep("m1", {
      id: "s1",
      title: "Tarea",
      status: "running",
      detail: "en proceso",
    });

    const msg = useChatStore.getState().sessions["default"].messages[0];
    expect(msg.subagentSteps).toHaveLength(1);
    expect(msg.subagentSteps![0].id).toBe("s1");
  });

  it("appendReasoningToLastMessage should accumulate reasoning", () => {
    const store = useChatStore.getState();
    store.addMessage(makeMsg("m1", "assistant"));
    store.appendReasoningToLastMessage("pienso ");
    store.appendReasoningToLastMessage("más");
    expect(useChatStore.getState().sessions["default"].messages[0].reasoning).toBe(
      "pienso más",
    );
  });

  it("abortStreaming should abort the active controller and clear transient state", () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, "abort");
    useChatStore.setState({
      isStreaming: true,
      isExecutingMCP: true,
      researchStatus: "searching",
      abortController: controller,
    });

    useChatStore.getState().abortStreaming();

    const s = useChatStore.getState();
    expect(abortSpy).toHaveBeenCalled();
    expect(s.isStreaming).toBe(false);
    expect(s.isExecutingMCP).toBe(false);
    expect(s.researchStatus).toBeNull();
    expect(s.abortController).toBeNull();
  });

  it("abortStreaming should work without an active controller", () => {
    useChatStore.setState({ isStreaming: true, abortController: null });
    useChatStore.getState().abortStreaming();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("should toggle the remaining flag setters", () => {
    const s = useChatStore.getState();
    s.setExecutingMCP(true);
    s.setResearchStatus("cve");
    s.setAbortController(new AbortController());
    s.setActiveModelId("deepseek-v4-pro");
    s.setUseSubagent(false);
    s.setSubagentInstructions("instrucciones");
    s.setActiveMode("construir");
    s.setShareActiveFileContext(false);
    s.setExecutionMode("automatic");
    s.setDeliveryStrategy("auto-split");
    s.setPendingConfirmation({ phase: "verificar", plan: "plan-x" });

    const state = useChatStore.getState();
    expect(state.isExecutingMCP).toBe(true);
    expect(state.researchStatus).toBe("cve");
    expect(state.abortController).toBeInstanceOf(AbortController);
    expect(state.activeModelId).toBe("deepseek-v4-pro");
    expect(state.useSubagent).toBe(false);
    expect(state.subagentInstructions).toBe("instrucciones");
    expect(state.activeMode).toBe("construir");
    expect(state.shareActiveFileContext).toBe(false);
    expect(state.executionMode).toBe("automatic");
    expect(state.deliveryStrategy).toBe("auto-split");
    expect(state.pendingConfirmation).toEqual({ phase: "verificar", plan: "plan-x" });
  });

  it("confirmPhase should clear the pending confirmation", () => {
    useChatStore.setState({ pendingConfirmation: { phase: "construir", plan: "p" } });
    useChatStore.getState().confirmPhase();
    expect(useChatStore.getState().pendingConfirmation).toBeNull();
  });

  it("should manage the chaining counters", () => {
    const s = useChatStore.getState();
    s.incrementChainingStep();
    s.incrementChainingStep();
    s.incrementChainingErrors();
    expect(useChatStore.getState().chainingSteps).toBe(2);
    expect(useChatStore.getState().chainingErrors).toBe(1);
    s.resetChaining();
    expect(useChatStore.getState().chainingSteps).toBe(0);
    expect(useChatStore.getState().chainingErrors).toBe(0);
  });
});

describe("ChatStore — agent execution + sections", () => {
  const makeAssistant = (id: string): Message => ({
    id,
    role: "assistant",
    content: "respuesta",
    timestamp: Date.now(),
  });

  beforeEach(() => {
    useChatStore.setState({
      sessions: {
        default: { id: "default", title: "Test", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "default",
    });
  });

  it("initMessageExecution should create execution on the message", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.initMessageExecution("m1");

    const msg = useChatStore.getState().sessions["default"].messages[0];
    expect(msg.agentExecution).toBeDefined();
    expect(msg.agentExecution!.phase).toBe("thinking");
    expect(msg.agentExecution!.status).toBe("running");
  });

  it("initMessageExecution should preserve existing execution", () => {
    const store = useChatStore.getState();
    store.addMessage({ ...makeAssistant("m1"), agentExecution: { phase: "construir", progress: 1, roadmap: [], steps: [], filesChanged: [], status: "running" as const, startedAt: 1 } });
    store.initMessageExecution("m1");
    expect(useChatStore.getState().sessions["default"].messages[0].agentExecution!.phase).toBe("construir");
  });

  it("updateMessageExecution should merge partial updates", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.initMessageExecution("m1");
    store.updateMessageExecution("m1", { progress: 50, phase: "verificar" });

    const exec = useChatStore.getState().sessions["default"].messages[0].agentExecution!;
    expect(exec.progress).toBe(50);
    expect(exec.phase).toBe("verificar");
  });

  it("updateMessageExecution should be a no-op without execution", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.updateMessageExecution("m1", { progress: 10 });
    expect(useChatStore.getState().sessions["default"].messages[0].agentExecution).toBeUndefined();
  });

  it("setMessageStatus should stamp completedAt for done/error", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.initMessageExecution("m1");
    store.setMessageStatus("m1", "done");

    const exec = useChatStore.getState().sessions["default"].messages[0].agentExecution!;
    expect(exec.status).toBe("done");
    expect(exec.completedAt).toBeTypeOf("number");

    store.setMessageStatus("m1", "error");
    expect(useChatStore.getState().sessions["default"].messages[0].agentExecution!.status).toBe("error");
  });

  it("setMessageStatus should not stamp completedAt for running", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.initMessageExecution("m1");
    store.setMessageStatus("m1", "running");
    const exec = useChatStore.getState().sessions["default"].messages[0].agentExecution!;
    expect(exec.completedAt).toBeUndefined();
  });

  it("setUserMessageStatus should update the delivery status", () => {
    const store = useChatStore.getState();
    store.addMessage(makeMsgLocal("m1"));
    store.setUserMessageStatus("m1", "sent");
    expect(useChatStore.getState().sessions["default"].messages[0].deliveryStatus).toBe("sent");
  });

  it("deleteMessage should remove the message", () => {
    const store = useChatStore.getState();
    store.addMessage(makeMsgLocal("m1"));
    store.addMessage(makeAssistant("m2"));
    store.deleteMessage("m1");
    expect(useChatStore.getState().sessions["default"].messages.map((m) => m.id)).toEqual(["m2"]);
  });

  it("appendSection should add a section and appendToSection should extend it", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.appendSection("m1", { id: "sec1", type: "code", title: "Código", content: "const" });

    let msg = useChatStore.getState().sessions["default"].messages[0];
    expect(msg.sections).toHaveLength(1);
    expect(msg.sections![0].content).toBe("const");

    store.appendToSection("m1", "sec1", " a = 1;");
    msg = useChatStore.getState().sessions["default"].messages[0];
    expect(msg.sections![0].content).toBe("const a = 1;");
  });

  it("appendSection should be a no-op for unknown messages", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.appendSection("missing", { id: "s", type: "text", title: "t", content: "c" });
    expect(useChatStore.getState().sessions["default"].messages[0].sections).toBeUndefined();
  });

  it("appendToSection should be a no-op when the message has no sections", () => {
    const store = useChatStore.getState();
    store.addMessage(makeAssistant("m1"));
    store.appendToSection("m1", "nope", "x");
    expect(useChatStore.getState().sessions["default"].messages[0].sections).toBeUndefined();
  });
});

describe("ChatStore — selectors edge cases", () => {
  it("getContextMessages should return an empty list for no messages", () => {
    expect(getContextMessages([])).toEqual([]);
  });

  it("getContextMessages should keep a single oversized message", () => {
    const messages = [
      { id: "huge", role: "user" as const, content: "A".repeat(200_000), timestamp: 1 },
    ];
    const context = getContextMessages(messages);
    expect(context).toHaveLength(1);
    expect(context[0].id).toBe("huge");
  });

  it("RESEARCH_STATUS_LABELS should expose Spanish labels", () => {
    expect(RESEARCH_STATUS_LABELS.searching).toBe("Buscando documentación...");
    expect(RESEARCH_STATUS_LABELS.synthesizing).toBe("Consolidando hallazgos...");
  });
});

function makeMsgLocal(id: string): Message {
  return { id, role: "user", content: `Mensaje ${id}`, timestamp: Date.now() };
}
