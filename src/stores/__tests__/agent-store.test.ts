/**
 * Agent Store — Tests
 *
 * Verifies state transitions for the agent execution lifecycle:
 * roadmap management, progress tracking, step accumulation, and UI state.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useAgentStore } from "@/stores/agent";
import type { RoadmapGoal, AgentStep } from "@/agent/types";

// ─── Setup ─────────────────────────────────────────────────────

function resetStore() {
  useAgentStore.setState(useAgentStore.getInitialState());
}

// ─── Execution Lifecycle ───────────────────────────────────────

describe("Agent Store — Execution lifecycle", () => {
  beforeEach(resetStore);

  it("starts idle", () => {
    const state = useAgentStore.getState();
    expect(state.isExecuting).toBe(false);
    expect(state.phase).toBeNull();
    expect(state.progress).toBe(0);
    expect(state.roadmap).toEqual([]);
    expect(state.steps).toEqual([]);
  });

  it("startExecution sets executing state", () => {
    useAgentStore.getState().startExecution();
    const state = useAgentStore.getState();
    expect(state.isExecuting).toBe(true);
    expect(state.progress).toBe(0);
    expect(state.roadmap).toEqual([]);
    expect(state.steps).toEqual([]);
  });

  it("endExecution resets executing but keeps results", () => {
    const store = useAgentStore.getState();
    store.startExecution();
    store.setRoadmap([{ id: "1", label: "Test", status: "done" }]);
    store.addStep({ id: "s1", icon: "📖", label: "Read file", status: "done", timestamp: Date.now() });
    store.endExecution();

    const state = useAgentStore.getState();
    expect(state.isExecuting).toBe(false);
    expect(state.phase).toBeNull();
    // Roadmap and steps remain visible after execution ends
    expect(state.roadmap.length).toBe(1);
    expect(state.steps.length).toBe(1);
  });
});

// ─── Roadmap ───────────────────────────────────────────────────

describe("Agent Store — Roadmap", () => {
  beforeEach(resetStore);

  it("setRoadmap replaces all goals", () => {
    const goals: RoadmapGoal[] = [
      { id: "1", label: "Analizar", status: "active" },
      { id: "2", label: "Construir", status: "pending" },
    ];
    useAgentStore.getState().setRoadmap(goals);
    expect(useAgentStore.getState().roadmap).toEqual(goals);
  });

  it("updateGoal modifies a specific goal", () => {
    useAgentStore.getState().setRoadmap([
      { id: "1", label: "Analizar", status: "active" },
      { id: "2", label: "Construir", status: "pending" },
    ]);
    useAgentStore.getState().updateGoal("1", "done");

    const roadmap = useAgentStore.getState().roadmap;
    expect(roadmap[0].status).toBe("done");
    expect(roadmap[1].status).toBe("pending");
  });

  it("updateGoal with progress sets sub-progress", () => {
    useAgentStore.getState().setRoadmap([
      { id: "1", label: "Construir", status: "active" },
    ]);
    useAgentStore.getState().updateGoal("1", "active", 50);

    const goal = useAgentStore.getState().roadmap[0];
    expect(goal.progress).toBe(50);
  });

  it("updateGoal ignores unknown goalId", () => {
    useAgentStore.getState().setRoadmap([
      { id: "1", label: "Test", status: "pending" },
    ]);
    useAgentStore.getState().updateGoal("nonexistent", "done");
    expect(useAgentStore.getState().roadmap[0].status).toBe("pending");
  });
});

// ─── Steps ─────────────────────────────────────────────────────

describe("Agent Store — Steps", () => {
  beforeEach(resetStore);

  it("addStep appends to the list", () => {
    const step: AgentStep = {
      id: "s1",
      icon: "📖",
      label: "Leyendo App.tsx",
      status: "running",
      timestamp: Date.now(),
    };
    useAgentStore.getState().addStep(step);
    expect(useAgentStore.getState().steps).toEqual([step]);
  });

  it("updateStepStatus changes status of existing step", () => {
    useAgentStore.getState().addStep({
      id: "s1", icon: "📖", label: "Reading", status: "running", timestamp: Date.now(),
    });
    useAgentStore.getState().updateStepStatus("s1", "done");
    expect(useAgentStore.getState().steps[0].status).toBe("done");
  });

  it("updateStepStatus ignores unknown stepId", () => {
    useAgentStore.getState().addStep({
      id: "s1", icon: "📖", label: "Reading", status: "running", timestamp: Date.now(),
    });
    useAgentStore.getState().updateStepStatus("unknown", "error");
    expect(useAgentStore.getState().steps[0].status).toBe("running");
  });
});

// ─── Progress ──────────────────────────────────────────────────

describe("Agent Store — Progress", () => {
  beforeEach(resetStore);

  it("setProgress updates global progress", () => {
    useAgentStore.getState().setProgress(75);
    expect(useAgentStore.getState().progress).toBe(75);
  });

  it("clamps progress to 0-100", () => {
    useAgentStore.getState().setProgress(-10);
    expect(useAgentStore.getState().progress).toBe(0);

    useAgentStore.getState().setProgress(200);
    expect(useAgentStore.getState().progress).toBe(100);
  });
});

// ─── UI State ──────────────────────────────────────────────────

describe("Agent Store — UI state", () => {
  beforeEach(resetStore);

  it("toggles activity bar expansion", () => {
    // starts collapsed (false) — bar is hidden until agent executes
    expect(useAgentStore.getState().activityBarExpanded).toBe(false);
    useAgentStore.getState().setActivityBarExpanded(true);
    expect(useAgentStore.getState().activityBarExpanded).toBe(true);
    useAgentStore.getState().setActivityBarExpanded(false);
    expect(useAgentStore.getState().activityBarExpanded).toBe(false);
  });

  it("setPhase updates current phase", () => {
    useAgentStore.getState().setPhase("building");
    expect(useAgentStore.getState().phase).toBe("building");
  });

  it("clearExecution resets everything", () => {
    const store = useAgentStore.getState();
    store.startExecution();
    store.setPhase("building");
    store.setProgress(50);
    store.setRoadmap([{ id: "1", label: "Test", status: "active" }]);
    store.addStep({ id: "s1", icon: "📖", label: "Read", status: "done", timestamp: Date.now() });
    store.addFileChange({ path: "test.ts", action: "created" });

    store.clearExecution();
    const state = useAgentStore.getState();
    expect(state.isExecuting).toBe(false);
    expect(state.phase).toBeNull();
    expect(state.progress).toBe(0);
    expect(state.roadmap).toEqual([]);
    expect(state.steps).toEqual([]);
    expect(state.filesChanged).toEqual([]);
  });
});

// ─── Files Changed ─────────────────────────────────────────────

describe("Agent Store — File tracking", () => {
  beforeEach(resetStore);

  it("addFileChange tracks a new file", () => {
    useAgentStore.getState().addFileChange({ path: "src/App.tsx", action: "modified" });
    expect(useAgentStore.getState().filesChanged).toEqual([
      { path: "src/App.tsx", action: "modified" },
    ]);
  });

  it("accumulates multiple file changes", () => {
    const store = useAgentStore.getState();
    store.addFileChange({ path: "a.ts", action: "created" });
    store.addFileChange({ path: "b.ts", action: "modified" });
    expect(useAgentStore.getState().filesChanged).toHaveLength(2);
  });
});
