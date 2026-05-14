import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { streamOpenAICompatible, SseError } from "./sse";
import { toApiMessages } from "./types";

const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3-70b-chat-hf";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

export function createTogetherProvider(apiKey?: string, model?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;
  const defaultModel = model ?? DEFAULT_MODEL;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "together",
    name: "Together AI",
    tier: "byok",

    chat: async function* (messages: Message[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield { type: "error", content: "Together AI no configurado." };
        return;
      }
      const apiMessages = toApiMessages(messages);
      const m = options?.model ?? defaultModel;

      try {
        let fullContent = "";
        for await (const delta of streamOpenAICompatible(
          TOGETHER_API_URL,
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
          yield { type: "error", content: `Together AI error (${err.status}): ${err.message}` };
        } else {
          yield { type: "error", content: `Together AI error inesperado: ${String(err)}` };
        }
      }
    },
    countTokens,
    validateKey: async (testKey: string): Promise<boolean> => {
      return testKey.length > 10;
    },
  };
  return provider;
}
