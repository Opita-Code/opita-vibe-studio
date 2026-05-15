/**
 * Agent System — Core Types
 *
 * Tipos compartidos para el ecosistema de sub-agentes de Vibe Studio.
 * Toda comunicación sub-agente → UI pasa por AgentEvent.
 */

// ─── Agent Phases (internal — user never sees these names) ─────

export type AgentPhase =
  | "thinking"    // Analizando, explorando
  | "planning"    // Generando propuesta
  | "building"    // Ejecutando cambios
  | "verifying"   // Verificando resultado
  | "chatting";   // Conversación libre

export type IntentClass = "chat" | "code" | "explore";

// ─── Execution Mode ────────────────────────────────────────────

export type ExecutionMode = "auto" | "interactive";

// ─── Roadmap ───────────────────────────────────────────────────

export interface RoadmapGoal {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  progress?: number; // 0-100
}

// ─── Agent Steps (visible reasoning) ───────────────────────────

export interface AgentStep {
  id: string;
  icon: string;
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
  timestamp: number;
}

// ─── File Tracking ─────────────────────────────────────────────

export type FileAction = "created" | "modified" | "deleted";

export interface FileSummary {
  path: string;
  action: FileAction;
  linesChanged?: number;
}

// ─── Agent Events (sub-agent → UI communication) ──────────────

export type AgentEvent =
  // Streaming text from LLM
  | { type: "text"; content: string }

  // Friendly status messages ("Revisando tu proyecto...")
  | { type: "thinking"; message: string }

  // Internal phase change (for UI state management only)
  | { type: "phase"; phase: AgentPhase }

  // Sub-agent action visible in reasoning accordion
  | { type: "step"; step: AgentStep }

  // Proposal ready for user review
  | {
      type: "plan_ready";
      plan: string;
      files: string[];
      questions?: string[];
      options?: string[];
    }

  // Pause — wait for user confirmation (interactive mode only)
  | { type: "await_confirmation" }

  // File was created/modified/deleted
  | { type: "file_changed"; path: string; action: FileAction }

  // Roadmap of goals
  | { type: "roadmap"; goals: RoadmapGoal[] }

  // Update a single goal in the roadmap
  | {
      type: "roadmap_update";
      goalId: string;
      status: RoadmapGoal["status"];
      progress?: number;
    }

  // Global progress 0-100
  | { type: "progress"; percent: number }

  // LLM reasoning (collapsible in UI)
  | { type: "thinking_visible"; content: string }

  // Execution complete — final summary
  | { type: "done"; summary: FileSummary[] }

  // Error
  | { type: "error"; message: string };

// ─── SSE Chunks (from stream-client) ──────────────────────────

export type SSEChunk =
  | { type: "text"; content: string }
  | { type: "reasoning"; content: string }
  | { type: "tool_request"; tool: string; args: Record<string, unknown> }
  | { type: "error"; content: string }
  | { type: "done" };

// ─── Tool System ───────────────────────────────────────────────

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ─── Skills ────────────────────────────────────────────────────

export interface AgentSkill {
  id: string;
  name: string;
  commands?: string[];
  patterns?: string[];
  instructions?: string;
  source: "builtin" | "user" | "detected";
}

// ─── Project Context ───────────────────────────────────────────

export interface ProjectContext {
  projectId: string;
  stack: string[];
  testRunner: string | null;
  packageManager: "npm" | "pnpm" | "bun" | "yarn" | null;
  conventions: string[];
  skills: AgentSkill[];
  lastUpdated: number;
}

// ─── Proposal (output of invisible PROPOSE phase) ──────────────

export interface Proposal {
  description: string;
  targetFiles: string[];
  questions: string[];
  options: string[];
}

// ─── Execution Roadmap (output of invisible DESIGN+TASKS) ──────

export interface ExecutionPlan {
  goals: RoadmapGoal[];
}

// ─── Verification Result ───────────────────────────────────────

export interface VerificationResult {
  passed: boolean;
  issues: string[];
}
