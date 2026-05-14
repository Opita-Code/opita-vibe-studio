import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";

export function createCohereProvider(apiKey?: string, model?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;
  const defaultModel = model ?? "command-r-plus";

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "cohere",
    name: "Cohere",
    tier: "byok",

    chat: async function* (messages: Message[], options?: ChatOptions): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield { type: "error", content: "Cohere no configurado." };
        return;
      }
      
      const m = options?.model ?? defaultModel;

      // Cohere uses a slightly different format, but we will adapt it.
      const chatHistory = messages.filter(msg => msg.role !== "system").map(msg => ({
        role: msg.role === "user" ? "USER" : "CHATBOT",
        message: msg.content
      }));
      
      const systemMsg = messages.find(msg => msg.role === "system")?.content;
      const lastUserMsg = chatHistory.pop()?.message || "Continúa";

      try {
        const response = await fetch("https://api.cohere.ai/v1/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`
          },
          body: JSON.stringify({
            model: m,
            message: lastUserMsg,
            chat_history: chatHistory,
            preamble: systemMsg,
            stream: true,
            temperature: options?.temperature ?? 0.3
          })
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Error ${response.status}: ${err}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);
              if (data.event_type === "text-generation" && data.text) {
                yield { type: "text", content: data.text };
              }
            } catch (e) {
              // Ignore parse errors on partial chunks
            }
          }
        }
        
        yield { type: "done", content: "" };
      } catch (err) {
        yield { type: "error", content: `Cohere error: ${String(err)}` };
      }
    },
    countTokens,
    validateKey: async (testKey: string): Promise<boolean> => {
      try {
        const response = await fetch("https://api.cohere.ai/v1/models", {
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
