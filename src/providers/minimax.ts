import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

// ─── Constants ─────────────────────────────────────────────────
//
// MiniMax — endpoint OpenAI-compatible (fuente primaria 2026-08-03:
// https://platform.minimax.io/docs/guides/text-generation).
// Modelos óptimos por tarea:
//   - MiniMax-M3            → agéntico, coding, tool-use, 1M contexto (premium)
//   - MiniMax-M2.5-highspeed → ~100 tps, tareas rápidas (flash)
//   - MiniMax-M2.5           → ~60 tps, mejor costo/valor (balance)
const MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const DEFAULT_MODEL = "MiniMax-M3";
const DEFAULT_MAX_TOKENS = 8192;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Crea un proveedor de MiniMax.
 *
 * **BYOK**: el usuario provee su propia API key de MiniMax
 * (token plan: https://platform.minimax.io/subscribe/token-plan).
 *
 * @param apiKey API key de MiniMax
 * @param model Modelo por defecto (ej: "MiniMax-M3")
 */
export function createMiniMaxProvider(apiKey?: string, model?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;
  const defaultModel = model ?? DEFAULT_MODEL;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "minimax",
    name: "MiniMax",
    tier: "byok",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "MiniMax no está configurado. Agregá tu API key en Ajustes > Proveedores.",
        };
        return;
      }

      const apiMessages = toApiMessages(messages);
      const model = options?.model ?? defaultModel;

      try {
        let fullContent = "";

        for await (const delta of streamOpenAICompatible(
          MINIMAX_API_URL,
          { Authorization: `Bearer ${key}` },
          {
            model,
            messages: apiMessages,
            max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
            temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          },
        )) {
          fullContent += delta;
          yield { type: "text", content: delta };
        }

        const tokensUsed = countTokens([
          { role: "assistant", content: fullContent },
        ] as Message[]);
        console.warn(
          `[MiniMax] Tokens generados (estimado): ${tokensUsed}, modelo: ${model}`,
        );

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `MiniMax error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `MiniMax error inesperado: ${String(err)}`,
          };
        }
      }
    },

    countTokens,

    validateKey: async (testKey: string): Promise<boolean> => {
      // MiniMax no expone un endpoint público de validación de key sin costo;
      // la heurística es la misma que Together AI (BYOK keys ≥ 10 chars).
      return testKey.length > 10;
    },
  };

  return provider;
}
