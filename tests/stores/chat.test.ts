import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useChatStore,
  MAX_CONTEXT_MESSAGES,
  getContextMessages,
  getContextCount,
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

  it("switchSession resets all transient execution fields", () => {
    // Arrange: second session + dirty transient state
    useChatStore.setState({
      sessions: {
        default: { id: "default", title: "A", messages: [makeMsg("m1")], updatedAt: Date.now() },
        other: { id: "other", title: "B", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "default",
      pipelinePhase: "construir",
      chainingSteps: 3,
      chainingErrors: 1,
      pendingConfirmation: { phase: "entender", plan: "..." },
      isStreaming: true,
      isExecutingMCP: true,
    });

    useChatStore.getState().switchSession("other");

    const s = useChatStore.getState();
    expect(s.activeSessionId).toBe("other");
    expect(s.pipelinePhase).toBeNull();
    expect(s.chainingSteps).toBe(0);
    expect(s.chainingErrors).toBe(0);
    expect(s.pendingConfirmation).toBeNull();
    expect(s.isStreaming).toBe(false);
    expect(s.isExecutingMCP).toBe(false);
  });

  it("switchSession mid-stream aborts the active controller", () => {
    const abort = vi.fn();
    useChatStore.setState({
      sessions: {
        default: { id: "default", title: "A", messages: [makeMsg("m1")], updatedAt: Date.now() },
        other: { id: "other", title: "B", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "default",
      isStreaming: true,
      abortController: { abort } as unknown as AbortController,
    });

    useChatStore.getState().switchSession("other");

    expect(abort).toHaveBeenCalledOnce();
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("switchSession with same id is a no-op", () => {
    useChatStore.setState({ pipelinePhase: "verificar", chainingSteps: 5 });

    useChatStore.getState().switchSession("default");

    // State should be unchanged
    expect(useChatStore.getState().pipelinePhase).toBe("verificar");
    expect(useChatStore.getState().chainingSteps).toBe(5);
  });

  // ── createNewSession ─────────────────────────────────────────

  it("createNewSession reuses active session when it has no messages", () => {
    // Active session is empty — no ghost should be created
    useChatStore.getState().createNewSession();

    const s = useChatStore.getState();
    expect(Object.keys(s.sessions)).toHaveLength(1);
    expect(s.activeSessionId).toBe("default");
    expect(s.sessions["default"].title).toBe("Nueva conversación");
    expect(s.pipelinePhase).toBeNull();
  });

  it("createNewSession creates a new session when active has messages", () => {
    useChatStore.getState().addMessage(makeMsg("m1"));

    useChatStore.getState().createNewSession();

    const s = useChatStore.getState();
    expect(Object.keys(s.sessions)).toHaveLength(2);
    expect(s.activeSessionId).not.toBe("default");
    expect(s.pipelinePhase).toBeNull();
    expect(s.chainingSteps).toBe(0);
  });

  it("createNewSession purges other empty sessions before creating", () => {
    // Add an empty ghost session in the store
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        ghost1: { id: "ghost1", title: "Nueva conversación", messages: [], updatedAt: Date.now() },
      },
    }));

    // Active session now has a message so a new one will be created
    useChatStore.getState().addMessage(makeMsg("m1"));
    useChatStore.getState().createNewSession();

    const s = useChatStore.getState();
    // ghost1 should have been purged; only default (with msg) + new active remain
    expect(Object.keys(s.sessions)).toHaveLength(2);
    expect(s.sessions["ghost1"]).toBeUndefined();
  });

  // ── pruneEmptySessions ───────────────────────────────────────

  it("pruneEmptySessions removes orphan sessions with no messages", () => {
    useChatStore.setState({
      sessions: {
        withMsgs: { id: "withMsgs", title: "Con mensajes", messages: [makeMsg("m1")], updatedAt: Date.now() },
        empty1: { id: "empty1", title: "Vacía 1", messages: [], updatedAt: Date.now() },
        empty2: { id: "empty2", title: "Vacía 2", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "withMsgs",
    });

    useChatStore.getState().pruneEmptySessions();

    const s = useChatStore.getState();
    expect(Object.keys(s.sessions)).toHaveLength(1);
    expect(s.sessions["withMsgs"]).toBeDefined();
    expect(s.sessions["empty1"]).toBeUndefined();
    expect(s.sessions["empty2"]).toBeUndefined();
  });

  it("pruneEmptySessions creates a fresh session when all sessions are empty", () => {
    // All sessions have 0 messages
    useChatStore.setState({
      sessions: {
        e1: { id: "e1", title: "Vacía", messages: [], updatedAt: Date.now() },
        e2: { id: "e2", title: "Vacía 2", messages: [], updatedAt: Date.now() },
      },
      activeSessionId: "e1",
    });

    useChatStore.getState().pruneEmptySessions();

    const s = useChatStore.getState();
    // Active is preserved (e1), so exactly 1 session should remain
    expect(Object.keys(s.sessions)).toHaveLength(1);
    expect(s.sessions[s.activeSessionId]).toBeDefined();
  });
});
