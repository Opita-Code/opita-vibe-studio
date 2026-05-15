/**
 * Test unitario para el contexto del chat (token-aware).
 * Ejecutar: npx vitest run src/stores/__tests__/chat-context.test.ts
 */
import { describe, it, expect } from "vitest";
import { getContextMessages } from "../chat";
import type { Message } from "@/lib/types";

function makeMessage(content: string, role: "user" | "assistant" | "system" = "user"): Message {
  return {
    id: `msg-${Math.random()}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

describe("getContextMessages — Token-Aware Context", () => {
  it("retorna todos los mensajes si están dentro del budget", () => {
    const messages = [
      makeMessage("Hola"),
      makeMessage("¿En qué te ayudo?", "assistant"),
      makeMessage("Crear un componente"),
    ];

    const result = getContextMessages(messages);
    expect(result).toHaveLength(3);
  });

  it("retorna mensajes vacíos como array vacío", () => {
    expect(getContextMessages([])).toHaveLength(0);
  });

  it("recorta mensajes antiguos cuando se supera el budget", () => {
    // 32K tokens ≈ 128K chars. Creamos mensajes que excedan eso.
    const bigContent = "x".repeat(50_000); // ~12,500 tokens each
    const messages = [
      makeMessage(bigContent + "-1"), // Este debería descartarse
      makeMessage(bigContent + "-2"),
      makeMessage(bigContent + "-3"),
      makeMessage("último mensaje corto"),
    ];

    const result = getContextMessages(messages);

    // No deberían caber los 4, pero sí los más recientes
    expect(result.length).toBeLessThan(4);
    // El último mensaje SIEMPRE debe estar presente
    expect(result[result.length - 1].content).toBe("último mensaje corto");
  });

  it("preserva los mensajes más recientes, no los más antiguos", () => {
    const filler = "a".repeat(100_000); // ~25K tokens, casi llena el budget
    const messages = [
      makeMessage("antiguo-1"),
      makeMessage("antiguo-2"),
      makeMessage(filler),
      makeMessage("reciente"),
    ];

    const result = getContextMessages(messages);

    // El "reciente" debe estar
    expect(result.some((m) => m.content === "reciente")).toBe(true);
    // El más antiguo probablemente no cabe
    const hasAntiguo1 = result.some((m) => m.content === "antiguo-1");
    const hasReciente = result.some((m) => m.content === "reciente");
    expect(hasReciente).toBe(true);
    // Si el budget se llena, los antiguos se descartan
    if (result.length < messages.length) {
      expect(hasAntiguo1).toBe(false);
    }
  });

  it("un solo mensaje enorme siempre se incluye (no dejamos vacío)", () => {
    const huge = "x".repeat(200_000); // ~50K tokens, excede budget
    const messages = [makeMessage(huge)];

    const result = getContextMessages(messages);
    // Incluso si excede, al menos 1 mensaje debe incluirse
    expect(result).toHaveLength(1);
  });

  it("mensajes pequeños caben muchos", () => {
    const messages: Message[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push(makeMessage(`Mensaje ${i}`, i % 2 === 0 ? "user" : "assistant"));
    }

    const result = getContextMessages(messages);
    // 100 mensajes cortos deberían caber todos (~20 chars each → ~500 tokens total)
    expect(result).toHaveLength(100);
  });
});
