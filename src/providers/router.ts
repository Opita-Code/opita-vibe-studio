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
  options?: ChatOptions & { preferredProvider?: string; signal?: AbortSignal },
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
  let preferredError: string | null = null;

  for (const providerId of tryOrder) {
    try {
      const provider = getProvider(providerId);
      let usedModel = options?.model;
      const info = providers.find((p) => p.id === providerId);

      // Si el modelo especificado no pertenece a este provider (p.ej. durante un failover),
      // descartarlo para que se use el modelo por defecto del provider.
      if (usedModel && info && !info.models.some(m => m.id === usedModel)) {
        usedModel = undefined;
      }

      // Elegir el primer modelo disponible si no se especificó o fue descartado
      if (!usedModel) {
        usedModel = info?.models?.[0]?.id;
      }

      let hasError = false;

      for await (const chunk of provider.chat(contextMessages, {
        ...options,
        model: usedModel,
        signal: options?.signal,
      })) {
        if (chunk.type === "error") {
          lastError = chunk.content;
          if (providerId === preferred) preferredError = chunk.content;
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
        lastError = `${providerId} respondió con un stream vacío.`;
        if (providerId === preferred) preferredError = lastError;
      }
    } catch (err) {
      lastError = `Falla en conexión con ${providerId}: ${err instanceof Error ? err.message : "Error desconocido"}`;
      if (providerId === preferred) preferredError = lastError;
      console.warn(`[Router] Failover desde ${providerId}: ${lastError}`);
      continue; // Probar siguiente provider
    }
  }

  // ── Fallback: ningún provider funcionó ───────────────────
  const errorToShow = preferredError || lastError;
  const isFreeModel = tryOrder.length > 0 && providers.find(p => p.id === preferred)?.tier === 'free';
  
  const mainMessage = isFreeModel 
    ? "No pudimos conectar con el motor de IA seleccionado. Verifica tu conexión a internet o intenta con otro modelo."
    : "No pudimos conectar con ningún motor de IA disponible. Si estás usando modelos Pro, verifica tus configuraciones en BYOK.";

  yield {
    type: "error",
    content: mainMessage,
    providerId: "fallback",
    model: "none",
  } as ChatChunk & RouteResult;

  // Si hubo un error previo y es diferente al mensaje principal, añadirlo como contexto
  // (los errores ya vienen traducidos al español desde aiService.ts)
  if (errorToShow && errorToShow !== mainMessage && !/^[a-z_]+$/.test(errorToShow)) {
    yield {
      type: "error",
      content: `⚠️ ${errorToShow}`,
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
 * Inyecta el system prompt con herramientas y contexto del proyecto.
 */
export async function* streamFromProvider(
  context: Message[],
  preferredProvider?: string,
  options?: { action?: string; subagentId?: string; model?: string; signal?: AbortSignal }
): AsyncGenerator<ChatChunk> {
  const { buildToolSystemPrompt, buildContextWarning } = await import("@/tools/prompts");

  let systemContent = await buildToolSystemPrompt();

  // Estimate tokens from context for the warning
  const contextTokenEstimate = context.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  const warning = buildContextWarning(contextTokenEstimate);
  if (warning) {
    systemContent += warning;
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

  for await (const chunk of routeRequest(messages, { preferredProvider, ...options, signal: options?.signal })) {
    yield chunk;
  }
}
