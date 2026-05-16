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
