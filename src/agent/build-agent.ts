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

import type { AgentEvent, AgentStep, FileSummary, FileAction, RoadmapGoal, SSEChunk } from "./types";
import type { Message } from "@/lib/types";
import { streamSSE, type StreamOptions } from "./stream-client";
import { getSystemPrompt, getToolLabel } from "./prompts";
import { executeTool } from "@/tools/executor";
import type { ToolCall } from "@/tools/definitions";
import { drainNudges, clearNudges } from "./nudge-channel";
import { RoadmapTracker } from "./roadmap-tracker";

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

  // Tool results are fed back into the conversation for the ReAct loop.
  // Uses a sliding window to prevent unbounded context growth.
  const toolMessages: Message[] = [];

  // ─── Roadmap (dynamic based on task complexity) ──────────────

  const roadmap: RoadmapGoal[] = buildRoadmap(config);
  const tracker = new RoadmapTracker(roadmap);

  yield { type: "phase", phase: "building" };
  yield { type: "roadmap", goals: tracker.getRoadmap() };
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
      // "chat" action — el build-agent usa el mismo endpoint LLM que chat
      // pero con system prompt especializado. El backend gate "subagent"
      // es solo para fases SDD premium (sdd-explore, sdd-propose, etc.)
      action: "chat",
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
            tracker
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
            for (const event of tracker.fail()) {
              yield event;
            }
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

    // ─── Nudge Injection — orientación activa del usuario ────
    // Si el usuario envió mensajes mientras el agente trabajaba,
    // los inyectamos como contexto para que ajuste el rumbo.
    const nudges = drainNudges();
    if (nudges.length > 0) {
      const nudgeContent = nudges
        .map((n) => n.content)
        .join("\n");
      toolMessages.push({
        id: `nudge-${Date.now()}`,
        role: "user",
        content: `[Orientación del usuario durante la ejecución]: ${nudgeContent}\n\nTen esto en cuenta para las siguientes acciones.`,
        timestamp: Date.now(),
      });
      // Actualizar roadmap si el nudge implica nuevos goals
      for (const nudgeText of nudges.map((n) => n.content)) {
        for (const event of tracker.onNudge(nudgeText)) {
          yield event;
        }
      }
      yield {
        type: "text",
        content: `\n\n💬 *Ajustando según tu indicación...*\n`,
      };
    }

    // ─── Interactive Mode: Pause after first analysis ────────
    // After the first iteration the LLM has analyzed the request
    // and proposed a plan. Pause for user confirmation before
    // executing file changes.
    if (iterations === 1 && config.executionMode === "interactive" && accumulatedText.length > 0) {
      yield {
        type: "await_confirmation",
        completedPhase: "thinking",
        nextPhase: "building",
        summary: accumulatedText.slice(0, 200),
      };

      // Poll chatStore for user confirmation (same pattern as pipeline/engine.ts)
      const { useChatStore } = await import("@/stores/chat");
      const waitForConfirmation = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const check = () => {
            const state = useChatStore.getState();
            if (state.pendingConfirmation === null) {
              resolve(true); // User confirmed
            } else if (!state.isStreaming) {
              resolve(false); // User cancelled
            } else {
              setTimeout(check, 200);
            }
          };
          setTimeout(check, 200);
        });
      };

      const confirmed = await waitForConfirmation();
      if (!confirmed) {
        for (const event of tracker.fail()) {
          yield event;
        }
        yield { type: "done", summary: fileSummary };
        return;
      }
    }
  }

  // ─── Done ───────────────────────────────────────────────────
  // Si terminamos por un error que cortó el stream, marcamos error.
  // De lo contrario, marcamos todos los goals como done.
  const completionEvents = consecutiveErrors > 0 ? tracker.fail() : tracker.complete();
  for (const event of completionEvents) {
    yield event;
  }

  if (consecutiveErrors === 0) {
    yield { type: "progress", percent: 100 };
    yield { type: "phase", phase: "verifying" };
  }

  yield { type: "done", summary: fileSummary };

  // Limpiar el canal de nudges al terminar la ejecución
  clearNudges();
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
  tracker: RoadmapTracker
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

  // Smart roadmap update based on actual tool being called
  for (const event of tracker.onToolStart(toolCall.name)) {
    yield event;
  }

  // Execute the tool
  const result = await executeTool(toolCall);

  // Update step status
  step.status = result.success ? "done" : "error";
  step.detail = result.success
    ? undefined
    : String(result.error || "Error desconocido");
  yield { type: "step", step };

  // Emit progress events from tracker
  for (const event of tracker.onToolDone(toolCall.name, result.success)) {
    yield event;
  }

  // Track file changes
  if (result.success) {
    const fileAction = getFileAction(toolCall.name);
    if (fileAction) {
      const path = String(toolCall.args.path || "");
      fileSummary.push({ path, action: fileAction });
      yield { type: "file_changed", path, action: fileAction };
    }
  }

  // Feed result back to the LLM with proper tool result format.
  // The AI SDK expects tool results to include the toolCallId so it
  // can match results to calls in the conversation history.
  const resultContent = result.success
    ? String(result.result || "OK")
    : `Error: ${result.error}`;

  // Tool call message (what the LLM requested)
  // Uses XML-style tags so the LLM treats this as metadata, never echoing it back.
  toolMessages.push({
    id: `tool-call-${chunk.toolCallId}`,
    role: "assistant",
    content: `<tool_use name="${toolCall.name}" id="${chunk.toolCallId}" />`,
    timestamp: Date.now(),
  });

  // Tool result message (what we observed)
  toolMessages.push({
    id: `tool-result-${chunk.toolCallId}`,
    role: "user",
    content: `<tool_result name="${toolCall.name}" id="${chunk.toolCallId}">\n${resultContent}\n</tool_result>`,
    timestamp: Date.now(),
  });

  // Sliding window: trim old tool exchanges to prevent context bloat
  const MAX_TOOL_MESSAGES = 16;
  if (toolMessages.length > MAX_TOOL_MESSAGES) {
    const removed = toolMessages.splice(0, toolMessages.length - MAX_TOOL_MESSAGES);
    // Summarize removed messages so the LLM doesn't lose all context
    const summary = removed.map(m => {
      const match = m.content.match(/(?:tool_use|tool_result)\s+name="(\w+)"/) || m.content.match(/\[tool_(?:call|result): (\w+)\]/);
      return match ? match[1] : 'unknown';
    }).filter((v, i, a) => a.indexOf(v) === i).join(', ');
    toolMessages.unshift({
      id: `tool-summary-${Date.now()}`,
      role: "user",
      content: `[Resumen de herramientas anteriores: se ejecutaron ${summary}. Los resultados detallados fueron procesados exitosamente.]`,
      timestamp: Date.now(),
    });
  }
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
