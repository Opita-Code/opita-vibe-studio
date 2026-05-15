/**
 * Explore Agent — Research & analysis sub-agent.
 *
 * Master researcher: navigates the project, searches the web,
 * reads documentation, queries memory, and analyzes dependencies.
 *
 * This agent has its OWN tool loop (lighter than BuildAgent)
 * because exploration requires acting on findings:
 * "search → find → read → search deeper → conclude"
 *
 * It NEVER modifies files — read-only access only.
 *
 * Used when:
 * - User asks to understand/analyze code
 * - User asks to compare options or research solutions
 * - User asks to plan/propose changes
 * - Orchestrator needs context before proposing to the user
 */

import type { AgentEvent, AgentStep, SSEChunk } from "./types";
import type { Message } from "@/lib/types";
import { streamSSE, type StreamOptions } from "./stream-client";
import { AURA_SYSTEM_PROMPT, EXPLORE_ADDON, getToolLabel } from "./prompts";
import { executeTool } from "@/tools/executor";
import type { ToolCall } from "@/tools/definitions";

// ─── Constants ──────────────────────────────────────────────────

/** Max iterations — explore is lighter than build */
const MAX_ITERATIONS = 10;

// ─── Types ─────────────────────────────────────────────────────

export interface ExploreAgentConfig {
  providerId: string;
  modelId?: string;
  customApiKey?: string;
  signal?: AbortSignal;
  customInstructions?: string;
  projectSummary?: string;
}

// ─── Agent ─────────────────────────────────────────────────────

/**
 * Runs the explore agent with a lightweight ReAct loop.
 *
 * Unlike the build agent, this one:
 * - Only has read-only tools + web search + memory
 * - No file modifications
 * - No roadmap (it's research, not delivery)
 * - Yields research findings as structured text
 */
export async function* runExploreAgent(
  messages: Message[],
  config: ExploreAgentConfig
): AsyncGenerator<AgentEvent> {
  // ─── System Prompt ──────────────────────────────────────────

  let systemPrompt = `${AURA_SYSTEM_PROMPT}\n${EXPLORE_ADDON}`;

  systemPrompt += `\n\n## Tus capacidades de investigación
Tienes acceso a herramientas especializadas para investigar a fondo:
- **Navegar el proyecto**: leer archivos, buscar código, explorar la estructura
- **Buscar en internet**: documentación, APIs, soluciones, comparaciones
- **Visitar URLs**: leer páginas web, docs de GitHub, artículos técnicos
- **Memoria del proyecto**: buscar y guardar decisiones, patrones, descubrimientos
- **Analizar dependencias**: versiones, vulnerabilidades, alternativas

Usa estas herramientas para dar respuestas COMPLETAS y BIEN FUNDAMENTADAS.
No adivines — investiga primero, luego responde con evidencia.`;

  if (config.projectSummary) {
    systemPrompt += `\n\n## Contexto del proyecto\n${config.projectSummary}`;
  }

  if (config.customInstructions) {
    systemPrompt += `\n\n## Instrucciones del usuario\n${config.customInstructions}`;
  }

  // ─── State ──────────────────────────────────────────────────

  const stepLog: AgentStep[] = [];
  const toolMessages: Message[] = [];
  let iterations = 0;

  yield { type: "phase", phase: "thinking" };
  yield { type: "thinking", message: "Investigando..." };

  // ─── ReAct Loop (lightweight) ───────────────────────────────

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const fullMessages: Message[] = [
      { id: "system", role: "system", content: systemPrompt, timestamp: Date.now() },
      ...messages,
      ...toolMessages,
    ];

    const streamOptions: StreamOptions = {
      providerId: config.providerId,
      modelId: config.modelId,
      customApiKey: config.customApiKey,
      signal: config.signal,
      action: "chat",
      subagentId: "explore",
    };

    let gotToolRequest = false;

    for await (const chunk of streamSSE(fullMessages, streamOptions)) {
      switch (chunk.type) {
        case "text":
          yield { type: "text", content: chunk.content };
          break;

        case "reasoning":
          yield { type: "thinking_visible", content: chunk.content };
          break;

        case "tool_request":
          gotToolRequest = true;
          yield* handleExploreToolRequest(
            chunk,
            stepLog,
            toolMessages
          );
          break;

        case "error":
          yield { type: "error", message: chunk.content };
          break;

        case "done":
          break;
      }
    }

    if (!gotToolRequest) break;
  }

  yield { type: "done", summary: [] };
}

// ─── Tool Handling ─────────────────────────────────────────────

async function* handleExploreToolRequest(
  chunk: SSEChunk & { type: "tool_request" },
  stepLog: AgentStep[],
  toolMessages: Message[]
): AsyncGenerator<AgentEvent> {
  const toolCall: ToolCall = {
    name: chunk.tool,
    args: chunk.args,
  };

  const friendlyLabel = getToolLabel(toolCall.name, toolCall.args);

  const step: AgentStep = {
    id: `explore-step-${Date.now()}-${stepLog.length}`,
    icon: getExploreIcon(toolCall.name),
    label: friendlyLabel,
    status: "running",
    timestamp: Date.now(),
  };

  stepLog.push(step);
  yield { type: "step", step };

  // Execute
  const result = await executeTool(toolCall);

  step.status = result.success ? "done" : "error";
  step.detail = result.success
    ? undefined
    : String(result.error || "Error");
  yield { type: "step", step };

  // Feed result back
  const resultContent = result.success
    ? String(result.result || "OK")
    : `Error: ${result.error}`;

  toolMessages.push({
    id: `explore-result-${Date.now()}`,
    role: "assistant",
    content: `[Investigación: ${toolCall.name}]\n${resultContent}`,
    timestamp: Date.now(),
  });
}

function getExploreIcon(toolName: string): string {
  const icons: Record<string, string> = {
    read_file: "📖",
    list_files: "📁",
    search_code: "🔍",
    web_search: "🌐",
    browse_url: "🔗",
    memory_search: "🧠",
    memory_save: "💾",
    analyze_dependencies: "📦",
  };
  return icons[toolName] || "🔬";
}
