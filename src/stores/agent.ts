/**
 * Agent Store — Dedicated state for agent execution.
 *
 * Separated from ChatStore to keep concerns clean:
 * - ChatStore: messages, sessions, persistence
 * - AgentStore: execution state, roadmap, steps, progress (ephemeral)
 *
 * This store is NOT persisted — it resets on page reload.
 * The agent's execution state is transient by nature.
 */

import { create } from "zustand";
import type { AgentPhase, RoadmapGoal, AgentStep, FileSummary } from "@/agent/types";

// ─── State ─────────────────────────────────────────────────────

interface AgentState {
  // Execution lifecycle
  isExecuting: boolean;
  phase: AgentPhase | null;
  progress: number; // 0-100

  // Roadmap (goals/steps visible to user)
  roadmap: RoadmapGoal[];

  // Tool execution steps (technical detail)
  steps: AgentStep[];

  // File tracking
  filesChanged: FileSummary[];

  // UI
  activityBarExpanded: boolean;
}

// ─── Actions ───────────────────────────────────────────────────

interface AgentActions {
  // Lifecycle
  startExecution: () => void;
  endExecution: () => void;
  clearExecution: () => void;

  // Phase
  setPhase: (phase: AgentPhase | null) => void;

  // Progress
  setProgress: (percent: number) => void;

  // Roadmap
  setRoadmap: (goals: RoadmapGoal[]) => void;
  updateGoal: (goalId: string, status: RoadmapGoal["status"], progress?: number) => void;

  // Steps
  addStep: (step: AgentStep) => void;
  updateStepStatus: (stepId: string, status: AgentStep["status"]) => void;

  // Files
  addFileChange: (file: FileSummary) => void;

  // UI
  setActivityBarExpanded: (expanded: boolean) => void;
}

// ─── Initial State ─────────────────────────────────────────────

const initialState: AgentState = {
  isExecuting: false,
  phase: null,
  progress: 0,
  roadmap: [],
  steps: [],
  filesChanged: [],
  activityBarExpanded: true,
};

// ─── Store ─────────────────────────────────────────────────────

export type AgentStore = AgentState & AgentActions;

export const useAgentStore = create<AgentStore>()((set) => ({
  ...initialState,

  // ─── Lifecycle ─────────────────────────────────────────

  startExecution: () =>
    set({
      isExecuting: true,
      progress: 0,
      roadmap: [],
      steps: [],
      filesChanged: [],
    }),

  endExecution: () =>
    set({
      isExecuting: false,
      phase: null,
    }),

  clearExecution: () =>
    set({ ...initialState }),

  // ─── Phase ─────────────────────────────────────────────

  setPhase: (phase) => set({ phase }),

  // ─── Progress ──────────────────────────────────────────

  setProgress: (percent) =>
    set({ progress: Math.max(0, Math.min(100, percent)) }),

  // ─── Roadmap ───────────────────────────────────────────

  setRoadmap: (goals) => set({ roadmap: goals }),

  updateGoal: (goalId, status, progress) =>
    set((state) => ({
      roadmap: state.roadmap.map((g) =>
        g.id === goalId
          ? { ...g, status, ...(progress !== undefined ? { progress } : {}) }
          : g
      ),
    })),

  // ─── Steps ─────────────────────────────────────────────

  addStep: (step) =>
    set((state) => ({ steps: [...state.steps, step] })),

  updateStepStatus: (stepId, status) =>
    set((state) => ({
      steps: state.steps.map((s) =>
        s.id === stepId ? { ...s, status } : s
      ),
    })),

  // ─── Files ─────────────────────────────────────────────

  addFileChange: (file) =>
    set((state) => ({ filesChanged: [...state.filesChanged, file] })),

  // ─── UI ────────────────────────────────────────────────

  setActivityBarExpanded: (expanded) =>
    set({ activityBarExpanded: expanded }),
}));

// ─── Event Bus ──────────────────────────────────────────────────

/**
 * Simple typed event bus for agent → chat synchronization.
 * Message bubbles subscribe to execution changes without polling.
 */

export type AgentBusEvent =
  | { type: "phase"; phase: AgentPhase }
  | { type: "progress"; percent: number }
  | { type: "roadmap"; goals: RoadmapGoal[] }
  | { type: "step"; step: AgentStep }
  | { type: "file-changed"; path: string; action: FileSummary["action"] }
  | { type: "done"; filesChanged: FileSummary[] }
  | { type: "error"; message: string }
  | { type: "awaiting-confirmation"; completedPhase: string; nextPhase: string; summary: string };

type AgentBusListener = (event: AgentBusEvent) => void;

const listeners = new Set<AgentBusListener>();

export const agentBus = {
  /** Subscribe to agent events. Returns unsubscribe function. */
  subscribe(listener: AgentBusListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Emit an event to all subscribers */
  emit(event: AgentBusEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Swallow — listeners must not break the bus
      }
    }
  },

  /** Clear all subscribers (for cleanup/testing) */
  clear(): void {
    listeners.clear();
  },
};

// ─── Expose initial state for tests ────────────────────────────

useAgentStore.getInitialState = () => ({ ...initialState } as AgentStore);

// Type augmentation for getInitialState
declare module "zustand" {
  interface StoreApi<T> {
    getInitialState: () => T;
  }
}
