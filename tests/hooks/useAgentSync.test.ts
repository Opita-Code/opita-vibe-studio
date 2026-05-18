/**
 * useAgentSync — Unit Tests
 *
 * Tests the bridge between agentBus and chatStore.
 * Verifies that bus events correctly propagate to message execution state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAgentSync } from "../../src/hooks/useAgentSync";
import { agentBus } from "../../src/stores/agent";
import { useChatStore } from "../../src/stores/chat";

// ─── Helpers ───────────────────────────────────────────────────

const MSG_ID = "test-msg-1";

function resetStores() {
  agentBus.clear();
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
}

function seedAssistantMessage(id: string = MSG_ID) {
  useChatStore.getState().addMessage({
    id,
    role: "assistant",
    content: "",
    timestamp: Date.now(),
  });
  useChatStore.getState().initMessageExecution(id);
}

function getExecution(id: string = MSG_ID) {
  const state = useChatStore.getState();
  const session = state.sessions[state.activeSessionId];
  const msg = session?.messages.find((m) => m.id === id);
  return msg?.agentExecution;
}

// ─── Tests ─────────────────────────────────────────────────────

describe("useAgentSync", () => {
  beforeEach(() => {
    resetStores();
    seedAssistantMessage();
  });

  afterEach(() => {
    cleanup();
    agentBus.clear();
  });

  it("subscribes to agentBus on mount and unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useAgentSync(MSG_ID));

    // Emit an event — should be received
    act(() => agentBus.emit({ type: "phase", phase: "building" }));
    expect(getExecution()?.phase).toBe("building");

    unmount();

    // After unmount, events should NOT update the store
    act(() => agentBus.emit({ type: "phase", phase: "verifying" }));
    expect(getExecution()?.phase).toBe("building");
  });

  it("ignores events when activeMessageId is null", () => {
    renderHook(() => useAgentSync(null));

    act(() => agentBus.emit({ type: "phase", phase: "building" }));

    // Phase should remain at init default ("thinking")
    expect(getExecution()?.phase).toBe("thinking");
  });

  it("handles phase events", () => {
    renderHook(() => useAgentSync(MSG_ID));

    act(() => agentBus.emit({ type: "phase", phase: "building" }));
    expect(getExecution()?.phase).toBe("building");

    act(() => agentBus.emit({ type: "phase", phase: "verifying" }));
    expect(getExecution()?.phase).toBe("verifying");
  });

  it("handles progress events and clamps to 0-100", () => {
    renderHook(() => useAgentSync(MSG_ID));

    act(() => agentBus.emit({ type: "progress", percent: 42 }));
    expect(getExecution()?.progress).toBe(42);

    // Clamp above 100
    act(() => agentBus.emit({ type: "progress", percent: 150 }));
    expect(getExecution()?.progress).toBe(100);

    // Clamp below 0
    act(() => agentBus.emit({ type: "progress", percent: -10 }));
    expect(getExecution()?.progress).toBe(0);
  });

  it("handles roadmap events", () => {
    renderHook(() => useAgentSync(MSG_ID));

    const goals = [
      { id: "g1", label: "Analizar", status: "done" as const },
      { id: "g2", label: "Construir", status: "active" as const },
    ];

    act(() => agentBus.emit({ type: "roadmap", goals }));

    const exec = getExecution();
    expect(exec?.roadmap).toHaveLength(2);
    expect(exec?.roadmap?.[0].label).toBe("Analizar");
    expect(exec?.roadmap?.[1].status).toBe("active");
  });

  it("handles step events — append new steps", () => {
    renderHook(() => useAgentSync(MSG_ID));

    const step1 = {
      id: "s1",
      icon: "📖",
      label: "Leyendo archivo",
      status: "running" as const,
      timestamp: Date.now(),
    };

    act(() => agentBus.emit({ type: "step", step: step1 }));
    expect(getExecution()?.steps).toHaveLength(1);
    expect(getExecution()?.steps?.[0].label).toBe("Leyendo archivo");
  });

  it("handles step events — update existing step by ID", () => {
    renderHook(() => useAgentSync(MSG_ID));

    const step = {
      id: "s1",
      icon: "📖",
      label: "Leyendo archivo",
      status: "running" as const,
      timestamp: Date.now(),
    };

    act(() => agentBus.emit({ type: "step", step }));
    expect(getExecution()?.steps?.[0].status).toBe("running");

    // Update same step
    act(() =>
      agentBus.emit({
        type: "step",
        step: { ...step, status: "done", label: "Archivo leído" },
      })
    );

    const steps = getExecution()?.steps;
    expect(steps).toHaveLength(1); // No duplicate
    expect(steps?.[0].status).toBe("done");
    expect(steps?.[0].label).toBe("Archivo leído");
  });

  it("handles file-changed events — append and deduplicate", () => {
    renderHook(() => useAgentSync(MSG_ID));

    act(() =>
      agentBus.emit({
        type: "file-changed",
        path: "src/index.ts",
        action: "created",
      })
    );
    expect(getExecution()?.filesChanged).toHaveLength(1);

    // Same path, different action → update, not duplicate
    act(() =>
      agentBus.emit({
        type: "file-changed",
        path: "src/index.ts",
        action: "modified",
      })
    );
    const files = getExecution()?.filesChanged;
    expect(files).toHaveLength(1);
    expect(files?.[0].action).toBe("modified");

    // Different path → append
    act(() =>
      agentBus.emit({
        type: "file-changed",
        path: "src/utils.ts",
        action: "created",
      })
    );
    expect(getExecution()?.filesChanged).toHaveLength(2);
  });

  it("handles done events", () => {
    renderHook(() => useAgentSync(MSG_ID));

    act(() => agentBus.emit({ type: "done", filesChanged: [] }));

    const exec = getExecution();
    expect(exec?.status).toBe("done");
    expect(exec?.completedAt).toBeDefined();
  });

  it("handles error events", () => {
    renderHook(() => useAgentSync(MSG_ID));

    act(() =>
      agentBus.emit({ type: "error", message: "Token limit exceeded" })
    );

    const exec = getExecution();
    expect(exec?.status).toBe("error");
    expect(exec?.error).toBe("Token limit exceeded");
    expect(exec?.completedAt).toBeDefined();
  });

  it("handles awaiting-confirmation events", () => {
    renderHook(() => useAgentSync(MSG_ID));

    act(() =>
      agentBus.emit({
        type: "awaiting-confirmation",
        completedPhase: "spec",
        nextPhase: "design",
        summary: "Spec completada",
      })
    );

    const exec = getExecution();
    expect(exec?.status).toBe("awaiting-confirmation");
    expect(exec?.confirmation?.completedPhase).toBe("spec");
    expect(exec?.confirmation?.nextPhase).toBe("design");
    expect(exec?.confirmation?.summary).toBe("Spec completada");
  });

  it("follows ref updates when activeMessageId changes", () => {
    const MSG_ID_2 = "test-msg-2";
    seedAssistantMessage(MSG_ID_2);

    // Start with MSG_ID
    const { rerender } = renderHook(
      ({ id }) => useAgentSync(id),
      { initialProps: { id: MSG_ID as string | null } }
    );

    act(() => agentBus.emit({ type: "phase", phase: "building" }));
    expect(getExecution(MSG_ID)?.phase).toBe("building");
    expect(getExecution(MSG_ID_2)?.phase).toBe("thinking"); // untouched

    // Switch to MSG_ID_2
    rerender({ id: MSG_ID_2 });

    act(() => agentBus.emit({ type: "phase", phase: "verifying" }));
    expect(getExecution(MSG_ID)?.phase).toBe("building"); // frozen
    expect(getExecution(MSG_ID_2)?.phase).toBe("verifying"); // updated
  });
});
