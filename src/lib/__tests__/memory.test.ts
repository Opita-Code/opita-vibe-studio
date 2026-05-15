/**
 * Tests for Engram memory store.
 * Ejecutar: npx vitest run src/lib/__tests__/memory.test.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock idb-keyval before importing memory module
const mockStore = new Map<string, string>();
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => mockStore.get(key) || null),
  set: vi.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  del: vi.fn(async (key: string) => { mockStore.delete(key); }),
}));

import {
  saveMemory,
  searchMemories,
  getRecentMemories,
  deleteMemory,
  clearProjectMemories,
  getMemoryCount,
  _extractKeywords,
  _scoreMatch,
  _normalize,
} from "../memory";
import type { MemoryEntry } from "../memory";

describe("Engram Memory Store", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  // ─── extractKeywords ───────────────────────────────────────

  describe("extractKeywords", () => {
    it("extrae palabras de 3+ caracteres y filtra stop words", () => {
      const kw = _extractKeywords("Use Zustand for state");
      expect(kw).toContain("use");
      expect(kw).toContain("zustand");
      expect(kw).toContain("state");
      expect(kw).not.toContain("for"); // English stop word
    });

    it("filtra stop words en español", () => {
      const kw = _extractKeywords("Usar Zustand para el estado global del proyecto");
      expect(kw).toContain("usar");
      expect(kw).toContain("zustand");
      expect(kw).toContain("estado");
      expect(kw).toContain("global");
      expect(kw).toContain("proyecto");
      expect(kw).not.toContain("para"); // stop word
      expect(kw).not.toContain("del");  // stop word
    });

    it("normaliza acentos", () => {
      const kw = _extractKeywords("función autenticación señal");
      expect(kw).toContain("funcion");
      expect(kw).toContain("autenticacion");
      expect(kw).toContain("senal");
    });

    it("deduplica palabras", () => {
      const kw = _extractKeywords("test test test");
      expect(kw).toEqual(["test"]);
    });

    it("maneja texto vacío", () => {
      expect(_extractKeywords("")).toEqual([]);
    });

    it("split por puntuación y mantiene términos técnicos", () => {
      const kw = _extractKeywords("src/components/Button.tsx");
      expect(kw).toContain("src");
      expect(kw).toContain("components");
      expect(kw).toContain("button");
      expect(kw).toContain("tsx");
    });
  });

  // ─── normalize ─────────────────────────────────────────────

  describe("normalize", () => {
    it("quita acentos y diacríticos", () => {
      expect(_normalize("función")).toBe("funcion");
      expect(_normalize("señal")).toBe("senal");
      expect(_normalize("autenticación")).toBe("autenticacion");
    });

    it("convierte a minúsculas", () => {
      expect(_normalize("HOLA MUNDO")).toBe("hola mundo");
    });
  });

  // ─── scoreMatch ────────────────────────────────────────────

  describe("scoreMatch", () => {
    const entry: MemoryEntry = {
      id: "test-1",
      project: "/test",
      title: "Use Zustand for global state",
      content: "Decided to use Zustand instead of Redux",
      type: "decision",
      tags: ["zustand", "redux", "state"],
      createdAt: Date.now(),
    };

    it("retorna 0 si no hay match", () => {
      expect(_scoreMatch(entry, ["angular", "ngrx"])).toBe(0);
    });

    it("retorna > 0 para matches parciales", () => {
      expect(_scoreMatch(entry, ["zustand", "angular"])).toBeGreaterThan(0);
    });

    it("retorna mayor score para más matches", () => {
      const partial = _scoreMatch(entry, ["zustand", "angular"]);
      const full = _scoreMatch(entry, ["zustand", "redux"]);
      expect(full).toBeGreaterThan(partial);
    });

    it("aplica bonus de recencia", () => {
      const recent = { ...entry, createdAt: Date.now() };
      const old = { ...entry, createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000 };
      const recentScore = _scoreMatch(recent, ["zustand"]);
      const oldScore = _scoreMatch(old, ["zustand"]);
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  // ─── saveMemory ────────────────────────────────────────────

  describe("saveMemory", () => {
    it("guarda una memoria con ID y timestamp generados", async () => {
      const entry = await saveMemory({
        project: "/test",
        title: "Test decision",
        content: "We chose X over Y",
        type: "decision",
      });

      expect(entry.id).toMatch(/^mem-/);
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.tags.length).toBeGreaterThan(0);
    });

    it("persiste en el store", async () => {
      await saveMemory({
        project: "/test",
        title: "Test",
        content: "Content",
        type: "pattern",
      });

      const count = await getMemoryCount("/test");
      expect(count).toBe(1);
    });

    it("respeta el límite FIFO de 100 por proyecto", async () => {
      // Save 105 memories
      for (let i = 0; i < 105; i++) {
        await saveMemory({
          project: "/test",
          title: `Memory ${i}`,
          content: `Content ${i}`,
          type: "discovery",
        });
      }

      const count = await getMemoryCount("/test");
      expect(count).toBeLessThanOrEqual(100);
    });

    it("FIFO no afecta otros proyectos", async () => {
      // Fill project A to limit
      for (let i = 0; i < 102; i++) {
        await saveMemory({
          project: "/projectA",
          title: `A-${i}`,
          content: `Content`,
          type: "decision",
        });
      }

      await saveMemory({
        project: "/projectB",
        title: "B memory",
        content: "B content",
        type: "decision",
      });

      expect(await getMemoryCount("/projectA")).toBeLessThanOrEqual(100);
      expect(await getMemoryCount("/projectB")).toBe(1);
    });
  });

  // ─── searchMemories ───────────────────────────────────────

  describe("searchMemories", () => {
    beforeEach(async () => {
      await saveMemory({
        project: "/test",
        title: "Use Zustand for state",
        content: "Chose Zustand over Redux for simplicity",
        type: "decision",
      });
      await saveMemory({
        project: "/test",
        title: "Component barrel exports",
        content: "All components use index.ts barrel exports",
        type: "convention",
      });
      await saveMemory({
        project: "/other",
        title: "Other project memory",
        content: "This is from another project",
        type: "discovery",
      });
    });

    it("busca por keywords y retorna matches", async () => {
      const results = await searchMemories("/test", "zustand state");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain("Zustand");
    });

    it("no retorna memorias de otros proyectos", async () => {
      const results = await searchMemories("/test", "other project");
      expect(results).toHaveLength(0);
    });

    it("retorna vacío si no hay matches", async () => {
      const results = await searchMemories("/test", "kubernetes helm");
      expect(results).toHaveLength(0);
    });

    it("retorna recientes si la query está vacía", async () => {
      const results = await searchMemories("/test", "");
      expect(results.length).toBeGreaterThan(0);
    });

    it("respeta el límite", async () => {
      const results = await searchMemories("/test", "component export zustand", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  // ─── getRecentMemories ────────────────────────────────────

  describe("getRecentMemories", () => {
    it("retorna memorias ordenadas por recencia", async () => {
      // Use vi.spyOn to control timestamps
      let mockTime = 1000000;
      const dateSpy = vi.spyOn(Date, "now").mockImplementation(() => mockTime);
      
      await saveMemory({ project: "/test", title: "First", content: "1", type: "decision" });
      mockTime += 1000;
      await saveMemory({ project: "/test", title: "Second", content: "2", type: "decision" });
      mockTime += 1000;
      await saveMemory({ project: "/test", title: "Third", content: "3", type: "decision" });

      const results = await getRecentMemories("/test", 2);
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Third");
      expect(results[1].title).toBe("Second");
      
      dateSpy.mockRestore();
    });
  });

  // ─── deleteMemory ─────────────────────────────────────────

  describe("deleteMemory", () => {
    it("elimina una memoria por ID", async () => {
      const entry = await saveMemory({
        project: "/test",
        title: "To delete",
        content: "Content",
        type: "bugfix",
      });

      const deleted = await deleteMemory(entry.id);
      expect(deleted).toBe(true);
      expect(await getMemoryCount("/test")).toBe(0);
    });

    it("retorna false si no existe", async () => {
      const deleted = await deleteMemory("nonexistent");
      expect(deleted).toBe(false);
    });
  });

  // ─── clearProjectMemories ─────────────────────────────────

  describe("clearProjectMemories", () => {
    it("limpia todas las memorias de un proyecto", async () => {
      await saveMemory({ project: "/test", title: "A", content: "1", type: "decision" });
      await saveMemory({ project: "/test", title: "B", content: "2", type: "pattern" });
      await saveMemory({ project: "/other", title: "C", content: "3", type: "decision" });

      const removed = await clearProjectMemories("/test");
      expect(removed).toBe(2);
      expect(await getMemoryCount("/test")).toBe(0);
      expect(await getMemoryCount("/other")).toBe(1);
    });
  });
});
