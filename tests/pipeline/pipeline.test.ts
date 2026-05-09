import { describe, it, expect, beforeEach } from "vitest";
import {
  detectCodeRequest,
  toMessages,
  collectResponse,
  MAX_VERIFY_RETRIES,
} from "../../src/pipeline/engine";
import { parseEntenderResponse } from "../../src/pipeline/entender";
import {
  parseConstruirResponse,
  parseConstruirResponseFallback,
} from "../../src/pipeline/construir";
import { parseVerificarResponse } from "../../src/pipeline/verificar";
import {
  buildEntenderMessages,
  buildConstruirMessages,
  buildVerificarMessages,
} from "../../src/pipeline/prompts";
import type { Message, ChatChunk } from "../../src/lib/types";

// ─── Helpers ───────────────────────────────────────────────────

function makeMsg(
  content: string,
  role: "user" | "assistant" | "system" = "user",
): Message {
  return {
    id: `msg-${Date.now()}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

// ─── detectCodeRequest ─────────────────────────────────────────

describe("detectCodeRequest", () => {
  it("should return false when no project is open", () => {
    expect(detectCodeRequest("Quiero crear una página", false)).toBe(false);
  });

  it("should return false for very short messages", () => {
    expect(detectCodeRequest("Hola", true)).toBe(false);
    expect(detectCodeRequest("Si", true)).toBe(false);
  });

  it("should detect 'crear' keyword", () => {
    expect(detectCodeRequest("Quiero crear una página de inicio", true)).toBe(true);
  });

  it("should detect 'hacer' keyword", () => {
    expect(detectCodeRequest("Necesito hacer un formulario de contacto", true)).toBe(
      true,
    );
  });

  it("should detect 'construir' keyword", () => {
    expect(detectCodeRequest("Ayudame a construir un portfolio", true)).toBe(true);
  });

  it("should detect 'cambiar' keyword", () => {
    expect(detectCodeRequest("Quiero cambiar el estilo del menú", true)).toBe(true);
  });

  it("should detect 'modificar' keyword", () => {
    expect(detectCodeRequest("Necesito modificar el layout", true)).toBe(true);
  });

  it("should detect 'página' keyword", () => {
    expect(detectCodeRequest("Crea una página de contacto", true)).toBe(true);
  });

  it("should detect 'código' keyword", () => {
    expect(detectCodeRequest("Revisá este código que hice", true)).toBe(true);
  });

  it("should return false for non-code questions", () => {
    expect(detectCodeRequest("¿Cuál es tu color favorito?", true)).toBe(false);
    expect(detectCodeRequest("¿Cómo está el clima hoy?", true)).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(detectCodeRequest("CREAR UNA PAGINA", true)).toBe(true);
    expect(detectCodeRequest("Necesito un COMPONENTE nuevo", true)).toBe(true);
  });
});

// ─── toMessages ────────────────────────────────────────────────

describe("toMessages", () => {
  it("should convert simple messages to Message format", () => {
    const result = toMessages([
      { role: "system", content: "Sistema" },
      { role: "user", content: "Hola" },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toBe("Sistema");
    expect(result[1].role).toBe("user");
    expect(result[1].content).toBe("Hola");
    expect(result[0].id).toBeTruthy();
    expect(result[0].timestamp).toBeGreaterThan(0);
  });
});

// ─── collectResponse ───────────────────────────────────────────

describe("collectResponse", () => {
  it("should accumulate text chunks and return full string", async () => {
    async function* gen(): AsyncGenerator<ChatChunk> {
      yield { type: "text", content: "Hola " };
      yield { type: "text", content: "mundo" };
      yield { type: "done", content: "" };
    }

    const result = await collectResponse(gen());
    expect(result).toBe("Hola mundo");
  });

  it("should throw on error chunk", async () => {
    async function* gen(): AsyncGenerator<ChatChunk> {
      yield { type: "text", content: "Hola" };
      yield { type: "error", content: "Algo salió mal" };
    }

    await expect(collectResponse(gen())).rejects.toThrow("Algo salió mal");
  });

  it("should return empty string for empty stream", async () => {
    async function* gen(): AsyncGenerator<ChatChunk> {
      yield { type: "done", content: "" };
    }

    const result = await collectResponse(gen());
    expect(result).toBe("");
  });

  it("should ignore non-text/done/error chunks", async () => {
    async function* gen(): AsyncGenerator<ChatChunk> {
      yield { type: "text", content: "Solo texto" } as ChatChunk;
      yield { type: "done", content: "" };
    }

    const result = await collectResponse(gen());
    expect(result).toBe("Solo texto");
  });
});

// ─── parseEntenderResponse ─────────────────────────────────────

describe("parseEntenderResponse", () => {
  it("should parse a complete entender response", () => {
    const response = `## Plan
Voy a crear una página de portafolio personal con 3 secciones: header con navegación, una sección de proyectos y un footer con contacto.

## Archivos
- index.html
- styles.css
- script.js

## Posibles problemas
- Las imágenes de los proyectos necesitan rutas reales
- El formulario de contacto necesita un backend para funcionar`;

    const output = parseEntenderResponse(response);

    expect(output.plan).toContain("página de portafolio");
    expect(output.files).toEqual(["index.html", "styles.css", "script.js"]);
    expect(output.issues).toHaveLength(2);
    expect(output.issues[0]).toContain("imágenes");
  });

  it("should handle response without issues section", () => {
    const response = `## Plan
Crear un componente botón.

## Archivos
- src/components/Button.tsx`;

    const output = parseEntenderResponse(response);
    expect(output.plan).toContain("componente botón");
    expect(output.files).toHaveLength(1);
    expect(output.issues).toEqual([]);
  });

  it("should handle response with checklist-style lists", () => {
    const response = `## Plan
Hacer una landing page.

## Archivos
- [ ] index.html
- [ ] styles.css

## Posibles problemas
- [ ] Sin diseño responsive`;

    const output = parseEntenderResponse(response);
    expect(output.files).toEqual(["index.html", "styles.css"]);
    expect(output.issues).toHaveLength(1);
  });

  it("should fallback to first line when no plan header", () => {
    const response = "Crear una app simple\ncon archivos básicos";
    const output = parseEntenderResponse(response);
    expect(output.plan).toBeTruthy();
  });
});

// ─── parseConstruirResponse ────────────────────────────────────

describe("parseConstruirResponse", () => {
  it("should parse file blocks with file:path format", () => {
    const response = `Acá está el código:

\`\`\`file:index.html
<!DOCTYPE html>
<html>
<head><title>Mi página</title></head>
<body><h1>Hola</h1></body>
</html>
\`\`\`

\`\`\`file:styles.css
body { background: #f0f0f0; }
\`\`\`

**Resumen**: Página simple creada.`;

    const output = parseConstruirResponse(response);
    expect(output.files).toHaveLength(2);
    expect(output.files[0].path).toBe("index.html");
    expect(output.files[0].content).toContain("DOCTYPE");
    expect(output.files[1].path).toBe("styles.css");
    expect(output.files[1].content).toContain("background");
    expect(output.summary).toContain("Página simple");
  });

  it("should handle single file block", () => {
    const response = `\`\`\`file:script.js
console.log("Hola mundo");
\`\`\``;

    const output = parseConstruirResponse(response);
    expect(output.files).toHaveLength(1);
    expect(output.files[0].path).toBe("script.js");
    expect(output.files[0].content).toBe('console.log("Hola mundo");');
  });

  it("should skip empty file blocks", () => {
    const response = `\`\`\`file:empty.js
\`\`\`

\`\`\`file:real.js
const x = 1;
\`\`\``;

    const output = parseConstruirResponse(response);
    expect(output.files).toHaveLength(1);
    expect(output.files[0].path).toBe("real.js");
  });

  it("should return empty files when no blocks found", () => {
    const response = "Solo texto sin bloques de código";
    const output = parseConstruirResponse(response);
    expect(output.files).toEqual([]);
    expect(output.fullResponse).toBe(response);
  });

  it("should handle file path with language prefix", () => {
    const response = `\`\`\`html file:index.html
<h1>Hola</h1>
\`\`\``;

    const output = parseConstruirResponse(response);
    expect(output.files).toHaveLength(1);
    expect(output.files[0].path).toBe("index.html");
  });

  it("should extract summary from ## Resumen header", () => {
    const response = `Código generado.

\`\`\`file:test.js
const a = 1;
\`\`\`

## Resumen
Se generó un archivo de prueba.`;

    const output = parseConstruirResponse(response);
    expect(output.summary).toContain("archivo de prueba");
  });
});

// ─── parseConstruirResponseFallback ────────────────────────────

describe("parseConstruirResponseFallback", () => {
  it("should parse comment-based file markers", () => {
    const response = `\`\`\`html
<!-- file:index.html -->
<h1>Hola</h1>
\`\`\``;

    const output = parseConstruirResponseFallback(response);
    expect(output.files).toHaveLength(1);
    expect(output.files[0].path).toBe("index.html");
  });

  it("should fall through to primary parser if it found files", () => {
    const response = `\`\`\`file:test.js
const x = 1;
\`\`\``;

    const output = parseConstruirResponseFallback(response);
    // Primary parser already handles this format
    expect(output.files).toHaveLength(1);
    expect(output.files[0].path).toBe("test.js");
  });
});

// ─── parseVerificarResponse ────────────────────────────────────

describe("parseVerificarResponse", () => {
  it("should return ok for 'ok'", () => {
    const output = parseVerificarResponse("ok");
    expect(output.status).toBe("ok");
  });

  it("should return ok for 'OK' (case insensitive)", () => {
    const output = parseVerificarResponse("OK");
    expect(output.status).toBe("ok");
  });

  it("should return reintentar with reason", () => {
    const output = parseVerificarResponse(
      "reintentar: falta un punto y coma en script.js línea 5",
    );
    expect(output.status).toBe("reintentar");
    expect(output.reason).toContain("punto y coma");
  });

  it("should return reintentar for 'reintentar:' with no reason", () => {
    const output = parseVerificarResponse("reintentar:");
    expect(output.status).toBe("reintentar");
    expect(output.reason).toBeTruthy();
  });

  it("should return reintentar for unexpected response", () => {
    const output = parseVerificarResponse("Esto no es una respuesta válida");
    expect(output.status).toBe("reintentar");
  });

  it("should handle response with punctuation", () => {
    expect(parseVerificarResponse("ok.").status).toBe("ok");
    expect(parseVerificarResponse("OK!").status).toBe("ok");
    expect(parseVerificarResponse("ok?").status).toBe("ok");
  });

  it("should handle 'reintentar:razón' without space", () => {
    const output = parseVerificarResponse("reintentar:falta cerrar el div");
    expect(output.status).toBe("reintentar");
    expect(output.reason).toContain("falta cerrar");
  });
});

// ─── Prompt Builders ───────────────────────────────────────────

describe("buildEntenderMessages", () => {
  it("should return system + user messages", () => {
    const msgs = buildEntenderMessages("Quiero una página");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Vibe Studio");
    expect(msgs[1].role).toBe("user");
    expect(msgs[1].content).toBe("Quiero una página");
  });
});

describe("buildConstruirMessages", () => {
  it("should include both plan and original message", () => {
    const msgs = buildConstruirMessages("Crear index.html", "Quiero una página");
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("file:");
    expect(msgs[1].content).toContain("Crear index.html");
    expect(msgs[1].content).toContain("Quiero una página");
  });
});

describe("buildVerificarMessages", () => {
  it("should include both original request and generated code", () => {
    const msgs = buildVerificarMessages(
      "Quiero una página",
      "<html><body>Hola</body></html>",
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].content).toContain("Quiero una página");
    expect(msgs[1].content).toContain("Hola");
  });
});

// ─── MAX_VERIFY_RETRIES ────────────────────────────────────────

describe("MAX_VERIFY_RETRIES", () => {
  it("should be 1 (max one retry)", () => {
    expect(MAX_VERIFY_RETRIES).toBe(1);
  });
});

// ─── Integration: Pipeline Engine ──────────────────────────────
//
// Estas pruebas verifican el pipeline completo usando un proveedor
// mock que devuelve respuestas predecibles.

import { registerProvider, resetRegistry } from "../../src/providers/registry";
import type { AIProvider, ChatOptions } from "../../src/lib/types";

/**
 * Crea un proveedor mock que devuelve respuestas específicas por fase.
 * Detecta qué fase está activa por el contenido del system prompt.
 */
function createMockPipelineProvider(
  entenderResponse: string,
  construirResponse: string,
  verificarResponse: string,
): AIProvider {
  return {
    id: "pipeline-test",
    name: "Pipeline Test",
    tier: "free",
    chat: async function* (
      messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      const fullPrompt = messages.map((m) => m.content).join(" ");

      // Elegir respuesta según la fase
      let response = "";
      if (fullPrompt.includes("analizar") || fullPrompt.includes("ANALIZAR")) {
        response = entenderResponse;
      } else if (fullPrompt.includes("Revisá") || fullPrompt.includes("revisaría")) {
        response = verificarResponse;
      } else {
        response = construirResponse;
      }

      // Entregar carácter por carácter (simula streaming)
      for (const char of response) {
        yield { type: "text", content: char };
      }
      yield { type: "done", content: "" };
    },
    countTokens: () => 10,
  };
}

describe("Pipeline Integration (with mock provider)", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("should successfully complete entender → construir → verificar", async () => {
    const mockProvider = createMockPipelineProvider(
      [
        "## Plan",
        "Crear una página simple",
        "## Archivos",
        "- index.html",
        "## Posibles problemas",
        "- Ninguno",
      ].join("\n"),
      [
        "```file:index.html",
        "<h1>Hola</h1>",
        "```",
        "",
        "**Resumen**: Página creada.",
      ].join("\n"),
      "ok",
    );

    registerProvider(mockProvider);

    const context = [makeMsg("Hola previo")];
    const events: unknown[] = [];

    // Necesitamos importar runPipeline dinámicamente para usar el provider registrado
    const { runPipeline } = await import("../../src/pipeline/engine");

    for await (const event of runPipeline(
      "Quiero crear una página",
      context,
      "pipeline-test",
    )) {
      events.push(event);
    }

    // Debería tener eventos: phase_change(entender), phase_change(construir),
    // file_created, phase_change(verificar), result
    expect(events.length).toBeGreaterThanOrEqual(4);

    const phaseChanges = events.filter((e) => e.type === "phase_change");
    expect(phaseChanges.length).toBeGreaterThanOrEqual(3);
    expect(phaseChanges[0].phase).toBe("entender");
    expect(phaseChanges[1].phase).toBe("construir");

    const resultEvent = events.find((e) => e.type === "result");
    expect(resultEvent).toBeDefined();
    expect(resultEvent.content).toContain("index.html");
    expect(resultEvent.files).toHaveLength(1);
    expect(resultEvent.files[0].path).toBe("index.html");
  });

  it("should retry construir when verificar returns reintentar", async () => {
    const mockProvider = createMockPipelineProvider(
      ["## Plan", "Crear un script", "## Archivos", "- app.js"].join("\n"),
      ["```file:app.js", 'console.log("Hola")', "```"].join("\n"),
      "reintentar: falta punto y coma",
    );

    registerProvider(mockProvider);

    const context = [makeMsg("Hola")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Quiero crear un script",
      context,
      "pipeline-test",
    )) {
      events.push(event);
    }

    // Debería reintentar (retry + segunda vuelta de construir/verificar)
    const retryEvents = events.filter((e) => e.type === "retry");
    expect(retryEvents.length).toBe(1);
    expect(retryEvents[0].reason).toContain("punto y coma");
  });

  it("should surface error when verificar fails after max retries", async () => {
    // Mock que SIEMPRE devuelve reintentar
    const mockProvider = createMockPipelineProvider(
      ["## Plan", "Crear algo", "## Archivos", "- test.js"].join("\n"),
      ["```file:test.js", "var x = 1", "```"].join("\n"),
      "reintentar: error de sintaxis",
    );

    registerProvider(mockProvider);

    const context = [makeMsg("Hola")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Quiero crear algo",
      context,
      "pipeline-test",
    )) {
      events.push(event);
    }

    // Debería tener error después de agotar reintentos
    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].message).toContain("No se pudo corregir");
  });

  it("should handle entender failure gracefully", async () => {
    const mockProvider: AIProvider = {
      id: "failing-provider",
      name: "Failing",
      tier: "free",
      chat: async function* (
        _messages: Message[],
        _options?: ChatOptions,
      ): AsyncGenerator<ChatChunk> {
        yield { type: "error", content: "Falló la conexión" };
      },
      countTokens: () => 10,
    };

    registerProvider(mockProvider);

    const context = [makeMsg("Hola")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Quiero crear algo",
      context,
      "failing-provider",
    )) {
      events.push(event);
    }

    // Si entender falla, debería al menos continuar con un resultado o error
    expect(events.length).toBeGreaterThan(0);
  });
});
