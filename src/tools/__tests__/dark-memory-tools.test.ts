/**
 * Dark-memory executor tools — unit tests.
 *
 * Verifica que el executor resuelve las tools canónicas
 * dark_memory_agent_memory_save / dark_memory_agent_memory_recall
 * (que prompts.ts ordena al modelo) con fallback elegante al
 * memory-sdk local cuando el bridge no está disponible.
 */

import { describe, it, expect, afterEach } from "vitest";
import { executeTool } from "../executor";
import type { ToolCall } from "../definitions";
import { clearProjectMemories } from "@/lib/memory";

// Sin bridge (default en tests): el fallback memory-sdk debe responder.
describe("dark_memory tools en executor (fallback)", () => {
  afterEach(async () => {
    // Cleanup: limpiar memorias guardadas por tests
    await clearProjectMemories("unknown");
  });

  it("dark_memory_agent_memory_save guarda con fallback local (sin bridge)", async () => {
    const call: ToolCall = {
      name: "dark_memory_agent_memory_save",
      args: { title: "Test Auth", content: "Usar OCAIS.", kind: "decision" },
    };

    const result = await executeTool(call);

    expect(result.success).toBe(true);
    expect(result.name).toBe("dark_memory_agent_memory_save");
    expect(result.result).toContain("Memoria guardada");
  });

  it("dark_memory_agent_memory_save valida kind inválido", async () => {
    const call: ToolCall = {
      name: "dark_memory_agent_memory_save",
      args: { title: "X", content: "Y", kind: "basura" },
    };

    const result = await executeTool(call);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Kind inválido");
  });

  it("dark_memory_agent_memory_save requiere title y content", async () => {
    const noTitle: ToolCall = {
      name: "dark_memory_agent_memory_save",
      args: { content: "Y" },
    };
    const noContent: ToolCall = {
      name: "dark_memory_agent_memory_save",
      args: { title: "X" },
    };

    expect((await executeTool(noTitle)).success).toBe(false);
    expect((await executeTool(noContent)).success).toBe(false);
  });

  it("dark_memory_agent_memory_recall busca con fallback local", async () => {
    // Guardar primero para tener algo que buscar
    await executeTool({
      name: "dark_memory_agent_memory_save",
      args: { title: "Auth OCAIS", content: "OCAIS única fuente de verdad.", kind: "decision" },
    });

    const call: ToolCall = {
      name: "dark_memory_agent_memory_recall",
      args: { query: "OCAIS" },
    };

    const result = await executeTool(call);

    expect(result.success).toBe(true);
    expect(result.name).toBe("dark_memory_agent_memory_recall");
    expect(result.result).toContain("OCAIS");
  });

  it("dark_memory_agent_memory_recall sin query falla", async () => {
    const call: ToolCall = {
      name: "dark_memory_agent_memory_recall",
      args: {},
    };

    const result = await executeTool(call);
    expect(result.success).toBe(false);
    expect(result.error).toContain("query");
  });

  it("tools legacy memory_save/memory_search siguen funcionando (backward compat)", async () => {
    const saveResult = await executeTool({
      name: "memory_save",
      args: { title: "Legacy", content: "Compat", type: "discovery" },
    });
    expect(saveResult.success).toBe(true);

    const searchResult = await executeTool({
      name: "memory_search",
      args: { query: "Legacy" },
    });
    expect(searchResult.success).toBe(true);
    expect(searchResult.result).toContain("Legacy");
  });
});
