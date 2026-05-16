import type { Message } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";

// URL por defecto para desarrollo (idealmente vendría de import.meta.env.VITE_AWS_API_URL)
const AWS_API_URL = import.meta.env.VITE_AWS_API_URL || "https://einddwm36yl3zday4ubjfgbehe0ufhjj.lambda-url.us-east-1.on.aws/";

// ─── Error Translation ─────────────────────────────────────────

/** Mapea errores crudos del backend a mensajes amigables en español. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function translateBackendError(errorData: any): string {
  const code = errorData?.error || "";
  const message = errorData?.message || "";

  switch (code) {
    case "quota_exceeded":
      return message || "Has alcanzado tu límite de uso. Los tokens se renuevan automáticamente. Intenta de nuevo más tarde.";
    case "upgrade_required":
      return `UPGRADE_REQUIRED: ${message || "Esta función requiere un plan superior."}`;
    case "unauthorized":
      return "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.";
    case "rate_limited":
      return "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.";
    case "model_unavailable":
      return "El modelo de IA seleccionado no está disponible en este momento. Intenta con otro modelo.";
    default:
      // Si el código parece un slug técnico (contiene _ o es todo minúsculas sin espacios),
      // mostramos un mensaje genérico en lugar del código crudo.
      if (code && /^[a-z_]+$/.test(code)) {
        return message || "Error del servidor. Por favor, intenta de nuevo.";
      }
      return code || message || "Error desconocido del servidor.";
  }
}

/** Traduce errores crudos de texto (no JSON) del AI SDK a español. */
function translateRawError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("model output must contain")) {
    return "El modelo respondió vacío. Intenta reformular tu mensaje o usa otro modelo.";
  }
  if (lower.includes("context length") || lower.includes("too long")) {
    return "El mensaje es demasiado largo para el modelo. Reduce el contexto o inicia una conversación nueva.";
  }
  if (lower.includes("rate limit") || lower.includes("throttl")) {
    return "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.";
  }
  if (lower.includes("timeout")) {
    return "El modelo tardó demasiado en responder. Intenta de nuevo.";
  }
  if (lower.includes("invalid") && lower.includes("key")) {
    return "La clave de API es inválida. Verifica tu configuración en Ajustes.";
  }

  // Genérico — no exponer el error crudo en inglés
  return "Error del modelo de IA. Intenta de nuevo o prueba con otro modelo.";
}

export async function* streamAwsSse(
  messages: Message[],
  providerId: string,
  _ignoredToken?: string, // Deprecated, kept for backward compatibility with providers
  signal?: AbortSignal,
  customApiKey?: string,
  options?: { action?: string; subagentId?: string; customInstructions?: string; modelId?: string }
): AsyncGenerator<{ type: "text" | "reasoning" | "error" | "done" | "mcp_tool_request"; content: string; tool?: string; args?: Record<string, unknown>; errorType?: "network" | "rate-limit" | "abort" | "server" }> {
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
      credentials: "include",
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
      const friendlyMessage = translateBackendError(errorData);
      yield { type: "error", errorType: "server", content: friendlyMessage };
      return;
    }

    if (!response.body) {
      yield { type: "error", errorType: "server", content: "Respuesta vacía del servidor." };
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => ({}));
      const friendlyMessage = translateBackendError(errorData);
      yield { type: "error", errorType: "server", content: friendlyMessage };
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

      for (let line of lines) {
        // Strip BOM and whitespace
        line = line.replace(/^\uFEFF/, "").trim();
        if (line === "") continue;
        
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
            // Error inline del backend (AI SDK runtime errors)
            else if (parsed.error || parsed.type === "error") {
              const friendlyMessage = translateBackendError(parsed);
              yield { type: "error", errorType: "server", content: friendlyMessage };
              return;
            }
            // Reasoning tokens from the model (thinking/chain-of-thought)
            else if (parsed.type === "reasoning") {
              yield { type: "reasoning", content: parsed.content || "" };
            }
            // Si es texto de chat
            else if (parsed.content) {
              yield { type: "text", content: parsed.content };
            } else {
              console.debug("[SSE-DEBUG] Chunk skipped:", JSON.stringify(parsed).slice(0, 200));
            }
          } catch (_e) {
            // Si no es JSON, podría ser texto de error crudo del AI SDK
            if (dataStr.toLowerCase().includes("error")) {
              const translated = translateRawError(dataStr);
              yield { type: "error", errorType: "server", content: translated };
              return;
            }
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
