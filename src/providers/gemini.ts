import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamGemini, SseError } from "./sse";

// ─── Constants ─────────────────────────────────────────────────

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.0-flash";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Crea un proveedor de Gemini Flash.
 *
 * **Free tier**: usa la API de Google AI Studio.
 * La API key se obtiene de:
 * 1. Parámetro `apiKey` (para testing)
 * 2. Variable de entorno `VITE_GEMINI_KEY`
 *
 * Si no hay key configurada, el provider existe pero
 * `chat()` devolverá un chunk de error.
 */
export function createGeminiProvider(apiKey?: string): AIProvider {
  const key = apiKey ?? import.meta.env.VITE_GEMINI_KEY ?? "";
  const configured = key.length > 0;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "gemini",
    name: "Gemini Flash",
    tier: "free",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "Gemini no está configurado. Agregá VITE_GEMINI_KEY en el archivo .env",
        };
        return;
      }

      const model = options?.model ?? DEFAULT_MODEL;
      const url = `${GEMINI_API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${key}`;

      // Convertir mensajes internos al formato de Gemini
      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : "user",
        parts: [{ text: m.content }],
      }));

      try {
        let fullContent = "";

        for await (const delta of streamGemini(
          url,
          {}, // Gemini usa query param para la key, no header
          {
            contents,
            generationConfig: {
              maxOutputTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
              temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
            },
          },
        )) {
          fullContent += delta;
          yield { type: "text", content: delta };
        }

        // Log de uso
        const tokensUsed = countTokens([
          { role: "assistant", content: fullContent },
        ] as Message[]);
        console.warn(`[Gemini] Tokens generados (estimado): ${tokensUsed}`);

        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield {
            type: "error",
            content: `Gemini error (${err.status}): ${err.message}`,
          };
        } else {
          yield {
            type: "error",
            content: `Gemini error inesperado: ${String(err)}`,
          };
        }
      }
    },

    countTokens,

    validateKey: async (testKey: string): Promise<boolean> => {
      try {
        const url = `${GEMINI_API_BASE}/models/${DEFAULT_MODEL}?key=${testKey}`;
        const response = await fetch(url);
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  return provider;
}
