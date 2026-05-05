import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

// ─── Constants ─────────────────────────────────────────────────

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Crea un proveedor de OpenRouter.
 *
 * **BYOK**: el usuario provee su propia API key de OpenRouter.
 * OpenRouter da acceso a 200+ modelos con una sola key.
 *
 * @param apiKey API key de OpenRouter
 * @param model Modelo por defecto (ej: "openai/gpt-4o-mini", "anthropic/claude-3-haiku")
 */
export function createOpenRouterProvider(apiKey?: string, model?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;
  const defaultModel = model ?? DEFAULT_MODEL;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "openrouter",
    name: "OpenRouter",
    tier: "byok",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "OpenRouter no está configurado. Agregá tu API key en Ajustes > Proveedores.",
        };
        return;
      }

      const apiMessages = toApiMessages(messages);
      const model = options?.model ?? defaultModel;

      try {
        let fullContent = "";

        for await (const delta of streamOpenAICompatible(
          OPENROUTER_API_URL,
          {
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": "https://vibe-studio.opita.co",
            "X-Title": "Vibe-Studio",
          },
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
        console.log(
          `[OpenRouter] Tokens generados (estimado): ${tokensUsed}, modelo: ${model}`,
        );

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `OpenRouter error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `OpenRouter error inesperado: ${String(err)}`,
          };
        }
      }
    },

    countTokens,

    validateKey: async (testKey: string): Promise<boolean> => {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
          method: "GET",
          headers: { Authorization: `Bearer ${testKey}` },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  return provider;
}
