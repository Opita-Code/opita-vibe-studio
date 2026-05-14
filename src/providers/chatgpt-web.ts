import type { AIProvider, ChatChunk, ChatOptions, Message } from "@/lib/types";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// Generador simple de UUID v4 para los IDs de mensajes de ChatGPT
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createChatGPTWebProvider(sessionToken?: string): AIProvider {
  const token = sessionToken ?? "";
  const configured = token.length > 0;

  const countTokens = (messages: Message[]): number => {
    const total = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(total / 4);
  };

  const provider: AIProvider = {
    id: "chatgpt-web",
    name: "ChatGPT (WebAuth)",
    tier: "byok",

    chat: async function* (
      messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      if (!configured) {
        yield {
          type: "error",
          content: "ChatGPT WebAuth no está configurado. Inicia sesión en la configuración.",
        };
        return;
      }

      try {
        // Obtenemos solo el último mensaje del usuario para enviarlo, 
        // ya que la API web maneja el contexto internamente si le pasáramos el conversation_id.
        // Por ahora, para simplificar y que funcione como stateless, creamos una nueva converación cada vez.
        // Opcional: concatenar el historial en el prompt si queremos contexto sin manejar UUIDs complejos.
        const fullPrompt = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n") + "\n\nASSISTANT:\n";

        const payload = {
          action: "next",
          messages: [
            {
              id: uuidv4(),
              author: { role: "user" },
              content: { content_type: "text", parts: [fullPrompt] },
              metadata: {},
            },
          ],
          parent_message_id: uuidv4(),
          model: "text-davinci-002-render-sha", // Modelo base gratuito de la web
          timezone_offset_min: -180,
          history_and_training_disabled: true,
        };

        const response = await tauriFetch("https://chatgpt.com/backend-api/conversation", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "OAI-Device-Id": uuidv4(),
            "OAI-Language": "es-CO",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let lastText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine === "" || cleanLine === "data: [DONE]") continue;

            if (cleanLine.startsWith("data: ")) {
              try {
                const dataStr = cleanLine.slice(6);
                if (dataStr === "[DONE]") continue;
                
                const data = JSON.parse(dataStr);
                const contentParts = data.message?.content?.parts;
                
                if (contentParts && contentParts.length > 0) {
                  const currentText = contentParts[0];
                  // ChatGPT Web API envía el texto COMPLETO acumulado en cada chunk,
                  // no el delta. Por lo tanto, debemos calcular el delta para nuestro UI.
                  const delta = currentText.slice(lastText.length);
                  lastText = currentText;
                  
                  if (delta) {
                    yield { type: "text", content: delta };
                  }
                }
              } catch (e) {
                console.warn("[ChatGPT Web] Error parsing chunk", e, cleanLine);
              }
            }
          }
        }
        
        yield { type: "done", content: "" };

      } catch (err) {
        yield {
          type: "error",
          content: `Error de OpenAI: ${String(err)}. Intenta iniciar sesión nuevamente.`,
        };
      }
    },

    countTokens,

    validateKey: async (testToken: string): Promise<boolean> => {
      try {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${testToken}` },
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };

  return provider;
}
