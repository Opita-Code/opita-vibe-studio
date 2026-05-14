import type { ChatChunk, ChatOptions, Message, AIProvider } from "@/lib/types";

export function createAnthropicProvider(apiKey?: string): AIProvider {
  const key = apiKey ?? "";
  const configured = key.length > 0;

  return {
    id: "anthropic",
    name: "Anthropic Claude",
    tier: "byok",
    
    async validateKey(key: string): Promise<boolean> {
      return key.startsWith("sk-ant-");
    },

    countTokens(messages: Message[]): number {
      const text = messages.map((m) => m.content).join(" ");
      return Math.ceil(text.length / 4);
    },

    async *chat(
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content: "API Key de Anthropic no configurada.",
        };
        return;
      }

      // Convert messages to Anthropic format
      const systemMessage = messages.find((m) => m.role === "system")?.content || "";
      const conversationMessages = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));

      // Ensure last message is from user and alternating
      // Anthropic requires strictly alternating user/assistant messages, starting with user.
      const validMessages = [];
      let nextRole = "user";
      for (const m of conversationMessages) {
        if (m.role === nextRole) {
          validMessages.push(m);
          nextRole = nextRole === "user" ? "assistant" : "user";
        }
      }

      if (validMessages.length === 0 || validMessages[validMessages.length - 1].role !== "user") {
        validMessages.push({ role: "user", content: "Continúa." });
      }

      const abortController = new AbortController();
      if ((options as any)?.signal) {
        (options as any).signal.addEventListener("abort", () => abortController.abort());
      }

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "anthropic-cors-hack": "true", // Note: Browser usage of Anthropic API often fails due to CORS, but Tauri plugin-http might work.
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: options?.model || "claude-3-haiku-20240307",
            system: systemMessage,
            messages: validMessages,
            max_tokens: options?.maxTokens || 4096,
            temperature: options?.temperature ?? 0.7,
            stream: true,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (!response.body) {
          throw new Error("Respuesta vacía de Anthropic");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;

              try {
                const data = JSON.parse(dataStr);
                if (data.type === "content_block_delta" && data.delta?.text) {
                  yield {
                    type: "text",
                    content: data.delta.text,
                  };
                }
              } catch (e) {
                console.warn("Error parsing Anthropic stream chunk:", e);
              }
            }
          }
        }

        yield {
          type: "done",
          content: "",
        };
      } catch (error: any) {
        if (error.name === "AbortError") {
          console.log("Petición Anthropic abortada");
          return;
        }

        yield {
          type: "error",
          content: `Error con Anthropic: ${error.message || String(error)}`,
        };
      }
    },
  };
}
