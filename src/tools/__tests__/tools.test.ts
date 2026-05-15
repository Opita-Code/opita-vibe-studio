/**
 * Test unitario para el sistema de herramientas y modos.
 * Ejecutar: npx vitest run src/tools/__tests__/tools.test.ts
 */
import { describe, it, expect, beforeEach } from "vitest";
import { TOOL_DEFINITIONS, formatToolsForPrompt } from "../definitions";
import {
  parseToolCalls,
  formatToolResult,
  detectFirstCompleteTool,
  hasPartialToolTag,
} from "../parser";
import {
  saveSnapshot,
  popLastSnapshot,
  getLastSnapshot,
  clearSnapshots,
} from "../fileSnapshot";

// ─── Tool Definitions ──────────────────────────────────────────

describe("Tool Definitions", () => {
  it("debe tener 10 herramientas definidas", () => {
    expect(TOOL_DEFINITIONS).toHaveLength(10);
  });

  it("cada herramienta tiene name, description, y parameters", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(Array.isArray(tool.parameters)).toBe(true);
    }
  });

  it("las herramientas esperadas están presentes", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toContain("read_file");
    expect(names).toContain("write_file");
    expect(names).toContain("apply_diff");
    expect(names).toContain("list_files");
    expect(names).toContain("search_code");
    expect(names).toContain("delete_file");
  });

  it("formatToolsForPrompt genera texto con todas las herramientas", () => {
    const prompt = formatToolsForPrompt();
    expect(prompt).toContain("read_file");
    expect(prompt).toContain("write_file");
    expect(prompt).toContain("apply_diff");
    expect(prompt).toContain("list_files");
    expect(prompt).toContain("search_code");
    expect(prompt).toContain("delete_file");
  });
});

// ─── Tool Parser ───────────────────────────────────────────────

describe("Tool Parser", () => {
  it("parsea un bloque de herramienta completo", () => {
    const raw = `Voy a leer el archivo.

<vibe-tool name="read_file">
{"path": "src/App.tsx"}
</vibe-tool>

Listo, lo leí.`;

    const result = parseToolCalls(raw);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("read_file");
    expect(result.toolCalls[0].args.path).toBe("src/App.tsx");
    expect(result.visibleText).not.toContain("<vibe-tool");
    expect(result.visibleText).toContain("Voy a leer el archivo");
    expect(result.visibleText).toContain("Listo, lo leí");
    expect(result.hasPendingTool).toBe(false);
  });

  it("parsea múltiples bloques de herramientas", () => {
    const raw = `Voy a leer dos archivos.

<vibe-tool name="read_file">
{"path": "src/App.tsx"}
</vibe-tool>

<vibe-tool name="read_file">
{"path": "package.json"}
</vibe-tool>`;

    const result = parseToolCalls(raw);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].args.path).toBe("src/App.tsx");
    expect(result.toolCalls[1].args.path).toBe("package.json");
  });

  it("detecta bloque incompleto (pendiente)", () => {
    const raw = `Leyendo el archivo...

<vibe-tool name="read_file">
{"path": "src/App`;

    const result = parseToolCalls(raw);
    expect(result.hasPendingTool).toBe(true);
    expect(result.toolCalls).toHaveLength(0);
  });

  it("texto sin herramientas retorna vacío", () => {
    const raw = "Hola, ¿en qué puedo ayudarte?";
    const result = parseToolCalls(raw);
    expect(result.toolCalls).toHaveLength(0);
    expect(result.visibleText).toBe(raw);
    expect(result.hasPendingTool).toBe(false);
  });

  it("formatToolResult genera XML correcto para éxito", () => {
    const xml = formatToolResult("read_file", true, "contenido del archivo");
    expect(xml).toContain('name="read_file"');
    expect(xml).toContain('status="ok"');
    expect(xml).toContain("contenido del archivo");
  });

  it("formatToolResult genera XML correcto para error", () => {
    const xml = formatToolResult("write_file", false, undefined, "Permiso denegado");
    expect(xml).toContain('name="write_file"');
    expect(xml).toContain('status="error"');
    expect(xml).toContain("Permiso denegado");
  });

  it("parsea argumentos flexibles (key=value sin JSON válido)", () => {
    const raw = `<vibe-tool name="read_file">
path: "src/index.ts"
</vibe-tool>`;

    const result = parseToolCalls(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].args.path).toBe("src/index.ts");
  });
});

// ─── Streaming Tool Detection ──────────────────────────────────

describe("Streaming Tool Detection", () => {
  it("detecta el primer tool call completo durante streaming", () => {
    const raw = `Voy a leer el archivo.

<vibe-tool name="read_file">
{"path": "src/App.tsx"}
</vibe-tool>

Más texto después.`;

    const detection = detectFirstCompleteTool(raw);

    expect(detection).not.toBeNull();
    expect(detection!.toolCall.name).toBe("read_file");
    expect(detection!.toolCall.args.path).toBe("src/App.tsx");
    expect(detection!.textBeforeTool).toContain("Voy a leer el archivo");
    expect(detection!.textBeforeTool).not.toContain("<vibe-tool");
  });

  it("retorna null si no hay tool call completo", () => {
    const raw = "Hola, solo texto normal sin herramientas.";
    expect(detectFirstCompleteTool(raw)).toBeNull();
  });

  it("retorna null para tool call incompleto", () => {
    const raw = `Voy a leer...

<vibe-tool name="read_file">
{"path": "src/App`;

    expect(detectFirstCompleteTool(raw)).toBeNull();
  });

  it("detecta solo el PRIMER tool call, no todos", () => {
    const raw = `<vibe-tool name="read_file">
{"path": "a.ts"}
</vibe-tool>

<vibe-tool name="write_file">
{"path": "b.ts", "content": "hello"}
</vibe-tool>`;

    const detection = detectFirstCompleteTool(raw);
    expect(detection).not.toBeNull();
    expect(detection!.toolCall.name).toBe("read_file");
    expect(detection!.toolCall.args.path).toBe("a.ts");
  });

  it("textBeforeTool está vacío si tool está al inicio", () => {
    const raw = `<vibe-tool name="list_files">
{"path": "."}
</vibe-tool>`;

    const detection = detectFirstCompleteTool(raw);
    expect(detection).not.toBeNull();
    expect(detection!.textBeforeTool).toBe("");
  });
});

// ─── hasPartialToolTag ─────────────────────────────────────────

describe("hasPartialToolTag", () => {
  it("detecta tag parcial (abierto sin cerrar)", () => {
    const raw = `Analizando el código...
<vibe-tool name="read_file">
{"path": "sr`;
    expect(hasPartialToolTag(raw)).toBe(true);
  });

  it("retorna false cuando no hay tool tags", () => {
    expect(hasPartialToolTag("Solo texto normal")).toBe(false);
  });

  it("retorna false cuando el tool tag está completo", () => {
    const raw = `<vibe-tool name="read_file">
{"path": "src/App.tsx"}
</vibe-tool>`;
    expect(hasPartialToolTag(raw)).toBe(false);
  });

  it("detecta parcial incluso con texto previo", () => {
    const raw = `Primero algo de texto.

<vibe-tool name="apply_diff">
{"path": "index.ts", "search": "old`;
    expect(hasPartialToolTag(raw)).toBe(true);
  });
});

// ─── File Snapshots ────────────────────────────────────────────

describe("File Snapshots", () => {
  beforeEach(() => {
    clearSnapshots();
  });

  it("guarda y recupera un snapshot por path", () => {
    saveSnapshot("src/App.tsx", "const App = () => {};", "write");
    const snap = getLastSnapshot("src/App.tsx");

    expect(snap).not.toBeNull();
    expect(snap!.path).toBe("src/App.tsx");
    expect(snap!.content).toBe("const App = () => {};");
    expect(snap!.operation).toBe("write");
    expect(snap!.timestamp).toBeGreaterThan(0);
  });

  it("getLastSnapshot retorna null si no existe", () => {
    expect(getLastSnapshot("noexiste.ts")).toBeNull();
  });

  it("popLastSnapshot retorna el más reciente", () => {
    saveSnapshot("a.ts", "aaa", "write");
    saveSnapshot("b.ts", "bbb", "diff");

    const snap = popLastSnapshot();
    expect(snap).not.toBeNull();
    expect(snap!.path).toBe("b.ts");
    expect(snap!.content).toBe("bbb");
  });

  it("popLastSnapshot retorna null si está vacío", () => {
    expect(popLastSnapshot()).toBeNull();
  });

  it("getLastSnapshot retorna el snapshot más reciente para el mismo path", () => {
    saveSnapshot("app.ts", "v1", "write");
    saveSnapshot("app.ts", "v2", "diff");

    const snap = getLastSnapshot("app.ts");
    expect(snap!.content).toBe("v2");
  });

  it("clearSnapshots limpia todo", () => {
    saveSnapshot("a.ts", "aaa", "write");
    saveSnapshot("b.ts", "bbb", "diff");
    clearSnapshots();

    expect(getLastSnapshot("a.ts")).toBeNull();
    expect(getLastSnapshot("b.ts")).toBeNull();
    expect(popLastSnapshot()).toBeNull();
  });

  it("respeta el límite de 20 snapshots (FIFO)", () => {
    for (let i = 0; i < 25; i++) {
      saveSnapshot(`file-${i}.ts`, `content-${i}`, "write");
    }

    // Los primeros 5 deberían haberse eliminado
    expect(getLastSnapshot("file-0.ts")).toBeNull();
    expect(getLastSnapshot("file-4.ts")).toBeNull();
    // Los últimos 20 deberían estar
    expect(getLastSnapshot("file-5.ts")).not.toBeNull();
    expect(getLastSnapshot("file-24.ts")).not.toBeNull();
  });
});

// ─── formatToolResult Truncation ───────────────────────────────

describe("formatToolResult Truncation", () => {
  it("no trunca resultados pequeños", () => {
    const result = formatToolResult("read_file", true, "contenido corto");
    expect(result).toContain("contenido corto");
    expect(result).not.toContain("omitidos");
  });

  it("trunca resultados mayores a 8K caracteres", () => {
    const bigContent = "x".repeat(10_000);
    const result = formatToolResult("read_file", true, bigContent);
    expect(result).toContain("omitidos");
    // Should contain head and tail
    expect(result.length).toBeLessThan(bigContent.length);
  });

  it("mantiene head y tail del contenido truncado", () => {
    const content = "HEAD_" + "x".repeat(10_000) + "_TAIL";
    const result = formatToolResult("read_file", true, content);
    expect(result).toContain("HEAD_");
    expect(result).toContain("_TAIL");
  });
});

// ─── buildContextWarning ───────────────────────────────────────

import { buildContextWarning } from "../prompts";

describe("buildContextWarning", () => {
  it("retorna null cuando el uso es menor al 80%", () => {
    expect(buildContextWarning(20_000)).toBeNull(); // 62.5% of 32K
  });

  it("retorna warning cuando el uso supera el 80%", () => {
    const warning = buildContextWarning(26_000); // 81.25%
    expect(warning).not.toBeNull();
    expect(warning).toContain("81%");
    expect(warning).toContain("Nueva conversación");
  });

  it("usa budget personalizado si se provee", () => {
    // 50% of 10K = below threshold
    expect(buildContextWarning(5_000, 10_000)).toBeNull();
    // 90% of 10K = above threshold
    const warning = buildContextWarning(9_000, 10_000);
    expect(warning).not.toBeNull();
    expect(warning).toContain("90%");
  });
});
