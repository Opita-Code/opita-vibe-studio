import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

// ─── Constants ─────────────────────────────────────────────────

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

// Modelos disponibles para OpenAI
const OPENAI_MODELS = [
  { id: "gpt-4o-mini", name: "GPT-4o Mini", maxTokens: 16_384, temperature: 0.7 },
  { id: "gpt-4o", name: "GPT-4o", maxTokens: 16_384, temperature: 0.7 },
];

/**
 * Crea un proveedor de OpenAI.
 *
 * **BYOK**: el usuario provee su propia API key.
 * Se pasa explícitamente al crear el provider (no usa env vars).
 *
 * @param apiKey API key de OpenAI (sk-...)
 * @param model Modelo por defecto (opcional)
 */
export function createOpenAIProvider(apiKey?: string, model?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;
  const defaultModel = model ?? DEFAULT_MODEL;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "openai",
    name: "OpenAI",
    tier: "byok",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "OpenAI no está configurado. Agregá tu API key en Ajustes > Proveedores.",
        };
        return;
      }

      const apiMessages = toApiMessages(messages);
      const model = options?.model ?? defaultModel;

      try {
        let fullContent = "";

        for await (const delta of streamOpenAICompatible(
          OPENAI_API_URL,
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
          `[OpenAI] Tokens generados (estimado): ${tokensUsed}, modelo: ${model}`,
        );

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `OpenAI error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `OpenAI error inesperado: ${String(err)}`,
          };
        }
      }
    },

    countTokens,

    validateKey: async (testKey: string): Promise<boolean> => {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
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

/** Lista de modelos disponibles para OpenAI. */
export function getOpenAIModels(): {
  id: string;
  name: string;
  maxTokens: number;
  temperature: number;
}[] {
  return OPENAI_MODELS;
}
