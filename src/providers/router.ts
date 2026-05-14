import type { ChatChunk, ChatOptions, Message } from "@/lib/types";
import { listProviders, getProvider } from "./registry";

// ─── Route Result ──────────────────────────────────────────────

export interface RouteResult {
  providerId: string;
  model: string;
}

/**
 * Enruta una solicitud de chat al mejor proveedor disponible.
 *
 * Estrategia de failover:
 * 1. Proveedor preferido (si está especificado)
 * 2. Proveedores free en orden de registro
 * 3. Fallback: mensaje informativo
 *
 * El failover es transparente para el usuario — no se muestra
 * internamente qué proveedor está en uso.
 *
 * Cada chunk emitido incluye `providerId` y `model` para que
 * la UI pueda mostrar qué proveedor está respondiendo.
 */
export async function* routeRequest(
  contextMessages: Message[],
  options?: ChatOptions & { preferredProvider?: string },
): AsyncGenerator<ChatChunk & RouteResult> {
  const preferred = options?.preferredProvider;

  // ── Determinar orden de intentos ─────────────────────────
  const providers = listProviders();
  const tryOrder: string[] = [];

  // 1. Proveedor preferido
  if (preferred && providers.some((p) => p.id === preferred)) {
    tryOrder.push(preferred);
  }

  // 2. Free providers (excluyendo el preferido si ya está)
  for (const info of providers) {
    if (info.id !== preferred && info.tier === "free") {
      tryOrder.push(info.id);
    }
  }

  // 3. BYOK providers como último recurso
  for (const info of providers) {
    if (info.id !== preferred && info.tier === "byok") {
      tryOrder.push(info.id);
    }
  }

  // ── Intentar cada provider en orden ──────────────────────
  let lastError: string | null = null;

  for (const providerId of tryOrder) {
    try {
      const provider = getProvider(providerId);
      let usedModel = options?.model;

      // Elegir el primer modelo disponible si no se especificó
      if (!usedModel) {
        const info = providers.find((p) => p.id === providerId);
        usedModel = info?.models?.[0]?.id;
      }

      let hasError = false;

      for await (const chunk of provider.chat(contextMessages, {
        ...options,
        model: usedModel,
      })) {
        if (chunk.type === "error") {
          lastError = chunk.content;
          hasError = true;
          break; // Salir del for-await para probar el siguiente provider
        }

        yield {
          ...chunk,
          providerId,
          model: usedModel ?? "unknown",
        } as ChatChunk & RouteResult;

        if (chunk.type === "done") {
          return; // Éxito — terminamos
        }
      }

      // Si el provider no produjo errores ni se completó (stream vacío),
      // consideramos que falló silenciosamente
      if (!hasError) {
        lastError = `${providerId} responded with empty stream`;
      }
    } catch (err) {
      lastError = `Error con ${providerId}: ${String(err)}`;
      console.warn(`[Router] Failover desde ${providerId}: ${lastError}`);
      continue; // Probar siguiente provider
    }
  }

  // ── Fallback: ningún provider funcionó ───────────────────
  yield {
    type: "error",
    content: "Configura una API key en Configuración > BYOK para usar modelos reales.",
    providerId: "fallback",
    model: "none",
  } as ChatChunk & RouteResult;

  // Si hubo un error previo, mostrarlo
  if (lastError) {
    yield {
      type: "error",
      content: `Motivo: ${lastError}`,
      providerId: "fallback",
      model: "none",
    } as ChatChunk & RouteResult;
  }

  yield {
    type: "done",
    content: "",
    providerId: "fallback",
    model: "none",
  } as ChatChunk & RouteResult;
}

/**
 * Versión simplificada que acepta prompt y contexto por separado.
 * Útil cuando se quiere enviar un solo mensaje del usuario
 * más el historial de contexto.
 */
export async function* streamFromProvider(
  context: Message[],
  preferredProvider?: string,
  options?: { action?: string; subagentId?: string; model?: string }
): AsyncGenerator<ChatChunk> {
  const MAX_CONTEXT = 50; // Límite actual en el store
  const contextRatio = context.length / MAX_CONTEXT;
  
  let systemContent = `Eres Vibe Studio AI, el asistente inteligente integrado en Vibe Studio, un IDE moderno y elegante.
Tienes la capacidad de ayudar al usuario a programar, explicar conceptos de manera clara y profesional, y usar las herramientas disponibles en el entorno local a través del protocolo MCP. Responde siempre de forma concisa y amigable.`;

  systemContent += `\n\n[SISTEMA: Herramientas de Navegación UI]
Puedes controlar la interfaz del editor para mostrarle cosas al usuario dinámicamente insertando estos tags XML en tu respuesta. Se ejecutarán automáticamente y el usuario no verá los tags:
- <vibe-action type="set-view" value="preview" /> (Muestra la vista previa a pantalla completa)
- <vibe-action type="set-view" value="editor" /> (Muestra el editor de código)
- <vibe-action type="set-view" value="split" /> (Muestra código y vista previa divididos)
- <vibe-action type="open-file" value="ruta/al/archivo.ext" /> (Abre un archivo en el editor)
- <vibe-action type="toggle-explorer" value="true" /> (Abre el explorador de archivos)
- <vibe-action type="preview-component" value="ruta/al/archivo.tsx" /> (Abre VibeLens en Modo Aislado para previsualizar un componente específico en solitario)
Usa estos tags inteligentemente cuando el usuario pida ver algo, revisar código, o cuando creas que es útil cambiar la vista para mejorar su experiencia. ¡Hazlo ver como magia!`;

  if (contextRatio >= 0.8) {
    systemContent += `\n\n⚠️ AVISO DEL SISTEMA: El contexto de esta conversación está casi lleno (${context.length}/${MAX_CONTEXT} mensajes). Sugiere sutilmente y de manera muy amable al usuario que inicie una "Nueva conversación" pronto para mantener un buen rendimiento y no olvidar detalles importantes.`;
  }

  const systemMessage: Message = {
    id: `system-context-${Date.now()}`,
    role: "system",
    content: systemContent,
    timestamp: Date.now() - 1,
  };

  // context ya incluye el último mensaje del usuario enviado desde ChatPanel
  const cleanContext = context.filter(m => m.content !== "" || m.role !== "assistant");
  
  const messages: Message[] = [
    systemMessage,
    ...cleanContext
  ];

  for await (const chunk of routeRequest(messages, { preferredProvider, ...options })) {
    yield chunk;
  }
}
