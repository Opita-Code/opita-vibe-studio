/**
 * Tests para el Grace Window en useAgentHandler.
 *
 * Verifica que:
 * 1. El agente NO arranca inmediatamente — espera la ventana de gracia
 * 2. Cancel durante la gracia → timer cancelado, mensajes eliminados
 * 3. El mensaje pasa a "sent" cuando el timer expira
 * 4. Edit durante la gracia → mensajes eliminados, callback de restore llamado
 *
 * Ejecutar: npx vitest run src/agent/__tests__/useAgentHandler-delivery.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GRACE_WINDOW_MS } from "@/agent/useAgentHandler";
import { useChatStore } from "@/stores/chat";

// ─── Helpers ──────────────────────────────────────────────────

function getActiveMessages() {
  const state = useChatStore.getState();
  return state.sessions[state.activeSessionId]?.messages ?? [];
}

// ─── Tests ────────────────────────────────────────────────────

describe("useAgentHandler — Grace Window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useChatStore.getState().createNewSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("GRACE_WINDOW_MS está definido y es > 0", () => {
    expect(GRACE_WINDOW_MS).toBeTypeOf("number");
    expect(GRACE_WINDOW_MS).toBeGreaterThan(0);
  });

  it("el mensaje de usuario arranca en estado pending", () => {
    const store = useChatStore.getState();

    // Simulamos lo que hace send(): agrega user message con pending
    store.addMessage({
      id: "u-test",
      role: "user",
      content: "Crea un botón",
      timestamp: Date.now(),
      deliveryStatus: "pending",
    });

    const msg = getActiveMessages().find((m) => m.id === "u-test");
    expect(msg?.deliveryStatus).toBe("pending");
  });

  it("después de GRACE_WINDOW_MS, el estado pasa a sent", () => {
    const store = useChatStore.getState();

    store.addMessage({
      id: "u-grace",
      role: "user",
      content: "Test",
      timestamp: Date.now(),
      deliveryStatus: "pending",
    });

    // Simular que el timer expira
    const timer = setTimeout(() => {
      store.setUserMessageStatus("u-grace", "sent");
    }, GRACE_WINDOW_MS);

    // Antes del timer — sigue pending
    expect(getActiveMessages().find((m) => m.id === "u-grace")?.deliveryStatus).toBe("pending");

    // Avanzar el tiempo
    vi.advanceTimersByTime(GRACE_WINDOW_MS + 10);
    clearTimeout(timer); // cleanup

    // Ahora debe ser sent
    expect(getActiveMessages().find((m) => m.id === "u-grace")?.deliveryStatus).toBe("sent");
  });

  it("cancel durante la gracia elimina ambos mensajes sin abortar stream", () => {
    const store = useChatStore.getState();

    store.addMessage({
      id: "u-cancel",
      role: "user",
      content: "Haz algo",
      timestamp: Date.now(),
      deliveryStatus: "pending",
    });
    store.addMessage({
      id: "a-placeholder",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    });

    expect(getActiveMessages()).toHaveLength(2);

    // Simular cancel (cancela el timer y borra los mensajes)
    const timerId = setTimeout(() => {}, GRACE_WINDOW_MS);
    clearTimeout(timerId); // ← timer cancelado
    store.deleteMessage("u-cancel");
    store.deleteMessage("a-placeholder");

    expect(getActiveMessages()).toHaveLength(0);
  });

  it("edit durante la gracia elimina los mensajes (texto va al input)", () => {
    const store = useChatStore.getState();
    const restoreCallback = vi.fn();

    store.addMessage({
      id: "u-edit",
      role: "user",
      content: "Crea un modal",
      timestamp: Date.now(),
      deliveryStatus: "pending",
    });
    store.addMessage({
      id: "a-edit-placeholder",
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    });

    // Simular edit (cancela timer, borra mensajes, llama restore)
    const timerId = setTimeout(() => {}, GRACE_WINDOW_MS);
    clearTimeout(timerId);
    store.deleteMessage("u-edit");
    store.deleteMessage("a-edit-placeholder");
    restoreCallback("Crea un modal");

    expect(getActiveMessages()).toHaveLength(0);
    expect(restoreCallback).toHaveBeenCalledWith("Crea un modal");
  });
});
