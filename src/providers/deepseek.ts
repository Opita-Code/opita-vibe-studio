import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

// ─── Constants ─────────────────────────────────────────────────

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Crea un proveedor de DeepSeek V3.
 *
 * **Free tier**: usa la API oficial de DeepSeek.
 * La API key se obtiene de:
 * 1. Parámetro `apiKey` (para testing / BYOK derivative)
 * 2. Variable de entorno `VITE_DEEPSEEK_KEY`
 *
 * Si no hay key configurada, el provider existe pero
 * `chat()` devolverá un chunk de error indicando que
 * no está configurado.
 */
export function createDeepSeekProvider(apiKey?: string): AIProvider {
  const key = apiKey ?? import.meta.env.VITE_DEEPSEEK_KEY ?? "";
  const configured = key.length > 0;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "deepseek",
    name: "DeepSeek V3",
    tier: "free",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "DeepSeek no está configurado. Agregá VITE_DEEPSEEK_KEY en el archivo .env",
        };
        return;
      }

      const apiMessages = toApiMessages(messages);
      const model = options?.model ?? DEFAULT_MODEL;

      try {
        let fullContent = "";

        for await (const delta of streamOpenAICompatible(
          DEEPSEEK_API_URL,
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

        // Log de uso
        const tokensUsed = countTokens([
          { role: "assistant", content: fullContent },
        ] as Message[]);
        console.log(`[DeepSeek] Tokens generados (estimado): ${tokensUsed}`);

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `DeepSeek error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `DeepSeek error inesperado: ${String(err)}`,
          };
        }
      }
    },

    countTokens,

    validateKey: async (testKey: string): Promise<boolean> => {
      try {
        const response = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${testKey}`,
          },
          body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages: [{ role: "user", content: "test" }],
            max_tokens: 1,
            stream: false,
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  return provider;
}
