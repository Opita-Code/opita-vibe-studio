import { describe, it, expect } from "vitest";
import { getToolLabel, PHASE_LABELS, AURA_SYSTEM_PROMPT } from "../prompts";

describe("prompts", () => {
  describe("AURA_SYSTEM_PROMPT", () => {
    it("should not contain technical jargon", () => {
      const jargon = ["TDD", "SDD", "spec", "pipeline", "orquestar", "refactorizar"];
      for (const term of jargon) {
        expect(AURA_SYSTEM_PROMPT).not.toContain(term);
      }
    });

    it("should mention Aura by name", () => {
      expect(AURA_SYSTEM_PROMPT).toContain("Aura");
    });

    it("should mention Vibe Studio", () => {
      expect(AURA_SYSTEM_PROMPT).toContain("Vibe Studio");
    });
  });

  describe("getToolLabel", () => {
    it("should return friendly label for read_file", () => {
      const label = getToolLabel("read_file", { path: "/src/App.tsx" });
      expect(label).toBe("Revisando App.tsx");
    });

    it("should return friendly label for write_file", () => {
      const label = getToolLabel("write_file", { path: "/src/Login.tsx" });
      expect(label).toBe("Creando Login.tsx");
    });

    it("should return friendly label for search_code", () => {
      const label = getToolLabel("search_code", { query: "useState" });
      expect(label).toContain("useState");
    });

    it("should return friendly label for apply_diff", () => {
      const label = getToolLabel("apply_diff", { path: "src/utils.ts" });
      expect(label).toBe("Modificando utils.ts");
    });

    it("should return fallback for unknown tool", () => {
      const label = getToolLabel("some_custom_tool", {});
      expect(label).toBe("Ejecutando some_custom_tool");
    });

    it("should handle missing path gracefully", () => {
      const label = getToolLabel("read_file", {});
      expect(label).toBe("Revisando archivo");
    });
  });

  describe("PHASE_LABELS", () => {
    it("should have all phases defined", () => {
      expect(PHASE_LABELS.thinking).toBeDefined();
      expect(PHASE_LABELS.planning).toBeDefined();
      expect(PHASE_LABELS.building).toBeDefined();
      expect(PHASE_LABELS.verifying).toBeDefined();
      expect(PHASE_LABELS.chatting).toBeDefined();
    });

    it("should not contain technical jargon", () => {
      const values = Object.values(PHASE_LABELS);
      for (const label of values) {
        expect(label).not.toContain("SDD");
        expect(label).not.toContain("TDD");
        expect(label).not.toContain("pipeline");
      }
    });
  });
});
