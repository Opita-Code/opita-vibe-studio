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
    type: "text",
    content: "Configurá una API key en Ajustes > Proveedores para usar modelos reales.",
    providerId: "fallback",
    model: "none",
  } as ChatChunk & RouteResult;

  // Si hubo un error previo, mostrarlo
  if (lastError) {
    yield {
      type: "text",
      content: `\n\nMotivo: ${lastError}`,
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
  prompt: string,
  context: Message[],
  preferredProvider?: string,
): AsyncGenerator<ChatChunk> {
  const messages: Message[] = [
    ...context,
    {
      id: `prompt-${Date.now()}`,
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    },
  ];

  for await (const chunk of routeRequest(messages, { preferredProvider })) {
    yield chunk;
  }
}
