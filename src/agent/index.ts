/**
 * Agent Module — Public API
 *
 * This is the ONLY import the rest of Vibe Studio needs:
 *
 *   import { handleMessage, useAgentHandler } from "@/agent";
 *
 * Everything else is internal implementation detail.
 */

// ─── Primary API ───────────────────────────────────────────────

/** The hook that ChatPanel uses to send messages */
export { useAgentHandler } from "./useAgentHandler";

/** The orchestrator entry point (for advanced/direct use) */
export { handleMessage } from "./orchestrator";

/** Intent classifier (for UI mode indicators) */
export { classifyIntent } from "./intent";

// ─── Types ─────────────────────────────────────────────────────

export type {
  AgentEvent,
  AgentPhase,
  AgentStep,
  ExecutionMode,
  IntentClass,
  RoadmapGoal,
  FileSummary,
  FileAction,
  ProjectContext,
  AgentSkill,
} from "./types";

// Re-export Spec type from spec-writer (it defines the full interface)
export type { Spec as SpecDocument } from "./spec-writer";

// ─── Utilities (for components) ────────────────────────────────

/** Friendly tool labels for the UI */
export { getToolLabel, PHASE_LABELS } from "./prompts";

/** Per-phase tool sets */
export { getToolsForPhase, getToolNamesForPhase } from "./agent-tools";
export type { SDDPhase } from "./agent-tools";

/** Spec management */
export {
  createDraftSpec,
  saveSpec,
  loadSpec,
  listSpecs,
  specToMarkdown,
} from "./spec-writer";

/** Idea backlog */
export {
  detectIdea,
  createIdea,
  saveIdea,
  searchIdeas,
  getIdeasByStatus,
  updateIdeaStatus,
  matchCompletedWork,
  formatBacklogSummary,
  STATUS_LABELS as IDEA_STATUS_LABELS,
  PRIORITY_LABELS as IDEA_PRIORITY_LABELS,
} from "./idea-backlog";
export type { Idea, IdeaStatus, IdeaPriority } from "./idea-backlog";

/** Project context detection */
export { buildProjectContext } from "./context-loader";

// ─── Components ────────────────────────────────────────────────

export { ExecutionRoadmap } from "@/components/chat/ExecutionRoadmap";
export { AgentStepAccordion } from "@/components/chat/AgentStepAccordion";
