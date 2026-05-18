/**
 * Chat Store — Agent Execution Actions Tests
 *
 * Tests initMessageExecution, updateMessageExecution, setMessageStatus.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../../src/stores/chat";

// ─── Helpers ───────────────────────────────────────────────────

function seedMessage(id: string, role: "user" | "assistant" = "assistant") {
  const store = useChatStore.getState();
  store.addMessage({
    id,
    role,
    content: "test content",
    timestamp: Date.now(),
  });
}

function getMessage(id: string) {
  const state = useChatStore.getState();
  const session = state.sessions[state.activeSessionId];
  return session?.messages.find((m) => m.id === id);
}

// ─── Tests ─────────────────────────────────────────────────────

describe("chatStore — Agent Execution Actions", () => {
  beforeEach(() => {
    // Reset store to clean state
    useChatStore.setState({
      sessions: {
        default: {
          id: "default",
          name: "Default",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      activeSessionId: "default",
    });
  });

  describe("initMessageExecution", () => {
    it("creates default agentExecution on the target message", () => {
      seedMessage("msg-1");
      useChatStore.getState().initMessageExecution("msg-1");

      const msg = getMessage("msg-1");
      expect(msg?.agentExecution).toBeDefined();
      expect(msg?.agentExecution?.phase).toBe("thinking");
      expect(msg?.agentExecution?.progress).toBe(0);
      expect(msg?.agentExecution?.status).toBe("running");
      expect(msg?.agentExecution?.roadmap).toEqual([]);
      expect(msg?.agentExecution?.steps).toEqual([]);
      expect(msg?.agentExecution?.filesChanged).toEqual([]);
    });

    it("does not overwrite existing agentExecution", () => {
      seedMessage("msg-2");
      useChatStore.getState().initMessageExecution("msg-2");
      useChatStore.getState().updateMessageExecution("msg-2", { phase: "building", progress: 50 });

      // Call init again — should NOT reset
      useChatStore.getState().initMessageExecution("msg-2");

      const msg = getMessage("msg-2");
      expect(msg?.agentExecution?.phase).toBe("building");
      expect(msg?.agentExecution?.progress).toBe(50);
    });

    it("does nothing for non-existent message", () => {
      // Should not throw
      useChatStore.getState().initMessageExecution("non-existent");
    });
  });

  describe("updateMessageExecution", () => {
    it("updates phase and progress", () => {
      seedMessage("msg-3");
      useChatStore.getState().initMessageExecution("msg-3");
      useChatStore.getState().updateMessageExecution("msg-3", {
        phase: "building",
        progress: 75,
      });

      const msg = getMessage("msg-3");
      expect(msg?.agentExecution?.phase).toBe("building");
      expect(msg?.agentExecution?.progress).toBe(75);
      // Status should be unchanged
      expect(msg?.agentExecution?.status).toBe("running");
    });

    it("updates roadmap goals", () => {
      seedMessage("msg-4");
      useChatStore.getState().initMessageExecution("msg-4");

      const goals = [
        { id: "g1", label: "Analizar", status: "done" as const },
        { id: "g2", label: "Construir", status: "active" as const },
      ];
      useChatStore.getState().updateMessageExecution("msg-4", { roadmap: goals });

      const msg = getMessage("msg-4");
      expect(msg?.agentExecution?.roadmap).toEqual(goals);
    });

    it("does nothing if message has no agentExecution", () => {
      seedMessage("msg-5");
      // Do NOT call initMessageExecution
      useChatStore.getState().updateMessageExecution("msg-5", { phase: "building" });

      const msg = getMessage("msg-5");
      expect(msg?.agentExecution).toBeUndefined();
    });

    it("sets confirmation context", () => {
      seedMessage("msg-6");
      useChatStore.getState().initMessageExecution("msg-6");
      useChatStore.getState().updateMessageExecution("msg-6", {
        confirmation: {
          completedPhase: "spec",
          nextPhase: "design",
          summary: "Spec completada",
        },
      });

      const msg = getMessage("msg-6");
      expect(msg?.agentExecution?.confirmation?.completedPhase).toBe("spec");
      expect(msg?.agentExecution?.confirmation?.nextPhase).toBe("design");
    });
  });

  describe("setMessageStatus", () => {
    it("sets status to done with completedAt timestamp", () => {
      seedMessage("msg-7");
      useChatStore.getState().initMessageExecution("msg-7");

      const before = Date.now();
      useChatStore.getState().setMessageStatus("msg-7", "done");

      const msg = getMessage("msg-7");
      expect(msg?.agentExecution?.status).toBe("done");
      expect(msg?.agentExecution?.completedAt).toBeGreaterThanOrEqual(before);
    });

    it("sets status to error with completedAt timestamp", () => {
      seedMessage("msg-8");
      useChatStore.getState().initMessageExecution("msg-8");
      useChatStore.getState().setMessageStatus("msg-8", "error");

      const msg = getMessage("msg-8");
      expect(msg?.agentExecution?.status).toBe("error");
      expect(msg?.agentExecution?.completedAt).toBeDefined();
    });

    it("does not set completedAt for running status", () => {
      seedMessage("msg-9");
      useChatStore.getState().initMessageExecution("msg-9");
      useChatStore.getState().setMessageStatus("msg-9", "running");

      const msg = getMessage("msg-9");
      expect(msg?.agentExecution?.status).toBe("running");
      expect(msg?.agentExecution?.completedAt).toBeUndefined();
    });

    it("sets awaiting-confirmation status without completedAt", () => {
      seedMessage("msg-10");
      useChatStore.getState().initMessageExecution("msg-10");
      useChatStore.getState().setMessageStatus("msg-10", "awaiting-confirmation");

      const msg = getMessage("msg-10");
      expect(msg?.agentExecution?.status).toBe("awaiting-confirmation");
      expect(msg?.agentExecution?.completedAt).toBeUndefined();
    });
  });
});
