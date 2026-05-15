import { describe, it, expect } from "vitest";
import { detectNudge, buildNudgeContext } from "../aura-nudges";

describe("Aura Nudges", () => {
  const baseCtx = () => buildNudgeContext("", [], true);

  describe("Anti-pattern detection", () => {
    it("should detect absolute Windows paths", () => {
      const ctx = { ...baseCtx(), input: "Modifica C:\\Users\\nico\\proyecto\\App.tsx" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("absolute-path");
      expect(nudge!.type).toBe("warning");
    });

    it("should detect absolute Unix paths", () => {
      const ctx = { ...baseCtx(), input: "Lee /home/nico/proyecto/index.ts" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("absolute-path");
    });

    it("should detect inline styles", () => {
      const ctx = { ...baseCtx(), input: 'Agrega style={{ color: "red" }}' };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("inline-styles");
    });

    it("should detect 'any' type usage", () => {
      const ctx = { ...baseCtx(), input: "Declara la variable como : any" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("any-type");
    });

    it("should detect test-skipping intentions", () => {
      const ctx = { ...baseCtx(), input: "Hazlo sin tests por ahora" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("skip-tests");
    });

    it("should detect console.log", () => {
      const ctx = { ...baseCtx(), input: "Agrega console.log(data) para debug" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("console-log");
    });

    it("should detect !important in CSS", () => {
      const ctx = { ...baseCtx(), input: "Pon color: red !important" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("important-css");
    });

    it("should detect vague requests", () => {
      const ctx = { ...baseCtx(), input: "arréglalo" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("vague-request");
    });

    it("should detect TODO/HACK markers", () => {
      const ctx = { ...baseCtx(), input: "Agrega un TODO para después" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("todo-hack");
    });
  });

  describe("Context awareness", () => {
    it("should detect no project open when user tries to create", () => {
      const ctx = { ...baseCtx(), input: "Crea un componente de React", hasProject: false };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("no-project");
    });

    it("should detect context exhaustion", () => {
      const ctx = { ...baseCtx(), contextRatio: 0.85 };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("context-full");
    });

    it("should detect repeated user messages", () => {
      const ctx = { ...baseCtx(), consecutiveUserMessages: 3 };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.id).toBe("repeated-messages");
    });

    it("should return null for clean input", () => {
      const ctx = { ...baseCtx(), input: "Crea un componente de botón con TypeScript" };
      const nudge = detectNudge(ctx);
      expect(nudge).toBeNull();
    });
  });

  describe("Priority ordering", () => {
    it("should prioritize warnings over tips", () => {
      // Combines any type (warning) with console.log (tip)
      const ctx = { ...baseCtx(), input: "Declara la variable como : any y agrega console.log(x)" };
      const nudge = detectNudge(ctx);
      expect(nudge).not.toBeNull();
      expect(nudge!.type).toBe("warning");
    });
  });
});
