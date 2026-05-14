import type { Message } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";

// URL por defecto para desarrollo (idealmente vendría de import.meta.env.VITE_AWS_API_URL)
const AWS_API_URL = import.meta.env.VITE_AWS_API_URL || "https://5zranjs7zstps7ruqkfs4qrkfe0wowcc.lambda-url.us-east-1.on.aws/";

export async function* streamAwsSse(
  messages: Message[],
  providerId: string,
  _ignoredToken?: string, // Deprecated, kept for backward compatibility with providers
  signal?: AbortSignal,
  customApiKey?: string,
  options?: { action?: string; subagentId?: string; customInstructions?: string; modelId?: string }
): AsyncGenerator<{ type: "text" | "error" | "done" | "mcp_tool_request"; content: string; tool?: string; args?: Record<string, unknown>; errorType?: "network" | "rate-limit" | "abort" | "server" }> {
  try {
    const token = useAuthStore.getState().session?.token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(AWS_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: options?.action || "chat",
        subagentId: options?.subagentId,
        customInstructions: options?.customInstructions,
        modelId: options?.modelId,
        projectId: "local-workspace",
        messages,
        providerId,
        customApiKey
      }),
      signal
    });

    if (!response.ok) {
      if (response.status === 429) {
        yield { type: "error", errorType: "rate-limit", content: "Límite de peticiones o tokens excedido. Por favor, intenta de nuevo en unos momentos o reduce el contexto." };
        return;
      }
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === "upgrade_required") {
        yield { type: "error", errorType: "server", content: "UPGRADE_REQUIRED: " + errorData.message };
        return;
      }
      yield { type: "error", errorType: "server", content: errorData.error || `Error del servidor HTTP ${response.status}` };
      return;
    }

    if (!response.body) {
      yield { type: "error", errorType: "server", content: "Respuesta vacía del servidor." };
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => ({}));
      yield { type: "error", errorType: "server", content: errorData.error || "Error desconocido del servidor (JSON devuelto en lugar de stream)" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // En caso de que se cierre sin enviar [DONE] explícito
        yield { type: "done", content: "" };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      
      // Mantenemos el último fragmento incompleto (si no termina en newline) en el buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        
        if (line.startsWith("data: ")) {
          const dataStr = line.slice(6).trim();
          
          if (dataStr === "[DONE]") {
            yield { type: "done", content: "" };
            return; // Termina el generador
          }

          try {
            const parsed = JSON.parse(dataStr);
            
            // Si es un evento MCP (Fase 3), lo emitimos
            if (parsed.type === "mcp_tool_request") {
               yield { 
                 type: "mcp_tool_request", 
                 content: "", 
                 tool: parsed.tool, 
                 args: parsed.args 
               };
            } 
            // Si es texto de chat
            else if (parsed.content) {
              yield { type: "text", content: parsed.content };
            }
          } catch (e) {
            console.warn("SSE JSON Parse Error:", dataStr);
          }
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      yield { type: "error", errorType: "abort", content: "\n\n⛔ Generación cancelada por el usuario." };
    } else if (err instanceof TypeError && err.message === "Failed to fetch") {
      yield { type: "error", errorType: "network", content: "Error de red. Verifica tu conexión a internet e intenta de nuevo." };
    } else {
      yield { type: "error", errorType: "server", content: `Error inesperado: ${String(err)}` };
    }
  }
}
