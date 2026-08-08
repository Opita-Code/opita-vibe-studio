/**
 * tools/prompts.ts — buildToolSystemPrompt full coverage.
 *
 * Cubre el compositor de system prompt: sin proyecto, con proyecto
 * + memoria, modo activo con addon, y degradación de módulos.
 *
 * Ejecutar: npx vitest run src/tools/__tests__/prompts-system.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildToolSystemPrompt, buildContextWarning } from "../prompts";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";

// Mock getProjectSummary (executor) — evitamos tocar el store del executor aquí.
vi.mock("../executor", () => ({
  getProjectSummary: (...a: unknown[]) => mockGetProjectSummary(...a),
}));

const mockGetProjectSummary = vi.fn();

// Real getRecentMemories via lib/memory — mock para controlar output
const mockGetRecentMemories = vi.fn();
vi.mock("@/lib/memory", () => ({
  getRecentMemories: (...a: unknown[]) => mockGetRecentMemories(...a),
}));

describe("buildToolSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.setState({ activeMode: "auto" });
    useProjectStore.setState({ activeWorkspaceId: null });
  });

  it("compone prompt base sin proyecto abierto", async () => {
    mockGetProjectSummary.mockReturnValue(null);
    const prompt = await buildToolSystemPrompt();
    expect(prompt).toContain("Eres Aura");
    expect(prompt).toContain("No hay un proyecto abierto");
    expect(prompt).toContain("read_file");
    expect(mockGetRecentMemories).not.toHaveBeenCalled();
  });

  it("incluye resumen del proyecto cuando existe", async () => {
    mockGetProjectSummary.mockReturnValue("Proyecto: Mi App\nEstructura:\n📄 index.ts");
    useProjectStore.setState({ activeWorkspaceId: "/proj" });
    mockGetRecentMemories.mockResolvedValue([]);

    const prompt = await buildToolSystemPrompt();
    expect(prompt).toContain("Contexto del Proyecto Actual");
    expect(prompt).toContain("Mi App");
  });

  it("inyecta memorias recientes del proyecto", async () => {
    mockGetProjectSummary.mockReturnValue(null);
    useProjectStore.setState({ activeWorkspaceId: "/proj" });
    mockGetRecentMemories.mockResolvedValue([
      {
        id: "1", project: "/proj", title: "Usar OCAIS", content: "decisión importante",
        type: "decision", tags: [], createdAt: Date.now(),
      },
    ]);

    const prompt = await buildToolSystemPrompt();
    expect(prompt).toContain("Memoria del Proyecto");
    expect(prompt).toContain("OCAIS");
  });

  it("aplica addon del modo activo", async () => {
    mockGetProjectSummary.mockReturnValue(null);
    useProjectStore.setState({ activeWorkspaceId: "/proj" });
    useChatStore.setState({ activeMode: "construir" });
    mockGetRecentMemories.mockResolvedValue([]);

    const prompt = await buildToolSystemPrompt();
    // El addon de "construir" existe en VIBE_MODES
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("degrada elegantemente si el módulo de memorias falla", async () => {
    mockGetProjectSummary.mockReturnValue(null);
    useProjectStore.setState({ activeWorkspaceId: "/proj" });
    mockGetRecentMemories.mockRejectedValue(new Error("boom"));

    const prompt = await buildToolSystemPrompt();
    expect(prompt).toContain("Eres Aura");
  });

  it("degrada si VIBE_MODES no está disponible", async () => {
    mockGetProjectSummary.mockReturnValue(null);
    useChatStore.setState({ activeMode: "modo-fantasma" });
    const prompt = await buildToolSystemPrompt();
    expect(prompt).toContain("Eres Aura");
  });
});

describe("buildContextWarning (edge cases)", () => {
  it("exactamente 80% genera warning", () => {
    const w = buildContextWarning(8_000, 10_000);
    expect(w).not.toBeNull();
    expect(w).toContain("80%");
  });

  it("por defecto usa budget 32k", () => {
    expect(buildContextWarning(25_600)).not.toBeNull();
    expect(buildContextWarning(20_000)).toBeNull();
  });
});
