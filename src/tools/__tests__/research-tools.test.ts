/**
 * docs executor tools — integration tests.
 *
 * Mockea research-bridge para verificar que el executor:
 * - Resuelve docs_search / docs_fetch / code_search / cve_check / synthesis
 * - Valida parámetros obligatorios
 * - Degrada elegante cuando el bridge lanza error
 * - synthesis registra la decisión sin red
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeTool } from "../executor";
import type { ToolCall } from "../definitions";

// Mock del research-bridge (no queremos red en los tests)
const bridgeMock = vi.hoisted(() => ({
  searchDocs: vi.fn(),
  fetchDoc: vi.fn(),
  searchCode: vi.fn(),
  checkCve: vi.fn(),
}));

vi.mock("../research-bridge", async (importOriginal) => {
  const original = await importOriginal<typeof import("../research-bridge")>();
  return { ...original, ...bridgeMock };
});

describe("docs tools en executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("docs_search ejecuta y formatea resultados", async () => {
    bridgeMock.searchDocs.mockResolvedValue([
      { title: "React 19", url: "https://react.dev/blog/react-19", snippet: "Novedades", source: "duckduckgo" },
    ]);

    const result = await executeTool({
      name: "docs_search",
      args: { query: "React 19" },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(bridgeMock.searchDocs).toHaveBeenCalledWith("React 19", undefined);
    expect(String(result.result)).toContain("React 19");
  });

  it("docs_search requiere query", async () => {
    const result = await executeTool({ name: "docs_search", args: {} } as ToolCall);
    expect(result.success).toBe(false);
    expect(result.error).toContain("query");
  });

  it("docs_search degrada con error descriptivo si el bridge falla", async () => {
    bridgeMock.searchDocs.mockRejectedValue(new Error("backend no desplegado"));

    const result = await executeTool({
      name: "docs_search",
      args: { query: "algo" },
    } as ToolCall);

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain("backend no desplegado");
  });

  it("docs_search con 0 resultados informa y sugiere reformular", async () => {
    bridgeMock.searchDocs.mockResolvedValue([]);

    const result = await executeTool({
      name: "docs_search",
      args: { query: "zzz-inexistente" },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(String(result.result)).toContain("No se encontraron");
  });

  it("docs_fetch descarga y devuelve contenido", async () => {
    bridgeMock.fetchDoc.mockResolvedValue({
      title: "React Blog",
      content: "Contenido de la página",
      byteCount: 5000,
      url: "https://react.dev/blog/react-19",
      warnings: [],
    });

    const result = await executeTool({
      name: "docs_fetch",
      args: { url: "https://react.dev/blog/react-19" },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(String(result.result)).toContain("Contenido de la página");
  });

  it("docs_fetch requiere url", async () => {
    const result = await executeTool({ name: "docs_fetch", args: {} } as ToolCall);
    expect(result.success).toBe(false);
    expect(result.error).toContain("url");
  });

  it("code_search ejecuta con limit", async () => {
    bridgeMock.searchCode.mockResolvedValue([
      { name: "express", url: "https://npmjs.com/express", description: "Framework", source: "npm" },
    ]);

    const result = await executeTool({
      name: "code_search",
      args: { query: "express", limit: 3 },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(bridgeMock.searchCode).toHaveBeenCalledWith("express", 3);
  });

  it("cve_check reporta vulnerabilidades con severidad", async () => {
    bridgeMock.checkCve.mockResolvedValue([
      {
        id: "GHSA-x",
        summary: "Auth bypass",
        severity: "CRITICAL",
        published: "2026-01-01",
        url: "https://osv.dev/vulnerability/GHSA-x",
        aliases: [],
        fixedVersions: ["9.0.3"],
      },
    ]);

    const result = await executeTool({
      name: "cve_check",
      args: { package: "jsonwebtoken" },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(String(result.result)).toContain("CRITICAL");
    expect(String(result.result)).toContain("9.0.3");
  });

  it("cve_check sin vulnerabilidades da señal positiva", async () => {
    bridgeMock.checkCve.mockResolvedValue([]);

    const result = await executeTool({
      name: "cve_check",
      args: { package: "lodash" },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(String(result.result)).toContain("No se encontraron vulnerabilidades");
  });

  it("cve_check requiere package", async () => {
    const result = await executeTool({ name: "cve_check", args: {} } as ToolCall);
    expect(result.success).toBe(false);
    expect(result.error).toContain("package");
  });

  it("synthesis registra decisión sin red (puramente local)", async () => {
    const result = await executeTool({
      name: "synthesis",
      args: {
        topic: "autenticación JWT en Express",
        decision: "usar jsonwebtoken v9.0.3 — corrige CVE-2022-23529",
      },
    } as ToolCall);

    expect(result.success).toBe(true);
    expect(String(result.result)).toContain("usar jsonwebtoken v9.0.3");
    expect(bridgeMock.searchDocs).not.toHaveBeenCalled();
  });

  it("synthesis requiere topic y decision", async () => {
    const noTopic = await executeTool({ name: "synthesis", args: { decision: "x" } } as ToolCall);
    const noDecision = await executeTool({ name: "synthesis", args: { topic: "y" } } as ToolCall);

    expect(noTopic.success).toBe(false);
    expect(noDecision.success).toBe(false);
  });

  it("las 5 tools docs están registradas en TOOL_MAP (no 'Herramienta desconocida')", async () => {
    for (const name of ["docs_search", "docs_fetch", "code_search", "cve_check", "synthesis"]) {
      // Sin args válidos → error de validación, NO "Herramienta desconocida"
      const result = await executeTool({ name, args: {} } as ToolCall);
      expect(result.success).toBe(false);
      expect(String(result.error)).not.toContain("Herramienta desconocida");
    }
  });
});
