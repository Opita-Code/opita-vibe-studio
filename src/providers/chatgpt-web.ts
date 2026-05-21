import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { getValidToken } from "@/lib/chatgpt-auth";

// ─── Codex Responses API Provider ──────────────────────────────
//
// Consumes https://api.openai.com/v1/responses using OAuth tokens
// obtained via the Codex PKCE / Device Code flow.
//
// Uses the same API surface as OpenCode — NOT the legacy
// backend-api/conversation scraping approach.

const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "codex-mini";

export function createChatGPTWebProvider(accessToken?: string): AIProvider {
  const token = accessToken ?? "";
  const configured = token.length > 0;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "chatgpt-web",
    name: "Codex (ChatGPT Plus)",
    tier: "byok",

    chat: async function* (
      messages: Message[],
      options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content:
            "Codex no está conectado. Inicia sesión con tu cuenta de ChatGPT Plus en Configuración → Conexiones IA.",
        };
        return;
      }

      try {
        // Auto-refresh token if expired
        let activeToken: string;
        try {
          activeToken = await getValidToken();
        } catch {
          // Fallback to stored token if refresh fails
          activeToken = token;
        }

        // Build Responses API payload
        const input = messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

        const payload = {
          model: options?.model ?? DEFAULT_MODEL,
          input,
          stream: true,
        };

        // Use tauriFetch in Tauri to avoid CORS, standard fetch in web
        const doFetch =
          typeof window !== "undefined" && "__TAURI__" in window
            ? (await import("@tauri-apps/plugin-http")).fetch
            : globalThis.fetch;

        const response = await doFetch(RESPONSES_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: options?.signal,
        } as RequestInit);

        if (!response.ok) {
          const text = await response.text();

          // Handle specific HTTP errors
          if (response.status === 401) {
            yield {
              type: "error",
              content:
                "Token expirado o inválido. Ve a Configuración → Conexiones IA y reconecta tu cuenta de ChatGPT.",
            };
            return;
          }
          if (response.status === 429) {
            yield {
              type: "error",
              content:
                "Límite de uso alcanzado en tu cuenta de ChatGPT. Espera un momento e intenta de nuevo.",
            };
            return;
          }

          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";

          for (const line of lines) {
            const trimmed = line.trim();

            // SSE event type line
            if (trimmed.startsWith("event: ")) {
              currentEvent = trimmed.slice(7);
              continue;
            }

            // SSE data line
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") {
                yield { type: "done", content: "" };
                return;
              }

              try {
                const data = JSON.parse(dataStr);

                switch (currentEvent) {
                  case "response.output_text.delta":
                    if (data.delta) {
                      yield { type: "text", content: data.delta };
                    }
                    break;

                  case "response.completed":
                    yield { type: "done", content: "" };
                    return;

                  case "response.failed":
                  case "response.incomplete":
                    yield {
                      type: "error",
                      content:
                        data.error?.message ||
                        "La respuesta de Codex fue interrumpida.",
                    };
                    return;

                  // Ignore other event types (created, in_progress, etc.)
                  default:
                    break;
                }
              } catch {
                // Skip unparseable SSE chunks
              }

              currentEvent = "";
            }
          }
        }

        // If we exit the read loop without a done event, close gracefully
        yield { type: "done", content: "" };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return; // User cancelled — not an error
        }
        yield {
          type: "error",
          content: `Error de Codex: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },

    countTokens,

    validateKey: async (testToken: string): Promise<boolean> => {
      try {
        // OAuth access tokens ARE valid OpenAI tokens
        const doFetch =
          typeof window !== "undefined" && "__TAURI__" in window
            ? (await import("@tauri-apps/plugin-http")).fetch
            : globalThis.fetch;

        // P0 Fix: Validate against the correct ChatGPT backend endpoint, not the public API
        const response = await doFetch("https://chatgpt.com/backend-api/accounts/check", {
          headers: { Authorization: `Bearer ${testToken}` },
        } as RequestInit);
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  return provider;
}
