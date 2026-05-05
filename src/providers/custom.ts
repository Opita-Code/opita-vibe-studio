import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

// ─── Constants ─────────────────────────────────────────────────

const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Crea un proveedor para cualquier endpoint compatible con OpenAI.
 *
 * **BYOK**: el usuario provee la URL base y API key.
 * Útil para: LM Studio, Ollama, vLLM, Together AI, Groq, etc.
 *
 * @param baseUrl URL base del endpoint (ej: "https://api.groq.com/openai/v1")
 * @param apiKey API key del endpoint
 * @param model Modelo por defecto
 */
export function createCustomProvider(
  baseUrl?: string,
  apiKey?: string,
  model?: string,
): AIProvider {
  const url = baseUrl ?? "";
  const key = apiKey ?? "";
  const configured = url.length > 0 && key.length > 0;
  const defaultModel = model ?? "custom-model";

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "custom",
    name: "Endpoint Personalizado",
    tier: "byok",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "Endpoint personalizado no está configurado. Configurá la URL y API key en Ajustes > Proveedores.",
        };
        return;
      }

      // Construir URL de chat completions
      const chatUrl = `${url.replace(/\/$/, "")}/chat/completions`;
      const apiMessages = toApiMessages(messages);
      const model = options?.model ?? defaultModel;

      try {
        let fullContent = "";

        for await (const delta of streamOpenAICompatible(
          chatUrl,
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
        console.log(
          `[Custom] Tokens generados (estimado): ${tokensUsed}, endpoint: ${url}`,
        );

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `Endpoint personalizado error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `Endpoint personalizado error inesperado: ${String(err)}`,
          };
        }
      }
    },

    countTokens,

    validateKey: async (testKey: string): Promise<boolean> => {
      try {
        const modelsUrl = `${url.replace(/\/$/, "")}/models`;
        const response = await fetch(modelsUrl, {
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
