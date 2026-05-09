import type { Message, ChatChunk } from "@/lib/types";
import { routeRequest } from "@/providers/router";
import {
  buildEntenderMessages,
  buildConstruirMessages,
  buildVerificarMessages,
} from "./prompts";
import { parseEntenderResponse } from "./entender";
import { parseConstruirResponse, parseConstruirResponseFallback } from "./construir";
import { parseVerificarResponse } from "./verificar";
import type { PipelineEvent, PipelinePhase, FileOutput, ConstruirOutput } from "./types";

// ─── Constants ─────────────────────────────────────────────────

/** Palabras clave que activan el pipeline (vs. chat directo). */
const CODE_KEYWORDS = [
  "crear",
  "hacer",
  "construir",
  "cambiar",
  "modificar",
  "página",
  "componente",
  "función",
  "funcion",
  "archivo",
  "código",
  "codigo",
  "sitio",
  "app",
  "proyecto",
  "interfaz",
  "diseño",
  "diseñar",
  "landing",
  "portafolio",
  "formulario",
  "tabla",
  "menu",
  "menú",
  "navegación",
  "estilo",
  "clase",
  "clase css",
  "script",
];

/** Máximo de reintentos para la fase Verificar. */
export const MAX_VERIFY_RETRIES = 3;

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Detecta si un mensaje del usuario parece una solicitud de código
 * (vs. una pregunta simple que no requiere el pipeline).
 *
 * @param text - Mensaje del usuario
 * @param hasProjectOpen - Si hay un proyecto abierto
 * @returns true si el mensaje parece una solicitud de código
 */
export function detectCodeRequest(text: string, hasProjectOpen: boolean): boolean {
  if (!hasProjectOpen) return false;

  const lower = text.toLowerCase().trim();

  // Si el mensaje es muy corto (< 10 chars), probablemente no es una solicitud de código
  if (lower.length < 10) return false;

  // Buscar palabras clave
  return CODE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Genera un ID único para mensajes del pipeline.
 */
let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `pipeline-${Date.now()}-${idCounter}`;
}

/**
 * Convierte un array de mensajes del tipo {role, content} al formato Message
 * usado por el store y el router.
 */
export function toMessages(
  msgs: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Message[] {
  return msgs.map((m) => ({
    id: generateId(),
    role: m.role,
    content: m.content,
    timestamp: Date.now(),
  }));
}

/**
 * Acumula chunks de texto de un AsyncGenerator hasta que encuentra "done" o "error".
 * Devuelve el texto completo acumulado.
 */
export async function collectResponse(
  generator: AsyncGenerator<ChatChunk>,
): Promise<string> {
  let result = "";

  for await (const chunk of generator) {
    if (chunk.type === "text") {
      result += chunk.content;
    } else if (chunk.type === "error") {
      throw new Error(chunk.content);
    } else if (chunk.type === "done") {
      break;
    }
  }

  return result;
}

/**
 * Intenta archivos al sistema de archivos.
 * Devuelve los paths de los archivos que se pudieron escribir exitosamente.
 */
async function tryWriteFiles(files: FileOutput[]): Promise<string[]> {
  const created: string[] = [];

  for (const file of files) {
    try {
      // En entorno Tauri, writeFile es un comando IPC.
      // En tests, se mockea o se ignora si no está disponible.
      const { writeFile } = await import("@/lib/ipc");
      await writeFile(file.path, file.content);
      created.push(file.path);
    } catch (_err) {
      // Fallback: en entornos sin Tauri (tests, browser dev), no es crítico
      console.warn(`[Pipeline] No se pudo escribir ${file.path}`);
    }
  }

  return created;
}

// ─── Pipeline Engine ───────────────────────────────────────────

/**
 * Ejecuta el pipeline completo: entender → construir → verificar.
 *
 * El pipeline es INVISIBLE para el usuario — solo ve los indicadores
 * de estado y el resultado final. Las transiciones de fase se emiten
 * como eventos para que el ChatPanel pueda mostrar indicadores.
 *
 * Flujo:
 * 1. Entender: analiza el pedido, genera un plan de archivos
 * 2. Construir: genera el código siguiendo el plan
 * 3. Verificar: revisa el código contra el pedido original
 *    - Si falla → reintenta Construir (máx. MAX_VERIFY_RETRIES)
 *    - Si pasa → emite resultado
 *
 * @param userMessage - Mensaje original del usuario
 * @param contextMessages - Mensajes de contexto (historial)
 * @param preferredProvider - Proveedor AI preferido
 * @yields PipelineEvent - Eventos para que el ChatPanel los consuma
 */
export async function* runPipeline(
  userMessage: string,
  contextMessages: Message[],
  preferredProvider: string,
): AsyncGenerator<PipelineEvent> {
  let entenderPlan = "";
  let construirOutput: ConstruirOutput | null = null;

  // ── Fase 1: Entender ──────────────────────────────────────
  yield { type: "phase_change", phase: "entender" as PipelinePhase };

  try {
    const entenderMessages = buildEntenderMessages(userMessage);
    const entenderResponse = await collectResponse(
      routeRequest([...contextMessages, ...toMessages(entenderMessages)], {
        preferredProvider,
      }),
    );

    const entenderOutput = parseEntenderResponse(entenderResponse);
    entenderPlan = entenderOutput.plan;

    // Si no hay plan, usar el mensaje original
    if (!entenderPlan) {
      entenderPlan = userMessage;
    }
  } catch (_err) {
    // Si entender falla, continuamos con el mensaje original como plan
    entenderPlan = userMessage;
  }

  // ── Fase 2: Construir ─────────────────────────────────────
  yield { type: "phase_change", phase: "construir" as PipelinePhase };

  const runConstruir = async (plan: string): Promise<ConstruirOutput> => {
    const construirMessages = buildConstruirMessages(plan, userMessage);
    const construirResponse = await collectResponse(
      routeRequest([...contextMessages, ...toMessages(construirMessages)], {
        preferredProvider,
      }),
    );

    // Intentar parsear con formato primario, luego fallback
    let output = parseConstruirResponse(construirResponse);
    if (output.files.length === 0) {
      output = parseConstruirResponseFallback(construirResponse);
    }

    return output;
  };

  try {
    construirOutput = await runConstruir(entenderPlan);

    // Aplicar archivos generados al sistema de archivos
    const createdFiles = await tryWriteFiles(construirOutput.files);
    for (const path of createdFiles) {
      yield { type: "file_created", path };
    }
  } catch (_err) {
    yield {
      type: "error",
      message: `Error generando código: ${_err}`,
    };
    return;
  }

  // ── Fase 3: Verificar ─────────────────────────────────────
  yield { type: "phase_change", phase: "verificar" as PipelinePhase };

  let verifyAttempts = 0;
  let verified = false;

  while (!verified && verifyAttempts <= MAX_VERIFY_RETRIES) {
    try {
      const verificarMessages = buildVerificarMessages(
        userMessage,
        construirOutput.fullResponse,
      );
      const verificarResponse = await collectResponse(
        routeRequest([...contextMessages, ...toMessages(verificarMessages)], {
          preferredProvider,
        }),
      );

      const verificarOutput = parseVerificarResponse(verificarResponse);

      if (verificarOutput.status === "ok") {
        verified = true;
      } else {
        verifyAttempts++;

        if (verifyAttempts <= MAX_VERIFY_RETRIES) {
          yield {
            type: "retry",
            attempt: verifyAttempts,
            reason: verificarOutput.reason ?? "El código necesita correcciones",
          };

          // Re-ejecutar construir con la razón del error
          yield {
            type: "phase_change",
            phase: "construir" as PipelinePhase,
          };

          construirOutput = await runConstruir(
            `${entenderPlan}\n\nCorrecciones necesarias: ${verificarOutput.reason ?? ""}`,
          );

          // Aplicar archivos regenerados
          const retryFiles = await tryWriteFiles(construirOutput.files);
          for (const path of retryFiles) {
            yield { type: "file_created", path };
          }

          yield {
            type: "phase_change",
            phase: "verificar" as PipelinePhase,
          };
        } else {
          // Agotamos los reintentos — mostramos el error y el último código
          yield {
            type: "error",
            message: `No se pudo corregir: ${verificarOutput.reason ?? "Error desconocido"}`,
          };

          if (construirOutput) {
            yield {
              type: "result",
              content: construirOutput.fullResponse,
              files: construirOutput.files,
            };
          }
          return;
        }
      }
    } catch (_err) {
      yield {
        type: "error",
        message: `Error verificando código: ${_err}`,
      };

      // Mostrar el código generado aunque falle la verificación
      if (construirOutput) {
        yield {
          type: "result",
          content: construirOutput.fullResponse,
          files: construirOutput.files,
        };
      }
      return;
    }
  }

  // ── Éxito ─────────────────────────────────────────────────
  yield {
    type: "result",
    content: construirOutput.fullResponse,
    files: construirOutput.files,
  };
}
