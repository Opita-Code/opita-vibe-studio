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
import { useAuthStore } from "@/stores/auth";
import { useChatStore } from "@/stores/chat";
import { useUIStore } from "@/stores/ui";

// ─── Constants ─────────────────────────────────────────────────

/** Palabras clave de ACCIÓN que sugieren generación de código. */
const ACTION_KEYWORDS = [
  "crear", "hacer", "construir", "cambiar", "modificar",
  "generar", "implementar", "agregar", "añadir", "armar",
  "montar", "diseñar", "desarrollar",
];

/** Palabras clave de OBJETO que confirman que es sobre código. */
const OBJECT_KEYWORDS = [
  "página", "pagina", "componente", "función", "funcion",
  "archivo", "código", "codigo", "sitio", "app", "interfaz",
  "landing", "portafolio", "formulario", "tabla", "menu",
  "menú", "navegación", "estilo", "clase css", "script",
  "botón", "modal", "header", "footer", "sidebar",
];

/** Patrones que indican una pregunta, NO una solicitud de código. */
const QUESTION_PATTERNS = [
  "qué es", "que es", "cómo funciona", "como funciona",
  "explíca", "explica", "por qué", "por que",
  "cuál es", "cual es", "qué hace", "que hace",
  "dónde", "donde", "cuándo", "cuando",
];

/**
 * Patrones de INTENCIÓN CONVERSACIONAL — el usuario quiere que el agente
 * le responda con código EN EL CHAT, sin tocar archivos del proyecto.
 * Frases como "en el chat", "muéstrame", "aquí", "escríbelo aquí", etc.
 */
const CONVERSATIONAL_INTENT_PATTERNS = [
  // Indicadores explícitos de "en el chat"
  "en el chat", "en este chat", "aquí en el chat",
  "escríbelo aquí", "escribelo aqui", "escríbemelo aquí", "escribemelo aqui",
  "ponlo aquí", "ponlo aqui",
  // "Muéstrame" / "enséñame" → intención educativa, no de filesystem
  "muéstrame", "muestrame", "enséñame", "enseñame",
  "muéstrame cómo", "muestrame como",
  "cómo se ve", "como se ve", "cómo luce", "como luce",
  // "Dame un ejemplo" → quiere ver código inline
  "dame un ejemplo", "dame ejemplo", "ejemplo de",
  "ponme un ejemplo",
  // "Escribe" sin contexto de filesystem
  "escríbeme", "escribeme",
  // Educativo
  "cómo sería", "como seria", "cómo quedaría", "como quedaria",
  "cómo se haría", "como se haria", "cómo se hace", "como se hace",
];

/** Máximo de reintentos para la fase Verificar. */
export const MAX_VERIFY_RETRIES = 3;

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Detecta si un mensaje del usuario parece una solicitud de código
 * (vs. una pregunta simple que no requiere el pipeline).
 *
 * Requiere: al menos 1 keyword de ACCIÓN + 1 keyword de OBJETO.
 * Excluye: patrones interrogativos puros.
 */
export function detectCodeRequest(text: string, hasProjectOpen: boolean): boolean {
  if (!hasProjectOpen) return false;

  const lower = text.toLowerCase().trim();

  // Mensajes muy cortos nunca activan el pipeline
  if (lower.length < 15) return false;

  // Si es una pregunta pura, no activar pipeline
  if (QUESTION_PATTERNS.some((q) => lower.includes(q))) return false;

  // Si tiene intención conversacional ("en el chat", "muéstrame"), no activar pipeline
  if (CONVERSATIONAL_INTENT_PATTERNS.some((p) => lower.includes(p))) return false;

  // Requiere AL MENOS una keyword de acción Y una de objeto
  const hasAction = ACTION_KEYWORDS.some((k) => lower.includes(k));
  const hasObject = OBJECT_KEYWORDS.some((k) => lower.includes(k));

  return hasAction && hasObject;
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
      const { saveFileContent } = await import("@/lib/fs");
      await saveFileContent(file.path, file.content);
      
      // Actualizar el estado en memoria para que el explorador y el editor lo vean inmediatamente
      const { useProjectStore } = await import("@/stores/project");
      useProjectStore.getState().setFileContent(file.path, file.content);
      
      created.push(file.path);
    } catch (err) {
      console.warn(`[Pipeline] No se pudo escribir ${file.path}`, err);
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
  activeModelId: string,
): AsyncGenerator<PipelineEvent> {
  const plan = useAuthStore.getState().plan;
  const useSubagent = useChatStore.getState().useSubagent;
  const subagentInstructions = useChatStore.getState().subagentInstructions;
  const vibeLensEnabled = useUIStore.getState().vibeLensEnabled;

  // ── Fase 1: Entender (Obligatorio para planificar) ──
  yield { type: "phase_change", phase: "entender" as PipelinePhase };

  let entenderPlan = "";
  let entenderOutput: import("./types").EntenderOutput | null = null;
  let construirOutput: ConstruirOutput | null = null;

  try {
    const entenderMessages = buildEntenderMessages(userMessage);
    const entenderResponse = await collectResponse(
      routeRequest([...contextMessages, ...toMessages(entenderMessages)], {
        preferredProvider,
        model: activeModelId,
      }),
    );

    entenderOutput = parseEntenderResponse(entenderResponse);
    entenderPlan = entenderOutput.plan;

    // Si no hay plan, usar el mensaje original
    if (!entenderPlan) {
      entenderPlan = userMessage;
    }
  } catch (_err) {
    // Si entender falla, continuamos con el mensaje original como plan
    entenderPlan = userMessage;
  }

  // ── Modo Interactivo: confirmar plan antes de ejecutar ──
  const executionMode = useChatStore.getState().executionMode;
  if (executionMode === "interactive" && entenderPlan && entenderPlan !== userMessage) {
    // Emitir plan para que el usuario lo revise
    yield { type: "phase_confirm", phase: "entender" as PipelinePhase, plan: entenderPlan };

    // Guardar en store y esperar confirmación (polling)
    useChatStore.getState().setPendingConfirmation({ phase: "entender", plan: entenderPlan });

    const waitForConfirmation = (): Promise<boolean> => {
      return new Promise((resolve) => {
        const check = () => {
          const state = useChatStore.getState();
          if (state.pendingConfirmation === null) {
            resolve(true); // User confirmed
          } else if (!state.isStreaming) {
            resolve(false); // User cancelled (streaming stopped)
          } else {
            setTimeout(check, 200);
          }
        };
        setTimeout(check, 200);
      });
    };

    const confirmed = await waitForConfirmation();
    if (!confirmed) return;
  }

  if ((plan === "pro" || plan === "estudiante") && useSubagent) {
    // ── Fase Única: Subagente Autónomo (Vibe Pro Engine) ──
    yield { type: "phase_change", phase: "subagente" as PipelinePhase };

    try {
      // Remover el mensaje vacío del asistente que acabamos de agregar en el UI,
      // porque el backend genera la respuesta completa de nuevo.
      const cleanContext = contextMessages.filter(m => m.content !== "" || m.role !== "assistant");
      // Agregar el plan confirmado al contexto
      cleanContext.push({ id: crypto.randomUUID(), role: "system", content: `Ejecuta este plan de acción paso a paso:\n\n${entenderPlan}`, timestamp: Date.now() });
      
      let content = "";
      let currentContext = cleanContext;
      const MAX_ITERATIONS = 15;
      let iteration = 0;
      let filesModified: FileOutput[] = [];

      while (iteration < MAX_ITERATIONS) {
        iteration++;
        const subagentGenerator = routeRequest(
          currentContext,
          {
            preferredProvider,
            action: "subagent",
            subagentId: "sdd-apply",
            customInstructions: subagentInstructions,
            model: activeModelId,
          }
        );

        let iterationContent = "";
        let toolRequest: any = null;

        for await (const chunk of subagentGenerator) {
          if (chunk.type === "text") {
            iterationContent += chunk.content;
            yield { type: "subagent_stream", content: chunk.content };
          } else if (chunk.type === "mcp_tool_request") {
            toolRequest = chunk;
            yield {
              type: "subagent_action",
              tool: chunk.tool || "unknown",
              args: chunk.args as Record<string, unknown> | undefined,
            };
          } else if (chunk.type === "error") {
            throw new Error(chunk.content);
          }
        }
        
        content += iterationContent;

        if (!toolRequest) {
          break; // Terminado
        }

        // Ejecutar herramienta localmente
        const { executeTool } = await import("@/tools");
        const result = await executeTool({
          name: toolRequest.tool,
          args: toolRequest.args || {}
        });

        if (toolRequest.tool === "write_local_file") {
          filesModified.push({ path: toolRequest.args?.path || "", content: String(toolRequest.args?.content || "") });
        }

        // Agregar resultado al contexto para la siguiente iteración
        currentContext = [
          ...currentContext,
          { id: crypto.randomUUID(), role: "assistant", content: iterationContent, timestamp: Date.now() },
          { id: crypto.randomUUID(), role: "user", content: `Resultado de ${toolRequest.tool}:\n${result.success ? result.result : result.error}`, timestamp: Date.now() }
        ];
      }

      const actionMatch = content.match(/<vibe-action\s+type="preview-component"\s+value="([^"]+)"\s*\/>/);
      if (actionMatch && vibeLensEnabled) {
        useUIStore.getState().setPreviewTarget(actionMatch[1]);
      }

      yield {
        type: "result",
        content: content,
        files: filesModified,
      };
      return;

    } catch (err) {
      yield {
        type: "error",
        message: `Error ejecutando Subagente AWS: ${err instanceof Error ? err.message : "Error desconocido"}`,
      };
      return;
    }
  }

  // ── Fase 2: Construir ─────────────────────────────────────
  yield { type: "phase_change", phase: "construir" as PipelinePhase };

  // Leer archivos existentes que el plan identificó
  const existingFiles: Array<{path: string, content: string}> = [];
  if (entenderOutput) {
    const { useProjectStore } = await import("@/stores/project");
    const workspace = useProjectStore.getState().workspaces.find(
      (w) => w.id === useProjectStore.getState().activeWorkspaceId,
    );
    
    if (workspace) {
      const { readFileContent: readFile } = await import("@/lib/fs");
      for (const filePath of entenderOutput.files.slice(0, 5)) { // Máx 5 archivos para no saturar contexto
        try {
          const sep = workspace.path.includes("\\") ? "\\" : "/";
          const fullPath = `${workspace.path}${sep}${filePath.replace(/\//g, sep)}`;
          const content = await readFile(fullPath);
          existingFiles.push({ path: filePath, content });
        } catch {
          // Archivo no existe todavía — se creará
        }
      }
    }
  }

  const runConstruir = async (plan: string): Promise<ConstruirOutput> => {
    const construirMessages = buildConstruirMessages(plan, userMessage, vibeLensEnabled, existingFiles);
    const construirResponse = await collectResponse(
      routeRequest([...contextMessages, ...toMessages(construirMessages)], {
        preferredProvider,
        model: activeModelId,
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

    // ── Delivery Estimation ──
    const { DELIVERY_LINE_THRESHOLD } = await import("@/stores/chat");
    const totalLines = construirOutput.files.reduce((sum, f) => sum + f.content.split("\n").length, 0);
    if (totalLines > DELIVERY_LINE_THRESHOLD) {
      yield { type: "delivery_estimate", totalLines, suggestSplit: true };
    }

    // Aplicar archivos generados al sistema de archivos
    const createdFiles = await tryWriteFiles(construirOutput.files);
    for (const path of createdFiles) {
      yield { type: "file_created", path };
    }
  } catch (err) {
    yield {
      type: "error",
      message: `Error generando código: ${err instanceof Error ? err.message : "Error desconocido"}`,
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
          model: activeModelId,
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
    } catch (err) {
      yield {
        type: "error",
        message: `Error verificando código: ${err instanceof Error ? err.message : "Error desconocido"}`,
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
  const actionMatch = construirOutput.fullResponse.match(/<vibe-action\s+type="preview-component"\s+value="([^"]+)"\s*\/>/);
  if (actionMatch && vibeLensEnabled) {
    useUIStore.getState().setPreviewTarget(actionMatch[1]);
  }

  yield {
    type: "result",
    content: construirOutput.fullResponse,
    files: construirOutput.files,
  };
}
