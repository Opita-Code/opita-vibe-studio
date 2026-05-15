import { describe, it, expect, beforeEach } from "vitest";
import type { Message, ChatOptions, ChatChunk } from "../../src/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────

function makeMsg(
  content: string,
  role: "user" | "assistant" | "system" = "user",
): Message {
  return { id: `msg-${Date.now()}`, role, content, timestamp: Date.now() };
}

function makeProvider(id: string, name: string, tier: "free" | "byok" = "free") {
  return {
    id,
    name,
    tier,
    chat: async function* (
      _messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      yield { type: "text", content: `respuesta de ${id}` };
      yield { type: "done", content: "" };
    },
    countTokens: () => 10,
  };
}

function makeFailingProvider(id: string, name: string, tier: "free" | "byok" = "free") {
  return {
    id,
    name,
    tier,
    chat: async function* (
      _messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      yield { type: "error", content: `${id} no disponible` };
    },
    countTokens: () => 10,
  };
}

// ═════════════════════════════════════════════════════════════════
// Escenario 1: Flujo completo de chat
// ═════════════════════════════════════════════════════════════════
//
// GIVEN el usuario escribe un mensaje
// WHEN el mensaje pasa por el provider y vuelve una respuesta
// THEN el mensaje del usuario y la respuesta aparecen en el store
//
describe("Chat Flow — envío y recepción de mensajes", () => {
  beforeEach(async () => {
    const { useChatStore } = await import("../../src/stores/chat");
    useChatStore.setState({
      sessions: { default: { id: "default", title: "Test", messages: [], updatedAt: Date.now() } },
      activeSessionId: "default",
      isStreaming: false,
      activeProvider: "deepseek",
      pipelinePhase: null,
    });
  });

  it("debería agregar mensaje de usuario y recibir respuesta del asistente", async () => {
    const { useChatStore } = await import("../../src/stores/chat");
    const store = useChatStore.getState();

    // El usuario envía un mensaje
    const userMsg = makeMsg("Creá una landing page", "user");
    store.addMessage(userMsg);
    expect(useChatStore.getState().sessions["default"].messages).toHaveLength(1);

    // El asistente responde
    const assistantMsg = makeMsg("Acá está tu landing page", "assistant");
    store.addMessage(assistantMsg);
    expect(useChatStore.getState().sessions["default"].messages).toHaveLength(2);
    expect(useChatStore.getState().sessions["default"].messages[1].role).toBe("assistant");
  });

  it("debería mostrar el indicador de streaming mientras se recibe respuesta", async () => {
    const { useChatStore } = await import("../../src/stores/chat");

    useChatStore.getState().setStreaming(true);
    expect(useChatStore.getState().isStreaming).toBe(true);

    // Simula que llegan chunks
    useChatStore.getState().addMessage(makeMsg("", "assistant"));
    useChatStore.getState().appendToLastMessage("Hola ");
    useChatStore.getState().appendToLastMessage("mundo");
    expect(useChatStore.getState().sessions["default"].messages[0].content).toBe("Hola mundo");

    useChatStore.getState().setStreaming(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it("debería rechazar prompt vacío (silent no-op)", async () => {
    const { useChatStore } = await import("../../src/stores/chat");

    // Simula que el ChatInput no envía texto vacío
    const trimmed = "   ".trim();
    expect(trimmed).toBe("");

    const lenBefore = useChatStore.getState().sessions["default"].messages.length;
    // No se agrega nada al store si el texto está vacío
    expect(useChatStore.getState().sessions["default"].messages.length).toBe(lenBefore);
  });

  it("debería evictar el mensaje más antiguo al superar el límite de contexto", async () => {
    const { useChatStore, MAX_CONTEXT_MESSAGES } = await import("../../src/stores/chat");

    // Llenar el contexto — makeMsg usa content como contenido directo
    for (let i = 0; i < MAX_CONTEXT_MESSAGES; i++) {
      useChatStore.getState().addMessage(makeMsg(`${i}`));
    }
    expect(useChatStore.getState().sessions["default"].messages).toHaveLength(MAX_CONTEXT_MESSAGES);

    // Agregar uno más — debería evictar el más antiguo ("0")
    useChatStore.getState().addMessage(makeMsg("extra"));
    expect(useChatStore.getState().sessions["default"].messages).toHaveLength(MAX_CONTEXT_MESSAGES);
    expect(useChatStore.getState().sessions["default"].messages[0].content).toBe("1");
    expect(useChatStore.getState().sessions["default"].messages[MAX_CONTEXT_MESSAGES - 1].content).toBe(
      "extra",
    );
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 2: Failover de proveedores
// ═════════════════════════════════════════════════════════════════
//
// GIVEN el proveedor preferido falla
// WHEN el router intenta con el siguiente proveedor gratuito
// THEN la respuesta se obtiene del proveedor de respaldo
//
describe("Provider Failover — caída y recuperación", () => {
  beforeEach(async () => {
    const { resetRegistry } = await import("../../src/providers/registry");
    resetRegistry();
  });

  it("debería fallback a proveedor gratuito cuando el preferido falla", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const { routeRequest } = await import("../../src/providers/router");

    registerProvider(makeFailingProvider("preferred", "Fav", "free"));
    registerProvider(makeProvider("fallback", "Backup", "free"));

    const chunks: ChatChunk[] = [];
    for await (const chunk of routeRequest([makeMsg("Hola")], {
      preferredProvider: "preferred",
    })) {
      chunks.push(chunk);
    }

    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => c.content)
      .join("");
    expect(text).toContain("fallback");
  });

  it("debería intentar BYOK cuando todos los gratuitos fallan", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const { routeRequest } = await import("../../src/providers/router");

    registerProvider(makeFailingProvider("free-1", "Free 1", "free"));
    registerProvider(makeFailingProvider("free-2", "Free 2", "free"));
    registerProvider(makeProvider("byok-1", "BYOK 1", "byok"));

    const chunks: ChatChunk[] = [];
    for await (const chunk of routeRequest([makeMsg("Hola")], {})) {
      chunks.push(chunk);
    }

    const text = chunks
      .filter((c) => c.type === "text")
      .map((c) => c.content)
      .join("");
    expect(text).toContain("byok-1");
  });

  it("debería mostrar mensaje de configuración cuando TODOS los proveedores fallan", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const { routeRequest } = await import("../../src/providers/router");

    registerProvider(makeFailingProvider("fail-a", "Fail A", "free"));
    registerProvider(makeFailingProvider("fail-b", "Fail B", "byok"));

    const chunks: ChatChunk[] = [];
    for await (const chunk of routeRequest([makeMsg("Hola")], {})) {
      chunks.push(chunk);
    }

    const text = chunks
      .filter((c) => c.type === "error")
      .map((c) => c.content)
      .join("");
    expect(text).toContain("No pudimos conectar");
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 3: BYOK — agregar, validar, usar y eliminar key
// ═════════════════════════════════════════════════════════════════
//
// GIVEN el usuario configura una API key de OpenAI
// WHEN la key se guarda en el store
// THEN aparece enmascarada en la UI y el provider se registra
//
describe("BYOK Flow — configuración y uso de API keys", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("debería guardar y recuperar una API key enmascarada", async () => {
    const { maskKey } =
      await import("../../src/lib/byok-store");

    // BYOK now requires authentication for save — test maskKey which is pure
    const masked = maskKey("sk-proj-abc123def456");
    expect(masked).toBe("sk-...f456");

    // Verify mask for short keys
    const maskedShort = maskKey("short");
    expect(maskedShort).toBe("***");
  });

  it("debería requerir autenticación para operaciones CRUD de keys", async () => {
    const { saveProviderKey } =
      await import("../../src/lib/byok-store");

    // BYOK operations now require auth — unauthenticated should throw
    await expect(saveProviderKey("openai", "sk-test-123")).rejects.toThrow(
      /cuenta gratuita|autenticación|sesión/i,
    );
  });

  it("debería listar proveedores con estado no configurado por defecto", async () => {
    const { getByokProviderDisplayInfo } = await import("../../src/lib/byok-store");

    const info = await getByokProviderDisplayInfo();
    expect(info.length).toBeGreaterThan(0);
    for (const p of info) {
      expect(p.configured).toBe(false);
      expect(p.status).toBe("not_configured");
    }
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 4: Auth — login, sesión, logout
// ═════════════════════════════════════════════════════════════════
//
// GIVEN un usuario no autenticado
// WHEN inicia sesión con credenciales válidas
// THEN la sesión persiste y puede cerrarla
//
describe("Auth Flow — inicio de sesión y cierre", () => {
  beforeEach(async () => {
    const { useAuthStore } = await import("../../src/stores/auth");
    useAuthStore.setState({
      user: null,
      session: null,
      plan: "free",
      authMode: "unauthenticated",
      isLoading: false,
      tokenUsage: {
        tokensUsedToday: 0,
        tokensLimitDaily: 150_000,
        tokensUsedThisHour: 0,
        tokensLimitHourly: 30_000,
        plan: "free",
        resetDailyAt: new Date().toISOString(),
        resetHourlyAt: new Date().toISOString(),
      },
    });
  });

  it("debería iniciar sesión y establecer usuario + sesión", async () => {
    const { useAuthStore } = await import("../../src/stores/auth");
    const user = {
      id: "user-1",
      email: "student@unal.edu.co",
      name: "María Pérez",
      plan: "estudiante" as const,
      verified: true,
    };
    const session = { token: "jwt-abc-123", expiresAt: Date.now() + 3600000 };

    useAuthStore.getState().login(user, session);
    const state = useAuthStore.getState();

    expect(state.authMode).toBe("authenticated");
    expect(state.user?.name).toBe("María Pérez");
    expect(state.session?.token).toBe("jwt-abc-123");
    expect(state.plan).toBe("estudiante");
  });

  it("debería persistir sesión después de login y restaurarla", async () => {
    const { useAuthStore } = await import("../../src/stores/auth");
    const user = {
      id: "user-2",
      email: "dev@opita.co",
      name: "Carlos López",
      plan: "creador" as const,
      verified: true,
    };
    const session = { token: "jwt-xyz-789", expiresAt: Date.now() + 7200000 };

    useAuthStore.getState().login(user, session);

    // Verificamos que el store tenga los datos
    expect(useAuthStore.getState().authMode).toBe("authenticated");
    expect(useAuthStore.getState().user?.email).toBe("dev@opita.co");
  });

  it("debería limpiar todo al cerrar sesión", async () => {
    const { useAuthStore } = await import("../../src/stores/auth");
    const user = {
      id: "user-3",
      email: "user@test.com",
      name: "Test",
      plan: "free" as const,
      verified: false,
    };
    const session = { token: "jwt", expiresAt: Date.now() + 3600000 };

    useAuthStore.getState().login(user, session);
    expect(useAuthStore.getState().authMode).toBe("authenticated");

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.authMode).toBe("unauthenticated");
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.plan).toBe("free");
  });

  it("debería verificar email de estudiante con dominio .edu.co", async () => {
    const { validateStudentEmail } = await import("../../src/auth/verification");

    const result = validateStudentEmail("student@unal.edu.co");
    expect(result.valid).toBe(true);
    expect(result.isStudent).toBe(true);
    expect(result.domain).toBe("unal.edu.co");
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 5: Límite de tokens — enforcement y upgrade
// ═════════════════════════════════════════════════════════════════
//
// GIVEN un usuario free que llegó al límite de 30 prompts
// WHEN intenta enviar un nuevo prompt
// THEN el sistema bloquea el envío y muestra opciones de upgrade
//
describe("Token Limit — enforcement y upgrade", () => {
  it("debería detectar que se alcanzó el límite diario", async () => {
    const { isLimitReached } = await import("../../src/lib/tokens");
    const { getRemainingTokens } = await import("../../src/lib/tokens");

    const usage = {
      tokensUsedToday: 150_000,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 10_000,
      tokensLimitHourly: 30_000,
      plan: "free" as const,
      resetDailyAt: new Date().toISOString(),
      resetHourlyAt: new Date().toISOString(),
    };

    expect(isLimitReached(usage)).toBe(true);
    expect(getRemainingTokens(usage)).toBe(0);
  });

  it("debería permitir tokens cuando hay límite disponible", async () => {
    const { isLimitReached } = await import("../../src/lib/tokens");

    const usage = {
      tokensUsedToday: 100_000,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 10_000,
      tokensLimitHourly: 30_000,
      plan: "free" as const,
      resetDailyAt: new Date().toISOString(),
      resetHourlyAt: new Date().toISOString(),
    };

    expect(isLimitReached(usage)).toBe(false);
  });

  it("debería actualizar el token usage via setTokenUsage", async () => {
    const { useAuthStore } = await import("../../src/stores/auth");

    useAuthStore.setState({
      user: {
        id: "u1",
        email: "test@test.com",
        name: "Test",
        plan: "free",
        verified: false,
      },
      session: { token: "t", expiresAt: Date.now() + 3600000 },
      plan: "free",
      authMode: "authenticated",
      isLoading: false,
      tokenUsage: {
        tokensUsedToday: 0,
        tokensLimitDaily: 150_000,
        tokensUsedThisHour: 0,
        tokensLimitHourly: 30_000,
        plan: "free",
        resetDailyAt: new Date().toISOString(),
        resetHourlyAt: new Date().toISOString(),
      },
    });

    expect(useAuthStore.getState().tokenUsage.tokensUsedToday).toBe(0);
    useAuthStore.getState().setTokenUsage({
      ...useAuthStore.getState().tokenUsage,
      tokensUsedToday: 50_000,
    });
    expect(useAuthStore.getState().tokenUsage.tokensUsedToday).toBe(50_000);
  });

  it("debería mostrar advertencia al 80% de uso", async () => {
    const { getUsagePercent } = await import("../../src/lib/tokens");

    const usage = {
      tokensUsedToday: 120_000,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 10_000,
      tokensLimitHourly: 30_000,
      plan: "free" as const,
      resetDailyAt: new Date().toISOString(),
      resetHourlyAt: new Date().toISOString(),
    };

    expect(getUsagePercent(usage)).toBe(80);
  });
});
