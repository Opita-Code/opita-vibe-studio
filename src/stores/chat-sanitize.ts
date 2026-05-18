/**
 * chat-sanitize — Sanitización de mensajes al rehidratar el chatStore.
 *
 * Problema: si el browser se cierra durante la grace window (2.5s),
 * el mensaje queda persistido con deliveryStatus="pending". Al reabrir,
 * los botones Cancel/Edit aparecen sin timer activo → UI rota.
 *
 * Solución: al rehidratar, eliminar todos los mensajes pending y sus
 * placeholders de asistente vacíos asociados (el par siempre viaja junto).
 */

import type { Message } from "@/lib/types";

/**
 * Limpia mensajes `pending` y sus placeholders de asistente vacíos
 * de una lista de mensajes de sesión.
 *
 * Reglas:
 * - Mensaje user con `deliveryStatus: "pending"` → eliminar
 * - Si el mensaje siguiente es un assistant con `content: ""` → también eliminar
 * - Mensajes sin `deliveryStatus` o con `deliveryStatus: "sent"` → conservar
 */
export function sanitizeSessionMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "user" && msg.deliveryStatus === "pending") {
      // Saltar el mensaje pending
      const next = messages[i + 1];
      // Si el siguiente es un placeholder de asistente vacío, también saltarlo
      if (next && next.role === "assistant" && next.content === "") {
        i += 2; // saltar ambos
      } else {
        i += 1; // solo saltar el pending
      }
      continue;
    }

    result.push(msg);
    i += 1;
  }

  return result;
}

/**
 * Aplica sanitizeSessionMessages a todas las sesiones de un mapa de sesiones.
 * Uso: en onRehydrateStorage del chatStore.
 */
export function sanitizeAllSessions<T extends { messages: Message[] }>(
  sessions: Record<string, T>
): Record<string, T> {
  const sanitized: Record<string, T> = {};

  for (const [id, session] of Object.entries(sessions)) {
    sanitized[id] = {
      ...session,
      messages: sanitizeSessionMessages(session.messages),
    };
  }

  return sanitized;
}
