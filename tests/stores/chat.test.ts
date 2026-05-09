import { describe, it, expect, beforeEach } from "vitest";
import {
  useChatStore,
  MAX_CONTEXT_MESSAGES,
  getContextMessages,
  getContextCount,
} from "../../src/stores/chat";
import type { Message } from "../../src/lib/types";

beforeEach(() => {
  useChatStore.setState({
    messages: [],
    isStreaming: false,
    activeProvider: "deepseek",
    pipelinePhase: null,
  });
});

describe("ChatStore", () => {
  it("should start with empty messages", () => {
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("should add a message", () => {
    const msg: Message = {
      id: "1",
      role: "user",
      content: "Hola",
      timestamp: Date.now(),
    };
    useChatStore.getState().addMessage(msg);
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe("Hola");
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
    expect(useChatStore.getState().messages[0].content).toBe("Hola, ¿cómo estás?");
  });

  it("should clear all messages", () => {
    useChatStore.getState().addMessage({
      id: "1",
      role: "user",
      content: "test",
      timestamp: Date.now(),
    });
    useChatStore.getState().clearMessages();
    expect(useChatStore.getState().messages).toHaveLength(0);
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
    expect(useChatStore.getState().messages[0].content).toBe("Chau");
  });

  it("should not fail when replacing on empty messages", () => {
    expect(() => {
      useChatStore.getState().replaceLastMessageContent("nada");
    }).not.toThrow();
    expect(useChatStore.getState().messages).toHaveLength(0);
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

    const state = useChatStore.getState();
    expect(state.messages.length).toBe(MAX_CONTEXT_MESSAGES);
    // Los mensajes más viejos deberían haberse descartado
    expect(state.messages[0].id).toBe(`msg-${5}`);
    expect(state.messages[state.messages.length - 1].id).toBe(
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

    expect(useChatStore.getState().messages.length).toBe(5);
  });

  // ── Selectors ─────────────────────────────────────────────

  it("getContextMessages should return last MAX_CONTEXT_MESSAGES", () => {
    const messages: Message[] = [];
    for (let i = 0; i < 25; i++) {
      messages.push({
        id: `msg-${i}`,
        role: "user",
        content: `Mensaje ${i}`,
        timestamp: Date.now() + i,
      });
    }

    const context = getContextMessages(messages);
    expect(context.length).toBe(MAX_CONTEXT_MESSAGES);
    expect(context[0].id).toBe("msg-5");
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

  it("getContextCount should return count capped at MAX_CONTEXT_MESSAGES", () => {
    const messages: Message[] = [];
    for (let i = 0; i < 25; i++) {
      messages.push({
        id: `msg-${i}`,
        role: "user",
        content: `Mensaje ${i}`,
        timestamp: Date.now() + i,
      });
    }

    expect(getContextCount(messages)).toBe(MAX_CONTEXT_MESSAGES);
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
    expect(useChatStore.getState().messages).toHaveLength(0);
  });
});
