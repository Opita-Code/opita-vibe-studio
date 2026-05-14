import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const DEFAULT_MODEL = "llama-3-sonar-large-32k-online";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

export function createPerplexityProvider(apiKey?: string, model?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;
  const defaultModel = model ?? DEFAULT_MODEL;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "perplexity",
    name: "Perplexity",
    tier: "byok",

    chat: async function* (messages: Message[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield { type: "error", content: "Perplexity no configurado." };
        return;
      }
      const apiMessages = toApiMessages(messages);
      const m = options?.model ?? defaultModel;

      try {
        let fullContent = "";
        for await (const delta of streamOpenAICompatible(
          PERPLEXITY_API_URL,
          { Authorization: `Bearer ${key}` },
          {
            model: m,
            messages: apiMessages,
            max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
            temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          },
        )) {
          fullContent += delta;
          yield { type: "text", content: delta };
        }
        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof SseError) {
          yield { type: "error", content: `Perplexity error (${err.status}): ${err.message}` };
        } else {
          yield { type: "error", content: `Perplexity error inesperado: ${String(err)}` };
        }
      }
    },
    countTokens,
    validateKey: async (testKey: string): Promise<boolean> => {
      // Perplexity API is somewhat strict about testing. We can try models or simply assume true for MVP if models endpoint doesn't exist.
      return testKey.length > 10;
    },
  };
  return provider;
}
