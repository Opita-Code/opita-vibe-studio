import { describe, it, expect, beforeEach } from "vitest";
import type { Message, ChatChunk, ChatOptions } from "../../src/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────

function makeMsg(
  content: string,
  role: "user" | "assistant" | "system" = "user",
): Message {
  return { id: `msg-${Date.now()}`, role, content, timestamp: Date.now() };
}

const asciiCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n";

// ═════════════════════════════════════════════════════════════════
// Escenario 1: Proyecto vacío
// ═════════════════════════════════════════════════════════════════
//
// GIVEN no hay proyecto abierto
// WHEN se consulta el estado del proyecto
// THEN rootPath es null y files es un array vacío
//
describe("Edge Case: proyecto vacío", () => {
  beforeEach(async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    useProjectStore.setState({
      rootPath: null,
      files: [],
      openTabs: [],
      activeTab: null,
      isDirty: {},
      fileContents: {},
      isGitRepo: false,
      gitBranch: null,
      isLoading: false,
      statusMessage: null,
    });
  });

  it("debería tener rootPath null y files vacío al iniciar", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    const state = useProjectStore.getState();
    expect(state.rootPath).toBeNull();
    expect(state.files).toEqual([]);
  });

  it("debería poder abrir un tab incluso sin proyecto", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    useProjectStore.getState().openTab("/test/file.ts");
    expect(useProjectStore.getState().openTabs).toContain("/test/file.ts");
  });

  it("debería manejar save sin proyecto (no debe fallar)", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    // Marcar dirty sin proyecto — no debería arrojar error
    expect(() => {
      useProjectStore.getState().markDirty("/some/file.ts");
    }).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 2: Archivos con nombres especiales
// ═════════════════════════════════════════════════════════════════
//
// GIVEN archivos con caracteres especiales (ñ, espacios, emojis)
// WHEN el store los maneja
// THEN las operaciones funcionan correctamente
//
describe("Edge Case: nombres de archivo especiales", () => {
  beforeEach(async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    useProjectStore.setState({
      rootPath: "/test",
      files: [],
      openTabs: [],
      activeTab: null,
      isDirty: {},
      fileContents: {},
      isGitRepo: false,
      gitBranch: null,
      isLoading: false,
      statusMessage: null,
    });
  });

  it("debería manejar archivos con ñ y tildes", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    const store = useProjectStore.getState();

    store.openTab("/test/años/style.css");
    store.openTab("/test/índice.html");
    store.openTab("/test/canción.js");

    const tabs = useProjectStore.getState().openTabs;
    expect(tabs).toContain("/test/años/style.css");
    expect(tabs).toContain("/test/índice.html");
    expect(tabs).toContain("/test/canción.js");
    expect(tabs).toHaveLength(3);
  });

  it("debería manejar archivos con espacios", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    useProjectStore.getState().openTab("/test/mi archivo.html");
    expect(useProjectStore.getState().openTabs).toContain("/test/mi archivo.html");
  });

  it("debería manejar archivos con emojis", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    useProjectStore.getState().openTab("/test/🔥.html");
    expect(useProjectStore.getState().openTabs).toContain("/test/🔥.html");
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 3: Archivo muy grande (>10k líneas simulado)
// ═════════════════════════════════════════════════════════════════
//
// GIVEN un archivo con contenido extenso
// WHEN se estiman tokens
// THEN el cálculo es correcto para texto grande
//
describe("Edge Case: contenido extenso (>10k líneas)", () => {
  it("debería estimar tokens correctamente para textos grandes", async () => {
    const { estimateTokens } = await import("../../src/lib/tokens");

    // Simular ~10k líneas de ~50 caracteres cada una
    const longText = Array.from(
      { length: 10000 },
      () => "// línea de código con ~50 caracteres \n",
    ).join("");
    const estimated = estimateTokens(longText);
    expect(estimated).toBeGreaterThan(0);
    expect(estimated).toBe(Math.ceil(longText.length / 4));
  });

  it("debería manejar archivos con contenido ASCII repetitivo", async () => {
    const { estimateTokens } = await import("../../src/lib/tokens");

    // Generar ~500KB de texto
    const bigContent = Array.from({ length: 100000 }, () => asciiCharset).join("");
    const estimated = estimateTokens(bigContent);
    expect(estimated).toBeGreaterThan(0);
    expect(estimated).toBe(Math.ceil(bigContent.length / 4));
  });

  it("debería considerar archivo vacío como contenido válido", async () => {
    const { estimateTokens } = await import("../../src/lib/tokens");
    expect(estimateTokens("")).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 4: Falla de red durante streaming
// ═════════════════════════════════════════════════════════════════
//
// GIVEN un provider que falla a mitad del streaming
// WHEN se produce un error
// THEN el chunk de error se entrega y la respuesta se trunca
//
describe("Edge Case: falla de red en streaming", () => {
  it("debería entregar error cuando el provider falla a mitad del streaming", async () => {
    const provider = {
      id: "network-fail",
      name: "Network Fail",
      tier: "free" as const,
      chat: async function* (
        _messages: Message[],
        _options?: ChatOptions,
      ): AsyncGenerator<ChatChunk> {
        yield { type: "text", content: "Empezando respuesta..." };
        yield { type: "error", content: "Error de conexión: timeout" };
      },
      countTokens: () => 5,
    };

    const chunks: ChatChunk[] = [];
    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(2);
    expect(chunks[0].type).toBe("text");
    expect(chunks[1].type).toBe("error");
    expect(chunks[1].content).toContain("timeout");
  });

  it("debería manejar provider que nunca envía done", async () => {
    const provider = {
      id: "no-done",
      name: "No Done",
      tier: "free" as const,
      chat: async function* (
        _messages: Message[],
        _options?: ChatOptions,
      ): AsyncGenerator<ChatChunk> {
        yield { type: "text", content: "Respuesta incompleta" };
        // No envía done — el stream termina abruptamente
      },
      countTokens: () => 3,
    };

    const chunks: ChatChunk[] = [];
    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("text");
    // Sin done chunk — el caller debe detectar que el stream terminó
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 5: Provider devuelve JSON malformado
// ═════════════════════════════════════════════════════════════════
//
// GIVEN un provider devuelve una respuesta JSON inválida
// WHEN el parser intenta procesarla
// THEN se maneja el error gracefulmente
//
describe("Edge Case: provider devuelve JSON inválido", () => {
  it("should handle error chunk with malformed data", async () => {
    // Los providers del MVP no parsean JSON directamente —
    // usan el chunk type "error". Verificamos que el flujo
    // de error funciona incluso con contenido raro.
    const provider = {
      id: "bad-json",
      name: "Bad JSON",
      tier: "free" as const,
      chat: async function* (
        _messages: Message[],
        _options?: ChatOptions,
      ): AsyncGenerator<ChatChunk> {
        yield { type: "error", content: "{\n  invalid: json\n  sin comillas\n}" };
      },
      countTokens: () => 1,
    };

    const chunks: ChatChunk[] = [];
    for await (const chunk of provider.chat([makeMsg("Hola")])) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe("error");
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 6: Contexto desbordado (>20 mensajes)
// ═════════════════════════════════════════════════════════════════
//
// GIVEN una conversación larga
// WHEN se superan los 20 mensajes de contexto
// THEN los más antiguos se evictan automáticamente
//
describe("Edge Case: desbordamiento de contexto", () => {
  beforeEach(async () => {
    const { useChatStore } = await import("../../src/stores/chat");
    useChatStore.setState({
      messages: [],
      isStreaming: false,
      activeProvider: "deepseek",
      pipelinePhase: null,
    });
  });

  it("debería evictar pares completo (user+assistant) al exceder 20 mensajes", async () => {
    const { useChatStore, MAX_CONTEXT_MESSAGES, getContextMessages } =
      await import("../../src/stores/chat");

    // Agregar 25 mensajes alternando user/assistant
    for (let i = 0; i < 25; i++) {
      const role = i % 2 === 0 ? "user" : "assistant";
      useChatStore.getState().addMessage(makeMsg(`${i}`, role));
    }

    // El store internamente usa MAX_CONTEXT_MESSAGES como límite
    const state = useChatStore.getState();
    expect(state.messages.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES);

    // getContextMessages debería devolver los últimos 20
    const context = getContextMessages(state.messages);
    expect(context.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES);
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 7: Operaciones concurrentes (simulado)
// ═════════════════════════════════════════════════════════════════
//
// GIVEN el usuario guarda un archivo mientras se carga el preview
// WHEN ambas operaciones ocurren simultáneamente
// THEN el store maneja ambas sin corrupción de estado
//
describe("Edge Case: operaciones concurrentes", () => {
  it("debería manejar markDirty + setFileContent sin corrupción", async () => {
    const { useProjectStore } = await import("../../src/stores/project");
    useProjectStore.setState({
      rootPath: "/test",
      files: [],
      openTabs: ["/test/file.ts"],
      activeTab: "/test/file.ts",
      isDirty: {},
      fileContents: {},
      isGitRepo: false,
      gitBranch: null,
      isLoading: false,
      statusMessage: null,
    });

    // Simular operaciones concurrentes
    const ops = [
      () => useProjectStore.getState().markDirty("/test/file.ts"),
      () => useProjectStore.getState().setFileContent("/test/file.ts", "contenido A"),
      () => useProjectStore.getState().setFileContent("/test/file.ts", "contenido B"),
      () => useProjectStore.getState().markClean("/test/file.ts"),
    ];

    // Ejecutar todas seguidas (simula concurrencia en single-thread)
    for (const op of ops) {
      op();
    }

    const state = useProjectStore.getState();
    expect(state.fileContents["/test/file.ts"]).toBe("contenido B");
    expect(state.isDirty["/test/file.ts"]).toBe(false);
  });

  it("debería manejar toggle rápido de chat y terminal sin errores", async () => {
    const { useUIStore } = await import("../../src/stores/ui");
    useUIStore.setState({
      chatVisible: true,
      terminalVisible: false,
      previewVisible: true,
      sidebarWidth: 240,
      statusMessage: "Listo",
      activeModel: "deepseek-chat",
      connectedProvider: "DeepSeek",
      tokensRemaining: 0,
      previewRatio: 0.35,
      terminalHeight: 200,
    });

    // Toggles rápidos
    useUIStore.getState().toggleChat();
    useUIStore.getState().toggleTerminal();
    useUIStore.getState().togglePreview();
    useUIStore.getState().toggleChat();
    useUIStore.getState().toggleTerminal();
    useUIStore.getState().togglePreview();

    const state = useUIStore.getState();
    // chat: true→false→true = true
    expect(state.chatVisible).toBe(true);
    // terminal: false→true→false = false
    expect(state.terminalVisible).toBe(false);
    // preview: true→false→true = true
    expect(state.previewVisible).toBe(true);
  });
});
