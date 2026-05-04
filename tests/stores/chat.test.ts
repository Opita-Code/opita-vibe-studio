import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../../src/stores/chat";
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
});
