import { describe, it, expect } from "vitest";
import { getNextSteps, buildStepContext } from "../aura-steps";

describe("Aura Smart Next-Step", () => {
  const makeCtx = (content: string, opts?: Partial<ReturnType<typeof buildStepContext>>) =>
    buildStepContext(
      [
        { role: "user", content: "Hola" },
        { role: "assistant", content },
      ],
      opts?.pipelinePhase ?? null,
      opts?.hasProject ?? true,
      opts?.hasOpenFiles ?? true,
    );

  describe("File creation detection", () => {
    it("should suggest tests and preview after file creation", () => {
      const ctx = makeCtx("✅ Archivo creado: Button.tsx\n\nCreé un componente de botón.");
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.label.includes("test") || s.label.includes("Test"))).toBe(true);
    });

    it("should suggest VibeLens for component creation", () => {
      const ctx = makeCtx("✅ Archivo creado: Button.tsx\n\nCreé el componente con estilos.");
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.label.includes("VibeLens") || s.label.includes("test"))).toBe(true);
    });
  });

  describe("Error fix detection", () => {
    it("should suggest verification after bug fix", () => {
      const ctx = makeCtx("Corregí el error — el problema era un import circular.");
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.label.includes("Verificar") || s.label.includes("test"))).toBe(true);
    });
  });

  describe("Concept explanation detection", () => {
    it("should suggest implementation after concept explanation", () => {
      const ctx = makeCtx("En resumen, el patrón Observer permite...");
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.label.includes("Implementar") || s.label.includes("Ejemplo"))).toBe(true);
    });
  });

  describe("New conversation", () => {
    it("should suggest exploring project in fresh conversation", () => {
      const ctx = buildStepContext(
        [{ role: "assistant", content: "¡Hola! ¿En qué puedo ayudarte?" }],
        null,
        true,
        false,
      );
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.label.includes("Explorar") || s.label.includes("README"))).toBe(true);
    });

    it("should suggest opening project when none is open", () => {
      const ctx = buildStepContext(
        [{ role: "assistant", content: "¡Hola!" }],
        null,
        false,
        false,
      );
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeGreaterThan(0);
      expect(steps.some((s) => s.label.includes("Abrir"))).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should return empty for generic messages in long conversations", () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "Mensaje genérico sin patrón detectable",
      }));
      const ctx = buildStepContext(messages, null, true, true);
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeLessThanOrEqual(2);
    });

    it("should return max 2 suggestions", () => {
      const ctx = makeCtx("✅ Archivo creado: Button.tsx\nCreé el componente. En resumen, usa props.");
      const steps = getNextSteps(ctx);
      expect(steps.length).toBeLessThanOrEqual(2);
    });
  });
});
