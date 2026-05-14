// ═════════════════════════════════════════════════════════════════
// Task 11.1 — E2E vibe-coding loop
// ═════════════════════════════════════════════════════════════════
//
// Verifies the full end-to-end cycle:
//   user request → pipeline (entender→construir→verificar) → files written via IPC → preview renders
//
// Uses a mock provider AND a mock IPC layer to capture file writes.
// ═════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Message, ChatChunk, ChatOptions } from "../../src/lib/types";
import type { FileOutput, PipelineEvent } from "../../src/pipeline/types";
import type { Mock } from "vitest";

// ─── Track file writes via mocked IPC ────────────────────────────

const writtenFiles: Array<{ path: string; content: string }> = [];

vi.mock("../../src/lib/ipc", () => ({
  writeFile: vi.fn(async (path: string, content: string) => {
    writtenFiles.push({ path, content });
  }),
  readFile: vi.fn(async () => ""),
  listDir: vi.fn(async () => []),
  createDir: vi.fn(async () => {}),
  deleteEntry: vi.fn(async () => {}),
  execShell: vi.fn(async () => ({ stdout: "", stderr: "", exit_code: 0 })),
  openFolderDialog: vi.fn(async () => null),
  validateProject: vi.fn(async () => ({
    is_valid: true,
    name: "test",
    file_count: 0,
    has_config: false,
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────

function makeMsg(
  content: string,
  role: "user" | "assistant" | "system" = "user",
): Message {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

/**
 * Creates a mock provider that responds differently to each pipeline phase.
 *
 * Detection logic mirrors the system prompt content:
 * - "analizar" / "ANALIZAR" → entender phase
 * - "Revisa" / "revisaría" → verificar phase
 * - Otherwise → construir phase
 */
function createMockPipelineProvider(
  entenderResponse: string,
  construirResponse: string,
  verificarResponse: string,
) {
  // We need to import the actual types — using inline type
  return {
    id: "e2e-mock",
    name: "E2E Mock",
    tier: "free" as const,
    chat: async function* (
      messages: Message[],
      _options?: ChatOptions,
    ): AsyncGenerator<ChatChunk> {
      const fullPrompt = messages.map((m) => m.content).join(" ");

      let response = "";
      if (fullPrompt.includes("analizar") || fullPrompt.includes("ANALIZAR")) {
        response = entenderResponse;
      } else if (fullPrompt.includes("Revisa") || fullPrompt.includes("revisaría")) {
        response = verificarResponse;
      } else {
        response = construirResponse;
      }

      for (const char of response) {
        yield { type: "text" as const, content: char };
      }
      yield { type: "done" as const, content: "" };
    },
    countTokens: () => 10,
    validateKey: async () => true,
  };
}

// ═════════════════════════════════════════════════════════════════
// Escenario 1: Full vibe-coding loop — entender→construir→verificar→file write
// ═════════════════════════════════════════════════════════════════
//
// GIVEN a user sends a code creation request
// WHEN the pipeline runs
// THEN files are emitted in events AND written via IPC
//
describe("11.1 E2E: Full vibe-coding loop", () => {
  beforeEach(async () => {
    // Clear file tracking
    writtenFiles.length = 0;

    const { resetRegistry } = await import("../../src/providers/registry");
    resetRegistry();
  });

  it("should run entender→construir→verificar and emit result with files", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const provider = createMockPipelineProvider(
      [
        "## Plan",
        "Crear una landing page con header y footer",
        "## Archivos",
        "- index.html",
        "- styles.css",
        "## Posibles problemas",
        "- Ninguno",
      ].join("\n"),
      [
        "```file:index.html",
        "<!DOCTYPE html><html><head><title>Landing</title></head>",
        "<body><h1>Bienvenido</h1></body></html>",
        "```",
        "",
        "```file:styles.css",
        "body { font-family: sans-serif; margin: 0; }",
        "```",
        "",
        "**Resumen**: Landing page creada con HTML y CSS.",
      ].join("\n"),
      "ok",
    );

    registerProvider(provider);

    const context = [makeMsg("Hola, necesito una landing page")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Crear una landing page moderna",
      context,
      "e2e-mock",
    )) {
      events.push(event);
    }

    // Core assertion: pipeline emits result with files
    const resultEvent = events.find(
      (e) => (e as PipelineEvent).type === "result",
    ) as PipelineEvent & { type: "result"; content: string; files: FileOutput[] };
    expect(resultEvent).toBeDefined();
    expect(resultEvent.files).toBeDefined();
    expect(resultEvent.files.length).toBeGreaterThanOrEqual(2);

    const filePaths = resultEvent.files.map((f: FileOutput) => f.path);
    expect(filePaths).toContain("index.html");
    expect(filePaths).toContain("styles.css");

    // Phase changes must include all 3 phases
    const phaseChanges = events.filter(
      (e) => (e as PipelineEvent).type === "phase_change",
    );
    const phases = phaseChanges.map(
      (e) => (e as PipelineEvent & { phase: string }).phase,
    );
    expect(phases).toContain("entender");
    expect(phases).toContain("construir");
    expect(phases).toContain("verificar");
  });

  it("should write files via IPC when pipeline produces file events", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const provider = createMockPipelineProvider(
      ["## Plan", "Crear un script simple", "## Archivos", "- app.js"].join("\n"),
      ["```file:app.js", 'console.log("Hola mundo");', "```"].join("\n"),
      "ok",
    );

    registerProvider(provider);

    const context = [makeMsg("Creame un script")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Crear un archivo JavaScript simple",
      context,
      "e2e-mock",
    )) {
      events.push(event);
    }

    // Pipeline should have tried to write files via IPC
    const { writeFile } = await import("../../src/lib/ipc");
    expect(writeFile).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      "app.js",
      expect.stringContaining("Hola mundo"),
    );

    // Verify the writtenFiles tracking
    expect(writtenFiles.length).toBeGreaterThanOrEqual(1);
    const appJs = writtenFiles.find((f) => f.path === "app.js");
    expect(appJs).toBeDefined();
    expect(appJs!.content).toContain("Hola mundo");
  });

  it("should emit file_created events for each written file", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const provider = createMockPipelineProvider(
      [
        "## Plan",
        "Crear varios archivos",
        "## Archivos",
        "- a.html",
        "- b.css",
        "- c.js",
      ].join("\n"),
      [
        "```file:a.html",
        "<h1>A</h1>",
        "```",
        "",
        "```file:b.css",
        "body { color: blue; }",
        "```",
        "",
        "```file:c.js",
        'alert("C")',
        "```",
        "",
        "**Resumen**: Tres archivos creados.",
      ].join("\n"),
      "ok",
    );

    registerProvider(provider);

    const context = [makeMsg("Crea tres archivos")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Crear tres archivos de prueba",
      context,
      "e2e-mock",
    )) {
      events.push(event);
    }

    const fileCreatedEvents = events.filter(
      (e) => (e as PipelineEvent).type === "file_created",
    );
    const createdPaths = fileCreatedEvents.map(
      (e) => (e as PipelineEvent & { path: string }).path,
    );
    expect(createdPaths).toContain("a.html");
    expect(createdPaths).toContain("b.css");
    expect(createdPaths).toContain("c.js");
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 2: buildPreviewContent consuming pipeline output
// ═════════════════════════════════════════════════════════════════
//
// GIVEN the pipeline produces file content
// WHEN buildPreviewContent processes each file
// THEN the preview HTML renders the content correctly
//
describe("11.1 E2E: buildPreviewContent with pipeline output", () => {
  it("should render HTML file content from pipeline output", async () => {
    const { buildPreviewContent } =
      await import("../../src/components/preview/LivePreview");

    const fileContent = "<!DOCTYPE html><html><body><h1>Hola</h1></body></html>";
    const result = buildPreviewContent(fileContent, "index.html");

    expect(result.html).toContain("Hola");
    expect(result.isFullDocument).toBe(true);
  });

  it("should render CSS file content from pipeline output", async () => {
    const { buildPreviewContent } =
      await import("../../src/components/preview/LivePreview");

    const fileContent = "body { background: red; }";
    const result = buildPreviewContent(fileContent, "styles.css");

    expect(result.html).toContain("background: red");
    expect(result.html).toContain("<style>");
    expect(result.isFullDocument).toBe(false);
  });

  it("should render JS file content from pipeline output", async () => {
    const { buildPreviewContent } =
      await import("../../src/components/preview/LivePreview");

    const fileContent = 'console.log("test");';
    const result = buildPreviewContent(fileContent, "app.js");

    expect(result.html).toContain("test");
    expect(result.html).toContain("<script>");
    expect(result.isFullDocument).toBe(false);
  });

  it("should show placeholder for empty content", async () => {
    const { buildPreviewContent } =
      await import("../../src/components/preview/LivePreview");

    const result = buildPreviewContent("", null);
    expect(result.html).toContain("Atajos de teclado");
  });
});

// ═════════════════════════════════════════════════════════════════
// Escenario 3: Pipeline retry loop with IPC verification
// ═════════════════════════════════════════════════════════════════
//
// GIVEN the verifier requests changes
// WHEN the pipeline retries construir
// THEN IPC writeFile is called on each retry
//
describe("11.1 E2E: Pipeline retry writes files each attempt", () => {
  beforeEach(async () => {
    writtenFiles.length = 0;
    vi.clearAllMocks();

    const { resetRegistry } = await import("../../src/providers/registry");
    resetRegistry();
  });

  it("should call writeFile on retry when verificar returns reintentar", async () => {
    const { registerProvider } = await import("../../src/providers/registry");
    const provider = createMockPipelineProvider(
      ["## Plan", "Crear un script", "## Archivos", "- retry.js"].join("\n"),
      ["```file:retry.js", 'console.log("v1")', "```"].join("\n"),
      "reintentar: falta un punto y coma",
    );

    registerProvider(provider);

    const context = [makeMsg("Hola")];
    const { runPipeline } = await import("../../src/pipeline/engine");

    const events: unknown[] = [];
    for await (const event of runPipeline(
      "Crear un script con retry",
      context,
      "e2e-mock",
    )) {
      events.push(event);
    }

    // writeFile called on initial construir + MAX_VERIFY_RETRIES retries = 4
    const { writeFile } = await import("../../src/lib/ipc");
    const callCount = (writeFile as unknown as Mock).mock?.calls?.length ?? 0;
    expect(callCount).toBe(4);
  });
});
