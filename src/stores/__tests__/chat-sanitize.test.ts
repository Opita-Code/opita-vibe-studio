/**
 * Tests para la sanitización de mensajes pending al rehidratar el store.
 *
 * Ejecutar: npx vitest run src/stores/__tests__/chat-sanitize.test.ts
 */

import { describe, it, expect } from "vitest";
import { sanitizeSessionMessages } from "../chat-sanitize";
import type { Message } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────

function makeMsg(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    role: "user",
    content: "Hola",
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe("sanitizeSessionMessages", () => {
  it("elimina mensajes con deliveryStatus=pending", () => {
    const messages: Message[] = [
      makeMsg({ id: "1", deliveryStatus: "pending" }),
      makeMsg({ id: "2", deliveryStatus: "sent" }),
      makeMsg({ id: "3", role: "assistant", content: "Respuesta" }),
    ];

    const result = sanitizeSessionMessages(messages);
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.id === "1")).toBeUndefined();
  });

  it("elimina el placeholder de asistente vacío que sigue a un pending eliminado", () => {
    // Patrón típico: [user pending, assistant placeholder vacío]
    const messages: Message[] = [
      makeMsg({ id: "user-1", role: "user", deliveryStatus: "pending" }),
      makeMsg({ id: "assistant-1", role: "assistant", content: "" }),
    ];

    const result = sanitizeSessionMessages(messages);
    expect(result).toHaveLength(0);
  });

  it("no elimina el placeholder de asistente si tiene contenido", () => {
    const messages: Message[] = [
      makeMsg({ id: "user-1", role: "user", deliveryStatus: "pending" }),
      makeMsg({ id: "assistant-1", role: "assistant", content: "Respuesta parcial..." }),
    ];

    const result = sanitizeSessionMessages(messages);
    // El user pending se elimina, pero el assistant con contenido se conserva
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("assistant-1");
  });

  it("no toca mensajes sin deliveryStatus", () => {
    const messages: Message[] = [
      makeMsg({ id: "1" }),
      makeMsg({ id: "2", role: "assistant", content: "Respuesta" }),
    ];

    const result = sanitizeSessionMessages(messages);
    expect(result).toHaveLength(2);
  });

  it("no toca mensajes con deliveryStatus=sent", () => {
    const messages: Message[] = [
      makeMsg({ id: "1", deliveryStatus: "sent" }),
    ];

    const result = sanitizeSessionMessages(messages);
    expect(result).toHaveLength(1);
  });

  it("maneja array vacío sin errores", () => {
    expect(sanitizeSessionMessages([])).toHaveLength(0);
  });

  it("elimina múltiples pendientes en la misma sesión", () => {
    const messages: Message[] = [
      makeMsg({ id: "1", deliveryStatus: "sent" }),
      makeMsg({ id: "2", deliveryStatus: "pending" }),
      makeMsg({ id: "3", role: "assistant", content: "" }), // placeholder del 2
      makeMsg({ id: "4", deliveryStatus: "sent" }),
      makeMsg({ id: "5", deliveryStatus: "pending" }),
      makeMsg({ id: "6", role: "assistant", content: "" }), // placeholder del 5
    ];

    const result = sanitizeSessionMessages(messages);
    // Solo quedan los "sent"
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["1", "4"]);
  });
});
