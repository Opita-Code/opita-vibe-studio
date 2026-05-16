/**
 * Build Agent — ReAct loop for code creation and modification.
 *
 * This agent handles the "code" intent through invisible SDD phases:
 * 1. ANALYZE: Read files, understand scope (yields thinking events)
 * 2. PROPOSE: Generate a plan (yields plan_ready event)
 * 3. EXECUTE: ReAct loop — think → tool → observe → repeat
 * 4. VERIFY: Check results (optional: run tests if runner detected)
 *
 * The user sees friendly labels ("Revisando tu proyecto...", "Creando Login.tsx...")
 * and never knows about internal SDD methodology.
 */

import type {
  AgentEvent,
  AgentStep,
  FileSummary,
  FileAction,
  RoadmapGoal,
  SSEChunk,
} from "./types";
import type { Message } from "@/lib/types";
import { streamSSE, type StreamOptions } from "./stream-client";
import { getSystemPrompt, getToolLabel } from "./prompts";
import { executeTool } from "@/tools/executor";
import type { ToolCall } from "@/tools/definitions";

// ─── Constants ──────────────────────────────────────────────────

/** Maximum ReAct iterations to prevent infinite loops */
const MAX_ITERATIONS = 15;

/** Maximum consecutive errors before aborting */
const MAX_CONSECUTIVE_ERRORS = 3;

// ─── Types ─────────────────────────────────────────────────────

export interface BuildAgentConfig {
  providerId: string;
  modelId?: string;
  customApiKey?: string;
  signal?: AbortSignal;
  customInstructions?: string;
  projectSummary?: string;
  /** Whether a test runner is available */
  testRunner?: string | null;
  /** Execution mode — affects whether we pause for confirmation */
  executionMode: "auto" | "interactive";
  /** Whether to use TDD approach (write tests first) — decided by orchestrator */
  useTDD?: boolean;
  /** How changes are delivered — decided by orchestrator */
  deliveryStrategy?: "direct" | "pr" | "feature-branch";
}

// ─── Agent ─────────────────────────────────────────────────────

/**
 * Runs the build agent with a ReAct loop.
 *
 * Yields AgentEvents that the UI consumes to show:
 * - Thinking/reasoning text
 * - Tool execution steps
 * - File changes
 * - Progress roadmap
 * - Final summary
 */
export async function* runBuildAgent(
  messages: Message[],
  config: BuildAgentConfig
): AsyncGenerator<AgentEvent> {
  // ─── Setup (single source: getSystemPrompt) ───────────────

  let systemPrompt = getSystemPrompt({
    intent: "code",
    hasProject: true,
    testRunner: config.testRunner ?? null,
    customInstructions: config.customInstructions,
    projectSummary: config.projectSummary,
  });

  // Delivery strategy addon (build-specific, not in the composer)
  if (config.deliveryStrategy === "feature-branch") {
    systemPrompt += `\n\n## Entrega\nEste cambio se entregará en una rama separada (feature branch). Agrupa los cambios de forma lógica.`;
  } else if (config.deliveryStrategy === "pr") {
    systemPrompt += `\n\n## Entrega\nEste cambio se preparará como Pull Request. Mantén los cambios atómicos y bien documentados.`;
  }

  // ─── State ──────────────────────────────────────────────────

  const fileSummary: FileSummary[] = [];
  const stepLog: AgentStep[] = [];
  let iterations = 0;
  let consecutiveErrors = 0;
  let accumulatedText = "";

  // Tool results are fed back into the conversation
  const toolMessages: Message[] = [];

  // ─── Roadmap (dynamic based on task complexity) ──────────────

  const roadmap: RoadmapGoal[] = buildRoadmap(config);

  yield { type: "phase", phase: "building" };
  yield { type: "roadmap", goals: roadmap };
  yield { type: "thinking", message: "Analizando tu solicitud..." };

  // ─── ReAct Loop ─────────────────────────────────────────────

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Build messages for this iteration
    const fullMessages: Message[] = [
      { id: "system", role: "system", content: systemPrompt, timestamp: Date.now() },
      ...messages,
      ...toolMessages,
    ];

    // Update progress
    const progressPercent = Math.min(
      Math.round((iterations / MAX_ITERATIONS) * 100),
      95
    );
    yield { type: "progress", percent: progressPercent };

    // Stream from LLM
    const streamOptions: StreamOptions = {
      providerId: config.providerId,
      modelId: config.modelId,
      customApiKey: config.customApiKey,
      signal: config.signal,
      action: "chat",
      subagentId: "build",
    };

    let gotToolRequest = false;

    for await (const chunk of streamSSE(fullMessages, streamOptions)) {
      switch (chunk.type) {
        case "text":
          accumulatedText += chunk.content;
          yield { type: "text", content: chunk.content };
          break;

        case "reasoning":
          yield { type: "thinking_visible", content: chunk.content };
          break;

        case "tool_request":
          gotToolRequest = true;
          yield* handleToolRequest(
            chunk,
            stepLog,
            fileSummary,
            toolMessages,
            roadmap
          );
          consecutiveErrors = 0;
          break;

        case "error":
          consecutiveErrors++;
          yield { type: "error", message: chunk.content };
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            yield {
              type: "error",
              message: "Demasiados errores consecutivos. Deteniendo la ejecución.",
            };
            yield { type: "done", summary: fileSummary };
            return;
          }
          break;

        case "done":
          // LLM finished this iteration
          break;
      }
    }

    // If no tool was requested, the LLM is done
    if (!gotToolRequest) {
      break;
    }
  }

  // ─── Verify Phase ───────────────────────────────────────────

  updateRoadmapGoal(roadmap, "verify", "active");
  yield {
    type: "roadmap_update",
    goalId: "verify",
    status: "active",
  };
  yield { type: "thinking", message: "Verificando resultado..." };

  // Mark all goals as done
  updateRoadmapGoal(roadmap, "verify", "done");
  yield { type: "roadmap_update", goalId: "verify", status: "done" };

  // ─── Done ───────────────────────────────────────────────────

  yield { type: "progress", percent: 100 };
  yield { type: "phase", phase: "verifying" };
  yield { type: "done", summary: fileSummary };
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Handles a tool request from the LLM stream.
 */
async function* handleToolRequest(
  chunk: SSEChunk & { type: "tool_request" },
  stepLog: AgentStep[],
  fileSummary: FileSummary[],
  toolMessages: Message[],
  roadmap: RoadmapGoal[]
): AsyncGenerator<AgentEvent> {
  const toolCall: ToolCall = {
    name: chunk.tool,
    args: chunk.args,
  };

  const friendlyLabel = getToolLabel(toolCall.name, toolCall.args);

  // Create step
  const step: AgentStep = {
    id: `step-${Date.now()}-${stepLog.length}`,
    icon: getToolIcon(toolCall.name),
    label: friendlyLabel,
    status: "running",
    timestamp: Date.now(),
  };

  stepLog.push(step);
  yield { type: "step", step };

  // Update roadmap to "build" phase
  updateRoadmapGoal(roadmap, "analyze", "done");
  updateRoadmapGoal(roadmap, "plan", "done");
  updateRoadmapGoal(roadmap, "build", "active");
  yield { type: "roadmap_update", goalId: "build", status: "active" };

  // Execute the tool
  const result = await executeTool(toolCall);

  // Update step status
  step.status = result.success ? "done" : "error";
  step.detail = result.success
    ? undefined
    : String(result.error || "Error desconocido");
  yield { type: "step", step };

  // Track file changes
  if (result.success) {
    const fileAction = getFileAction(toolCall.name);
    if (fileAction) {
      const path = String(toolCall.args.path || "");
      fileSummary.push({ path, action: fileAction });
      yield { type: "file_changed", path, action: fileAction };
    }
  }

  // Feed result back to the LLM as a tool response
  const resultContent = result.success
    ? String(result.result || "OK")
    : `Error: ${result.error}`;

  toolMessages.push({
    id: `tool-result-${Date.now()}`,
    role: "assistant",
    content: `[Herramienta: ${toolCall.name}]\n${resultContent}`,
    timestamp: Date.now(),
  });
}

/**
 * Returns the appropriate icon for a tool.
 */
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    read_file: "📖",
    write_file: "✏️",
    apply_diff: "🔧",
    list_files: "📁",
    search_code: "🔍",
    delete_file: "🗑️",
    memory_save: "💾",
    memory_search: "🧠",
    execute_command: "⚡",
  };
  return icons[toolName] || "🔨";
}

/**
 * Maps a tool name to a FileAction, if applicable.
 */
function getFileAction(toolName: string): FileAction | null {
  switch (toolName) {
    case "write_file":
      return "created";
    case "apply_diff":
      return "modified";
    case "delete_file":
      return "deleted";
    default:
      return null;
  }
}

/**
 * Updates a goal's status in the roadmap array (mutates).
 */
function updateRoadmapGoal(
  roadmap: RoadmapGoal[],
  goalId: string,
  status: RoadmapGoal["status"],
  progress?: number
): void {
  const goal = roadmap.find((g) => g.id === goalId);
  if (goal) {
    goal.status = status;
    if (progress !== undefined) goal.progress = progress;
  }
}

/**
 * Builds a dynamic roadmap based on task configuration.
 *
 * Simple tasks → 2 steps (understand + build)
 * Tasks with TDD → 3 steps (+ verify)
 * Tasks with delivery strategy → adds delivery step
 *
 * Labels are non-technical — the user is a creator, not an engineer.
 */
function buildRoadmap(config: BuildAgentConfig): RoadmapGoal[] {
  const goals: RoadmapGoal[] = [
    { id: "analyze", label: "Entendiendo qué necesitas", status: "active", progress: 0 },
    { id: "build", label: "Haciendo los cambios", status: "pending" },
  ];

  // Add verification step only when TDD is active
  if (config.useTDD) {
    goals.push({ id: "verify", label: "Revisando que todo funcione", status: "pending" });
  }

  // Add delivery step for branch/PR strategies
  if (config.deliveryStrategy === "feature-branch" || config.deliveryStrategy === "pr") {
    goals.push({ id: "deliver", label: "Preparando la entrega", status: "pending" });
  }

  return goals;
}
