/**
 * Chat Agent — Simple streaming agent for conversation and exploration.
 *
 * This agent has ONE job: stream LLM responses back to the UI.
 * No tool loops, no file modifications. Just conversation.
 *
 * Used for:
 * - Free conversation (chat intent)
 * - Code explanation (explore intent)
 * - Inline code examples
 */

import type { AgentEvent, SSEChunk } from "./types";
import type { Message, PersonaId } from "@/lib/types";
import { streamSSE, type StreamOptions } from "./stream-client";
import { getSystemPrompt } from "./prompts";
import type { IntentClass } from "./types";

// ─── Types ─────────────────────────────────────────────────────

export interface ChatAgentConfig {
  intent: IntentClass;
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
}

// ─── Agent ─────────────────────────────────────────────────────

/**
 * Runs the chat agent.
 *
 * Streams LLM response and yields AgentEvents that the UI can consume.
 * This is a thin layer over streamSSE with proper event mapping.
 */
export async function* runChatAgent(
  messages: Message[],
  config: ChatAgentConfig
): AsyncGenerator<AgentEvent> {
  // Build system prompt (single source: getSystemPrompt)
  const systemPrompt = getSystemPrompt({
    intent: config.intent === "explore" ? "explore" : "chat",
    hasProject: !!config.projectSummary,
    testRunner: null,
    customInstructions: config.customInstructions,
    projectSummary: config.projectSummary,
    persona: config.persona,
    customPersonaPrompt: config.customPersonaPrompt,
  });

  // Prepend system message
  const fullMessages: Message[] = [
    { id: "system", role: "system", content: systemPrompt, timestamp: Date.now() },
    ...messages,
  ];

  // Signal phase
  yield { type: "phase", phase: "chatting" };
  yield { type: "thinking", message: "Pensando..." };

  // Stream
  const streamOptions: StreamOptions = {
    providerId: config.providerId,
    modelId: config.modelId,
    customApiKey: config.customApiKey,
    signal: config.signal,
    customInstructions: config.customInstructions,
    action: "chat",
  };

  let hasYieldedText = false;

  for await (const chunk of streamSSE(fullMessages, streamOptions)) {
    const event = mapChunkToEvent(chunk);
    if (event) {
      if (event.type === "text" && !hasYieldedText) {
        hasYieldedText = true;
      }
      yield event;
    }
  }

  // Done
  yield { type: "done", summary: [] };
}

/**
 * Maps an SSE chunk to an AgentEvent.
 * Returns null for chunks that should be silently consumed.
 */
function mapChunkToEvent(chunk: SSEChunk): AgentEvent | null {
  switch (chunk.type) {
    case "text":
      return { type: "text", content: chunk.content };

    case "reasoning":
      return { type: "thinking_visible", content: chunk.content };

    case "error":
      return { type: "error", message: chunk.content };

    case "tool_request":
      // Chat agent doesn't handle tool requests — ignore them
      return null;

    case "done":
      // Handled externally
      return null;

    default:
      return null;
  }
}
