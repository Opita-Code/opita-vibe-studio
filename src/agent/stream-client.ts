/**
 * Stream Client — Clean SSE parser for the Vibe Studio agent system.
 *
 * Single responsibility: fetch → parse SSE → yield typed chunks.
 * Replaces the streaming logic from `services/aiService.ts`.
 *
 * Key fixes vs the old implementation:
 * - Uses `!== undefined` instead of truthiness to avoid dropping empty-string content
 * - Separates `reasoning` chunks from text (for <think> tags)
 * - Returns typed SSEChunk discriminated union
 */

import type { Message } from "@/lib/types";
import type { SSEChunk } from "./types";
import { useAuthStore } from "@/stores/auth";

const AWS_API_URL =
  "https://api.opitacode.com/chat";

// ─── Error Translation ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function translateBackendError(errorData: any): string {
  const code = errorData?.error || "";
  const message = errorData?.message || "";

  const errorMap: Record<string, string> = {
    quota_exceeded:
      message ||
      "Has alcanzado tu límite de uso. Los tokens se renuevan automáticamente. Intenta de nuevo más tarde.",
    upgrade_required: `UPGRADE_REQUIRED: ${message || "Esta función requiere un plan superior."}`,
    unauthorized: "Tu sesión ha expirado. Por favor, inicia sesión de nuevo.",
    rate_limited:
      "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.",
    model_unavailable:
      "El modelo de IA seleccionado no está disponible en este momento. Intenta con otro modelo.",
  };

  if (errorMap[code]) return errorMap[code];

  // If code looks like a technical slug, show generic message
  if (code && /^[a-z_]+$/.test(code)) {
    return message || "Error del servidor. Por favor, intenta de nuevo.";
  }

  return code || message || "Error desconocido del servidor.";
}

function translateRawError(raw: string): string {
  const lower = raw.toLowerCase();

  if (lower.includes("model output must contain"))
    return "El modelo respondió vacío. Intenta reformular tu mensaje o usa otro modelo.";
  if (lower.includes("context length") || lower.includes("too long"))
    return "El mensaje es demasiado largo para el modelo. Reduce el contexto o inicia una conversación nueva.";
  if (lower.includes("rate limit") || lower.includes("throttl"))
    return "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo.";
  if (lower.includes("timeout"))
    return "El modelo tardó demasiado en responder. Intenta de nuevo.";
  if (lower.includes("invalid") && lower.includes("key"))
    return "La clave de API es inválida. Verifica tu configuración en Ajustes.";

  return "Error del modelo de IA. Intenta de nuevo o prueba con otro modelo.";
}

// ─── Stream Options ─────────────────────────────────────────────

export interface StreamOptions {
  providerId: string;
  signal?: AbortSignal;
  customApiKey?: string;
  action?: string;
  subagentId?: string;
  customInstructions?: string;
  modelId?: string;
}

// ─── SSE Stream ─────────────────────────────────────────────────

/**
 * Streams SSE from the AWS Lambda backend.
 *
 * Yields typed SSEChunk values. Consumers should iterate with `for await`.
 * This is the ONLY streaming function in the agent system.
 */
export async function* streamSSE(
  messages: Message[],
  options: StreamOptions
): AsyncGenerator<SSEChunk> {
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
        action: options.action || "chat",
        subagentId: options.subagentId,
        customInstructions: options.customInstructions,
        modelId: options.modelId,
        projectId: "local-workspace",
        messages,
        providerId: options.providerId,
        customApiKey: options.customApiKey,
      }),
      signal: options.signal,
    });

    // ─── HTTP Error Handling ─────────────────────────────────

    if (!response.ok) {
      if (response.status === 429) {
        yield {
          type: "error",
          content:
            "Límite de peticiones o tokens excedido. Intenta de nuevo en unos momentos.",
        };
        return;
      }
      const errorData = await response.json().catch(() => ({}));
      yield { type: "error", content: translateBackendError(errorData) };
      return;
    }

    if (!response.body) {
      yield { type: "error", content: "Respuesta vacía del servidor." };
      return;
    }

    // If backend returned JSON error instead of SSE stream
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const errorData = await response.json().catch(() => ({}));
      yield { type: "error", content: translateBackendError(errorData) };
      return;
    }

    // ─── SSE Parsing ────────────────────────────────────────

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        yield { type: "done" };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep incomplete last line in buffer
      buffer = lines.pop() || "";

      for (let line of lines) {
        // Centralized BOM + whitespace cleanup BEFORE any processing
        line = line.replace(/^\uFEFF/, "").trim();
        if (line === "") continue;

        if (!line.startsWith("data: ")) continue;

        const dataStr = line.slice(6).trim();

        if (dataStr === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);

          // MCP tool request from backend
          if (parsed.type === "mcp_tool_request") {
            yield {
              type: "tool_request",
              tool: parsed.tool,
              args: parsed.args || {},
            };
          }
          // Error from backend
          else if (parsed.error || parsed.type === "error") {
            yield {
              type: "error",
              content: translateBackendError(parsed),
            };
            return;
          }
          // Explicit reasoning event from backend (AI SDK reasoning chunks)
          else if (parsed.type === "reasoning") {
            yield { type: "reasoning", content: parsed.content || "" };
          }
          // Text content — FIX: use !== undefined to avoid dropping empty strings
          else if (parsed.content !== undefined) {
            // Check if this is reasoning content (wrapped in <think> tags)
            if (
              typeof parsed.content === "string" &&
              parsed.content.includes("<think>")
            ) {
              yield { type: "reasoning", content: parsed.content };
            } else {
              yield { type: "text", content: parsed.content };
            }
          }
          // Unknown chunk type — silently skip (no debug logs in production)
        } catch {
          // Non-JSON data line — check if it's a raw error
          if (dataStr.toLowerCase().includes("error")) {
            yield { type: "error", content: translateRawError(dataStr) };
            return;
          }
          // Otherwise skip malformed data
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      yield {
        type: "error",
        content: "⛔ Generación cancelada.",
      };
    } else if (
      err instanceof TypeError &&
      err.message === "Failed to fetch"
    ) {
      yield {
        type: "error",
        content:
          "Error de red. Verifica tu conexión a internet e intenta de nuevo.",
      };
    } else {
      yield {
        type: "error",
        content: `Error inesperado: ${String(err)}`,
      };
    }
  }
}
