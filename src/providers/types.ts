// ─── Model Configuration ────────────────────────────────────────

export interface ModelConfig {
  /** Identificador único del modelo (ej: "deepseek-chat") */
  id: string;
  /** Nombre visible en la UI (ej: "DeepSeek V3") */
  name: string;
  /** ID del proveedor al que pertenece */
  providerId: string;
  /** Máximo de tokens de salida */
  maxTokens: number;
  /** Temperatura por defecto (0.0 – 2.0) */
  temperature: number;
  /** Costo estimado por cada 1k tokens de entrada (USD) */
  costPer1kInput: number;
  /** Costo estimado por cada 1k tokens de salida (USD) */
  costPer1kOutput: number;
  /** Categoría del modelo */
  tier: "free" | "byok";
}

// ─── Provider Info (para la UI) ─────────────────────────────────

export interface ProviderInfo {
  id: string;
  name: string;
  tier: "free" | "byok";
  /** Si tiene una API key configurada */
  configured: boolean;
  /** Modelos disponibles en este proveedor */
  models: ModelConfig[];
}

// ─── ApiMessage (formato normalizado para enviar a APIs) ────────

export interface ApiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ─── Stream Chunk (texto plano, sin tipo de chunk) ─────────────

export interface StreamTextChunk {
  type: "delta";
  content: string;
}

export type StreamEvent =
  | StreamTextChunk
  | { type: "done" }
  | { type: "error"; message: string };

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Convierte mensajes internos al formato estándar de API.
 */
export function toApiMessages(messages: import("@/lib/types").Message[]): ApiMessage[] {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
}
