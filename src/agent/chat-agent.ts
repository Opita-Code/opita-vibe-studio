/**
 * Chat Agent — streaming agent for conversation, exploration, and light
 * preview/editor interaction.
 *
 * Evolución del agente original (streaming puro): ahora tiene un ReAct loop
 * ligero que permite al LLM usar tools del frontend:
 *   - read_file / list_files / search_code  (leer el proyecto)
 *   - write_file / apply_diff / delete_file (modificar archivos)
 *   - preview_component / refresh_preview   (interactuar con VibeLens)
 *   - memory_save / dark_memory_*           (memoria persistente)
 *
 * El loop es limitado (MAX_ITERATIONS=5) y NO ejecuta comandos de shell:
 * el chat sigue siendo conversacional, pero ahora puede "hacer" cosas en
 * el preview y el editor — la promesa de "muéstrame cómo se vería".
 */

import type { AgentEvent, AgentStep, SSEChunk } from "./types";
import type { Message, PersonaId } from "@/lib/types";
import { streamSSE, type StreamOptions } from "./stream-client";
import { getSystemPrompt, getToolLabel } from "./prompts";
import { executeTool } from "@/tools/executor";
import type { ToolCall } from "@/tools/definitions";
import { useChatStore, type ResearchStatus } from "@/stores/chat";

// ─── Constants ──────────────────────────────────────────────────

/** Max ReAct iterations — chat is light, keep it bounded */
const MAX_ITERATIONS = 5;

/** Max consecutive errors before aborting */
const MAX_CONSECUTIVE_ERRORS = 2;

/** Mapea tools de documentación a su estado para el indicador visual. */
const RESEARCH_TOOL_STATUS: Record<string, ResearchStatus> = {
  docs_search: "searching",
  docs_fetch: "fetching",
  code_search: "code",
  cve_check: "cve",
  synthesis: "synthesizing",
};

// ─── Types ─────────────────────────────────────────────────────

export interface ChatAgentConfig {
  intent: "chat" | "explore";
  providerId: string;
  modelId?: string;
  customApiKey?: string;
  signal?: AbortSignal;
  customInstructions?: string;
  /** Optional project summary to inject as context */
  projectSummary?: string;
  /** Active persona ID */
  persona?: PersonaId;
  /** Custom persona prompt */
  customPersonaPrompt?: string;
  /** Memories recuperadas de dark-memory (markdown ya formateado) */
  memoryContext?: string;
}

// ─── Agent ─────────────────────────────────────────────────────

/**
 * Runs the chat agent with a light ReAct loop.
 *
 * Streams LLM response and yields AgentEvents that the UI can consume.
 * Handles tool_requests (read/write/preview) with results fed back to the
 * LLM for follow-up — bounded to prevent runaway loops.
 */
export async function* runChatAgent(
  messages: Message[],
  config: ChatAgentConfig
): AsyncGenerator<AgentEvent> {
  const systemPrompt = getSystemPrompt({
    intent: config.intent === "explore" ? "explore" : "chat",
    hasProject: !!config.projectSummary,
    testRunner: null,
    customInstructions: config.customInstructions,
    projectSummary: config.projectSummary,
    persona: config.persona,
    customPersonaPrompt: config.customPersonaPrompt,
    memoryContext: config.memoryContext,
  });

  const stepLog: AgentStep[] = [];
  const toolMessages: Message[] = [];
  let iterations = 0;
  let consecutiveErrors = 0;

  // Signal phase
  yield { type: "phase", phase: "chatting" };
  yield { type: "thinking", message: "Pensando..." };

  // ─── Light ReAct Loop ────────────────────────────────────────
  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const fullMessages: Message[] = [
      { id: "system", role: "system", content: systemPrompt, timestamp: Date.now() },
      ...messages,
      ...toolMessages,
    ];

    let gotToolRequest = false;

    const streamOptions: StreamOptions = {
      providerId: config.providerId,
      modelId: config.modelId,
      customApiKey: config.customApiKey,
      signal: config.signal,
      action: "chat",
    };

    for await (const chunk of streamSSE(fullMessages, streamOptions)) {
      const event = mapChunkToEvent(chunk);
      if (event) {
        if (event.type === "tool_request") {
          gotToolRequest = true;
          yield* handleChatToolRequest(event.chunk, stepLog, toolMessages);
          consecutiveErrors = 0;
        } else if (event.type === "error") {
          consecutiveErrors++;
          yield event;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            yield {
              type: "error",
              message: "Demasiados errores consecutivos. Deteniendo la conversación.",
            };
            return;
          }
        } else {
          yield event;
        }
      }
    }

    // If no tool was requested, the LLM is done
    if (!gotToolRequest) break;
  }

  // Done
  yield { type: "done", summary: [] };
}

// ─── Tool Handling ──────────────────────────────────────────────

/**
 * Executes a frontend tool and feeds the result back to the LLM.
 * Emits a step event so the UI shows the tool activity.
 */
async function* handleChatToolRequest(
  chunk: SSEChunk & { type: "tool_request" },
  stepLog: AgentStep[],
  toolMessages: Message[],
): AsyncGenerator<AgentEvent> {
  const toolCall: ToolCall = {
    name: chunk.tool,
    args: chunk.args,
  };

  const friendlyLabel = getToolLabel(toolCall.name, toolCall.args);

  // Signal research status for OSINT tools (visual indicator in UI)
  const researchStatus = RESEARCH_TOOL_STATUS[toolCall.name];
  if (researchStatus) {
    useChatStore.getState().setResearchStatus(researchStatus);
  }

  // Create step (visible in the reasoning accordion)
  const step: AgentStep = {
    id: `chat-step-${Date.now()}-${stepLog.length}`,
    icon: getToolIcon(toolCall.name),
    label: friendlyLabel,
    status: "running",
    timestamp: Date.now(),
  };
  stepLog.push(step);
  yield { type: "step", step };

  // Execute the tool (frontend executor — store/Sandpack/dark-memory)
  const result = await executeTool(toolCall);

  // Clear research status after the OSINT tool finishes
  if (researchStatus) {
    useChatStore.getState().setResearchStatus(null);
  }

  // Update step status
  step.status = result.success ? "done" : "error";
  step.detail = result.success
    ? undefined
    : String(result.error || "Error desconocido");
  yield { type: "step", step };

  // Emit file changes if any
  if (result.success) {
    const fileAction = getFileAction(toolCall.name);
    if (fileAction) {
      const path = String(toolCall.args.path || "");
      yield { type: "file_changed", path, action: fileAction };
    }
  }

  // Feed result back to the LLM (ReAct): XML-style tags so the model
  // treats this as metadata, never echoing it to the user.
  const resultContent = result.success
    ? String(result.result || "OK")
    : `Error: ${result.error}`;

  toolMessages.push({
    id: `tool-call-${chunk.toolCallId}`,
    role: "assistant",
    content: `<tool_use name="${toolCall.name}" id="${chunk.toolCallId}" />`,
    timestamp: Date.now(),
  });

  toolMessages.push({
    id: `tool-result-${chunk.toolCallId}`,
    role: "user",
    content: `<tool_result name="${toolCall.name}" id="${chunk.toolCallId}">\n${resultContent}\n</tool_result>`,
    timestamp: Date.now(),
  });

  // Sliding window: trim old tool exchanges to prevent context bloat
  const MAX_TOOL_MESSAGES = 12;
  if (toolMessages.length > MAX_TOOL_MESSAGES) {
    const removed = toolMessages.splice(0, toolMessages.length - MAX_TOOL_MESSAGES);
    const summary = removed.map((m) => {
      const match = m.content.match(/(?:tool_use|tool_result)\s+name="(\w+)"/) || m.content.match(/\[tool_(?:call|result): (\w+)\]/);
      return match ? match[1] : "unknown";
    }).filter((v, i, a) => a.indexOf(v) === i).join(", ");
    toolMessages.unshift({
      id: `tool-summary-${Date.now()}`,
      role: "user",
      content: `[Resumen de herramientas anteriores: se ejecutaron ${summary}. Los resultados detallados fueron procesados exitosamente.]`,
      timestamp: Date.now(),
    });
  }
}

/**
 * Maps a file-affecting tool name to its FileAction.
 */
function getFileAction(toolName: string): "created" | "modified" | "deleted" | null {
  switch (toolName) {
    case "write_file":
      return "modified";
    case "apply_diff":
      return "modified";
    case "delete_file":
      return "deleted";
    case "refresh_preview":
    case "preview_component":
      return null;
    default:
      return null;
  }
}

/**
 * Returns the icon for a tool (visible in the reasoning accordion).
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
    dark_memory_agent_memory_save: "💾",
    dark_memory_agent_memory_recall: "🧠",
    preview_component: "🖥️",
    refresh_preview: "🔄",
    docs_search: "🌐",
    docs_fetch: "📥",
    code_search: "📦",
    cve_check: "🛡️",
    synthesis: "🧪",
  };
  return icons[toolName] || "🔨";
}

/**
 * Maps an SSE chunk to an AgentEvent (or a special tool_request wrapper).
 * Returns null for chunks that should be silently consumed.
 */
function mapChunkToEvent(
  chunk: SSEChunk,
): AgentEvent | { type: "tool_request"; chunk: SSEChunk & { type: "tool_request" } } | null {
  switch (chunk.type) {
    case "text":
      return { type: "text", content: chunk.content };

    case "reasoning":
      return { type: "thinking_visible", content: chunk.content };

    case "error":
      return { type: "error", message: chunk.content };

    case "tool_request":
      // Chat agent now handles tool requests (frontend tools).
      return { type: "tool_request", chunk };

    case "done":
      return null;

    default:
      return null;
  }
}
