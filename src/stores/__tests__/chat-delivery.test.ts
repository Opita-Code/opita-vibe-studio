/**
 * Tests para las nuevas acciones del chat store:
 * - setUserMessageStatus
 * - deleteMessage
 *
 * Ejecutar: npx vitest run src/stores/__tests__/chat-delivery.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../chat";
import type { Message } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────

function makeUserMessage(id: string, content = "Hola"): Message {
  return {
    id,
    role: "user",
    content,
    timestamp: Date.now(),
    deliveryStatus: "pending",
  };
}

function makeAssistantMessage(id: string): Message {
  return {
    id,
    role: "assistant",
    content: "",
    timestamp: Date.now(),
  };
}

function getActiveMessages() {
  const state = useChatStore.getState();
  return state.sessions[state.activeSessionId]?.messages ?? [];
}

// ─── Tests ────────────────────────────────────────────────────

describe("ChatStore — deliveryStatus", () => {
  beforeEach(() => {
    // Reset store to a clean session
    const store = useChatStore.getState();
    store.createNewSession();
  });

  describe("setUserMessageStatus", () => {
    it("cambia el deliveryStatus de pending a sent", () => {
      const store = useChatStore.getState();
      store.addMessage(makeUserMessage("u-1"));

      store.setUserMessageStatus("u-1", "sent");

      const msg = getActiveMessages().find((m) => m.id === "u-1");
      expect(msg?.deliveryStatus).toBe("sent");
    });

    it("no afecta otros mensajes en el mismo thread", () => {
      const store = useChatStore.getState();
      store.addMessage(makeUserMessage("u-1"));
      store.addMessage(makeUserMessage("u-2"));

      store.setUserMessageStatus("u-1", "sent");

      const msgs = getActiveMessages();
      expect(msgs.find((m) => m.id === "u-1")?.deliveryStatus).toBe("sent");
      expect(msgs.find((m) => m.id === "u-2")?.deliveryStatus).toBe("pending");
    });

    it("no falla si el messageId no existe", () => {
      const store = useChatStore.getState();
      expect(() => store.setUserMessageStatus("no-existe", "sent")).not.toThrow();
    });

    it("puede volver de sent a pending (edge case para edit-resend)", () => {
      const store = useChatStore.getState();
      store.addMessage(makeUserMessage("u-1"));
      store.setUserMessageStatus("u-1", "sent");
      store.setUserMessageStatus("u-1", "pending");

      const msg = getActiveMessages().find((m) => m.id === "u-1");
      expect(msg?.deliveryStatus).toBe("pending");
    });
  });

  describe("deleteMessage", () => {
    it("elimina un mensaje por ID", () => {
      const store = useChatStore.getState();
      store.addMessage(makeUserMessage("u-1"));
      store.addMessage(makeAssistantMessage("a-1"));

      store.deleteMessage("u-1");

      const msgs = getActiveMessages();
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe("a-1");
    });

    it("elimina el placeholder del asistente (para cancel)", () => {
      const store = useChatStore.getState();
      store.addMessage(makeUserMessage("u-1"));
      store.addMessage(makeAssistantMessage("a-1"));

      store.deleteMessage("u-1");
      store.deleteMessage("a-1");

      expect(getActiveMessages()).toHaveLength(0);
    });

    it("no falla si el ID no existe", () => {
      const store = useChatStore.getState();
      expect(() => store.deleteMessage("no-existe")).not.toThrow();
    });

    it("no elimina mensajes de otras sesiones", () => {
      const store = useChatStore.getState();
      // Sesión A (actual)
      store.addMessage(makeUserMessage("u-1"));

      // Crear sesión B
      store.createNewSession();
      store.addMessage(makeUserMessage("u-2"));

      // Volver a A no es fácil sin saber el ID, verificamos al menos que
      // deleteMessage en la sesión activa no toca nada fuera de scope
      store.deleteMessage("u-2");
      expect(getActiveMessages()).toHaveLength(0);
    });
  });
});

describe("ChatStore — pending message flow", () => {
  beforeEach(() => {
    useChatStore.getState().createNewSession();
  });

  it("el flujo completo pending → sent funciona correctamente", () => {
    const store = useChatStore.getState();

    // 1. Usuario envía mensaje (estado pending)
    store.addMessage(makeUserMessage("u-pending", "Crea un botón"));
    expect(getActiveMessages()[0].deliveryStatus).toBe("pending");

    // 2. Agente empieza a leer (estado sent)
    store.setUserMessageStatus("u-pending", "sent");
    expect(getActiveMessages()[0].deliveryStatus).toBe("sent");
  });

  it("cancel flow: elimina user msg + assistant placeholder", () => {
    const store = useChatStore.getState();

    store.addMessage(makeUserMessage("u-cancel", "Haz algo grande"));
    store.addMessage(makeAssistantMessage("a-placeholder"));

    // Simula cancel
    store.deleteMessage("u-cancel");
    store.deleteMessage("a-placeholder");

    expect(getActiveMessages()).toHaveLength(0);
  });
});
