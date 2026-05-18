/**
 * agentBus — Unit Tests
 *
 * Verifies the event bus used to bridge agentStore → chatStore.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { agentBus, type AgentBusEvent } from "../../src/stores/agent";

describe("agentBus", () => {
  beforeEach(() => {
    agentBus.clear();
  });

  it("delivers events to subscribers", () => {
    const listener = vi.fn();
    agentBus.subscribe(listener);

    const event: AgentBusEvent = { type: "phase", phase: "building" };
    agentBus.emit(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("supports multiple subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    agentBus.subscribe(a);
    agentBus.subscribe(b);

    agentBus.emit({ type: "progress", percent: 50 });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it("unsubscribes correctly", () => {
    const listener = vi.fn();
    const unsub = agentBus.subscribe(listener);

    unsub();
    agentBus.emit({ type: "progress", percent: 50 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("clear removes all subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    agentBus.subscribe(a);
    agentBus.subscribe(b);

    agentBus.clear();
    agentBus.emit({ type: "progress", percent: 50 });

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("does not break when a listener throws", () => {
    const bad = vi.fn(() => { throw new Error("kaboom"); });
    const good = vi.fn();

    agentBus.subscribe(bad);
    agentBus.subscribe(good);

    // Should NOT throw
    expect(() => agentBus.emit({ type: "phase", phase: "thinking" })).not.toThrow();

    // The good listener should still receive the event
    expect(good).toHaveBeenCalledOnce();
  });

  it("emits typed events correctly", () => {
    const listener = vi.fn();
    agentBus.subscribe(listener);

    // Phase
    agentBus.emit({ type: "phase", phase: "verifying" });
    expect(listener).toHaveBeenLastCalledWith({ type: "phase", phase: "verifying" });

    // Step
    const step = {
      id: "s1", icon: "🔧", label: "Leyendo archivo",
      status: "running" as const, timestamp: Date.now(),
    };
    agentBus.emit({ type: "step", step });
    expect(listener).toHaveBeenLastCalledWith({ type: "step", step });

    // File changed
    agentBus.emit({ type: "file-changed", path: "src/index.ts", action: "modified" });
    expect(listener).toHaveBeenLastCalledWith({
      type: "file-changed", path: "src/index.ts", action: "modified",
    });

    // Done
    agentBus.emit({ type: "done", filesChanged: [] });
    expect(listener).toHaveBeenLastCalledWith({ type: "done", filesChanged: [] });

    // Error
    agentBus.emit({ type: "error", message: "algo falló" });
    expect(listener).toHaveBeenLastCalledWith({ type: "error", message: "algo falló" });

    // Awaiting confirmation
    agentBus.emit({
      type: "awaiting-confirmation",
      completedPhase: "spec",
      nextPhase: "design",
      summary: "Spec completada",
    });
    expect(listener).toHaveBeenLastCalledWith({
      type: "awaiting-confirmation",
      completedPhase: "spec",
      nextPhase: "design",
      summary: "Spec completada",
    });
  });
});
