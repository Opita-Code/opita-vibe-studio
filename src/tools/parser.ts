/**
 * Parser de tool calls del LLM.
 *
 * El LLM emite herramientas como bloques XML en su respuesta de texto:
 *
 *   <vibe-tool name="read_file">
 *   {"path": "src/App.tsx"}
 *   </vibe-tool>
 *
 * Este parser:
 * 1. Detecta si el texto acumulado contiene un bloque completo
 * 2. Extrae el nombre y argumentos
 * 3. Separa el texto visible del usuario de los bloques de herramientas
 */

import type { ToolCall } from "./definitions";

// ─── Constants ─────────────────────────────────────────────────

const TOOL_OPEN_TAG = /<vibe-tool\s+name="([^"]+)">/;
const TOOL_CLOSE_TAG = /<\/vibe-tool>/;
const TOOL_BLOCK_REGEX =
  /<vibe-tool\s+name="([^"]+)">\s*([\s\S]*?)\s*<\/vibe-tool>/g;

// ─── Types ─────────────────────────────────────────────────────

export interface ParseResult {
  /** Texto limpio para mostrar al usuario (sin bloques de herramientas) */
  visibleText: string;
  /** Tool calls encontrados en orden */
  toolCalls: ToolCall[];
  /** Si hay un bloque de herramienta incompleto (esperando más texto) */
  hasPendingTool: boolean;
}

// ─── Parser ────────────────────────────────────────────────────

/**
 * Parsea el texto acumulado del LLM buscando tool calls completos.
 *
 * @param rawText - Texto acumulado del stream del LLM
 * @returns ParseResult con texto visible, tool calls, y estado pendiente
 */
export function parseToolCalls(rawText: string): ParseResult {
  const toolCalls: ToolCall[] = [];

  // Extraer todos los bloques de herramientas completos
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOOL_BLOCK_REGEX.source, "g");

  while ((match = regex.exec(rawText)) !== null) {
    const name = match[1];
    const argsRaw = match[2].trim();

    try {
      const args = JSON.parse(argsRaw);
      toolCalls.push({ name, args });
    } catch {
      // Si los argumentos no son JSON válido, intentar parseo más flexible
      const flexArgs = parseFlexibleArgs(argsRaw);
      if (flexArgs) {
        toolCalls.push({ name, args: flexArgs });
      }
    }
  }

  // Remover bloques de herramientas del texto visible
  const visibleText = rawText
    .replace(TOOL_BLOCK_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Detectar si hay un bloque incompleto (tag abierto sin cerrar)
  const hasPendingTool =
    TOOL_OPEN_TAG.test(rawText) &&
    !TOOL_CLOSE_TAG.test(rawText.slice(rawText.lastIndexOf("<vibe-tool")));

  return { visibleText, toolCalls, hasPendingTool };
}

/**
 * Intenta parsear argumentos en formato más flexible
 * (ej: sin comillas, key=value, etc.)
 */
function parseFlexibleArgs(raw: string): Record<string, unknown> | null {
  // Intentar como pares key: value
  const result: Record<string, unknown> = {};
  const lines = raw.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const match = line.match(/^\s*"?(\w+)"?\s*[:=]\s*(.+)$/);
    if (match) {
      const key = match[1];
      let value: unknown = match[2].trim();

      // Quitar comillas envolventes
      if (
        typeof value === "string" &&
        value.startsWith('"') &&
        value.endsWith('"')
      ) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Formatea el resultado de una herramienta para inyectar en el contexto del LLM.
 */
export function formatToolResult(
  name: string,
  success: boolean,
  result?: unknown,
  error?: string,
): string {
  if (success) {
    let content =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);

    // Truncate very large results to prevent context overflow
    const MAX_RESULT_CHARS = 8_000;
    if (content.length > MAX_RESULT_CHARS) {
      const head = content.slice(0, 6_000);
      const tail = content.slice(-2_000);
      content = `${head}\n\n... [${content.length - 8_000} caracteres omitidos] ...\n\n${tail}`;
    }

    return `<vibe-tool-result name="${name}" status="ok">\n${content}\n</vibe-tool-result>`;
  }
  return `<vibe-tool-result name="${name}" status="error">\n${error || "Error desconocido"}\n</vibe-tool-result>`;
}

// ─── Streaming Detection ───────────────────────────────────────

export interface StreamingToolDetection {
  /** The first complete tool call found */
  toolCall: ToolCall;
  /** Text before the tool call (visible to user) */
  textBeforeTool: string;
  /** Full raw text including the tool block */
  fullRawText: string;
}

/**
 * Detects the first complete tool call in streaming text.
 * Used during streaming to know when to abort and execute.
 *
 * @param rawText - Accumulated streaming text so far
 * @returns Detection result, or null if no complete tool call found
 */
export function detectFirstCompleteTool(rawText: string): StreamingToolDetection | null {
  const regex = new RegExp(TOOL_BLOCK_REGEX.source);
  const match = regex.exec(rawText);

  if (!match) return null;

  const name = match[1];
  const argsRaw = match[2].trim();

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsRaw);
  } catch {
    const flexArgs = parseFlexibleArgs(argsRaw);
    if (!flexArgs) return null;
    args = flexArgs;
  }

  // Get text before the tool block
  const textBeforeTool = rawText
    .slice(0, match.index)
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    toolCall: { name, args },
    textBeforeTool,
    fullRawText: rawText,
  };
}

/**
 * Checks if streaming text has a partial (incomplete) tool tag being written.
 * Useful to suppress showing XML tags in the UI during streaming.
 */
export function hasPartialToolTag(rawText: string): boolean {
  const lastOpen = rawText.lastIndexOf("<vibe-tool");
  if (lastOpen === -1) return false;
  // Check if there's a closing tag after the last opening
  return !rawText.slice(lastOpen).includes("</vibe-tool>");
}
