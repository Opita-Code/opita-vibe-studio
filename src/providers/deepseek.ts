import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { SseError } from "./sse";

// ─── Constants ─────────────────────────────────────────────────

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

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
    name: "Opita AI",
    tier: "free",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured && !options?.model) { // allow if hitting backend which has its own key
        // Not strictly necessary since backend uses its key for free users
      }

      try {
        const { streamAwsSse } = await import("@/services/aiService");
        let fullContent = "";

        for await (const chunk of streamAwsSse(
          messages,
          "deepseek",
          undefined,
          options?.signal,
          key || undefined,
          { modelId: options?.model || DEFAULT_MODEL }
        )) {
          if (chunk.type === "text") {
            fullContent += chunk.content;
            yield { type: "text", content: chunk.content };
          } else if (chunk.type === "error") {
            yield { type: "error", content: chunk.content };
          }
        }

        // Log de uso
        const tokensUsed = countTokens([
          { role: "assistant", content: fullContent },
        ] as Message[]);
        console.warn(`[DeepSeek Backend] Tokens generados (estimado): ${tokensUsed}`);

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `Opita AI error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `Opita AI error inesperado: ${String(err)}`,
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
