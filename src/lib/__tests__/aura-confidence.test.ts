/**
 * Tests para el sistema de confianza de Aura.
 * Ejecutar: npx vitest run src/lib/__tests__/aura-confidence.test.ts
 */
import { describe, it, expect } from "vitest";
import {
  calculateConfidence,
  buildConfidenceContext,
  MAX_CHAIN_STEPS,
  MAX_CONSECUTIVE_ERRORS,
} from "../aura-confidence";

// ─── Helpers ───────────────────────────────────────────────────

function baseOpts() {
  return {
    hasProject: true,
    contextRatio: 0.3,
    stepsCompleted: 0,
  };
}

// ─── Tests ─────────────────────────────────────────────────────

describe("Aura Confidence", () => {
  describe("calculateConfidence", () => {
    it("explicit intent + project → high confidence", () => {
      const ctx = buildConfidenceContext("Crea un componente Button.tsx", baseOpts());
      const result = calculateConfidence(ctx);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.level).toBe("high");
      expect(result.shouldContinue).toBe(true);
      expect(result.shouldAsk).toBe(false);
    });

    it("vague input → low confidence", () => {
      const ctx = buildConfidenceContext("hazlo", baseOpts());
      const result = calculateConfidence(ctx);
      expect(result.score).toBeLessThanOrEqual(50);
      expect(result.shouldContinue).toBe(true); // Borderline — 50 is the cutoff
    });

    it("ambiguous input → reduced confidence", () => {
      const ctx = buildConfidenceContext("Haz algo con el componente", baseOpts());
      const result = calculateConfidence(ctx);
      expect(result.score).toBeLessThan(70);
    });

    it("critical files → reduced vs non-critical", () => {
      const critical = buildConfidenceContext("Modifica el package.json", baseOpts());
      const normal = buildConfidenceContext("Modifica el componente Button", baseOpts());
      // Critical should be lower than same without critical files
      expect(calculateConfidence(critical).score).toBeLessThan(calculateConfidence(normal).score);
    });

    it("context exhaustion → very low confidence", () => {
      const ctx = buildConfidenceContext("Continúa", {
        ...baseOpts(),
        contextRatio: 0.9,
      });
      const result = calculateConfidence(ctx);
      expect(result.score).toBeLessThan(60);
    });

    it("no project → reduced confidence", () => {
      const ctx = buildConfidenceContext("Crea un componente", {
        ...baseOpts(),
        hasProject: false,
      });
      const withProject = buildConfidenceContext("Crea un componente", baseOpts());
      expect(calculateConfidence(ctx).score).toBeLessThan(calculateConfidence(withProject).score);
    });
  });

  describe("Hard guardrails", () => {
    it("step limit → score 0, shouldAsk", () => {
      const ctx = buildConfidenceContext("Continúa", {
        ...baseOpts(),
        stepsCompleted: MAX_CHAIN_STEPS,
      });
      const result = calculateConfidence(ctx);
      expect(result.score).toBe(0);
      expect(result.shouldContinue).toBe(false);
      expect(result.shouldAsk).toBe(true);
    });

    it("consecutive errors → score 0, shouldAsk", () => {
      const ctx = buildConfidenceContext("Sigue", {
        ...baseOpts(),
        consecutiveErrors: MAX_CONSECUTIVE_ERRORS,
      });
      const result = calculateConfidence(ctx);
      expect(result.score).toBe(0);
      expect(result.shouldContinue).toBe(false);
    });

    it("same tool called twice → heavily penalized", () => {
      const ctx = buildConfidenceContext("Sigue", {
        ...baseOpts(),
        sameToolCalledTwice: true,
      });
      const result = calculateConfidence(ctx);
      expect(result.score).toBeLessThan(50);
    });

    it("model asked a question → pause", () => {
      const ctx = buildConfidenceContext("Sigue", {
        ...baseOpts(),
        lastModelResponse: "¿Quieres que use styled-components o CSS Modules?",
      });
      const result = calculateConfidence(ctx);
      expect(result.score).toBe(0);
      expect(result.shouldContinue).toBe(false);
      expect(result.shouldAsk).toBe(true);
    });
  });

  describe("buildConfidenceContext", () => {
    it("detects file references", () => {
      const ctx = buildConfidenceContext("Modifica src/components/Button.tsx", baseOpts());
      expect(ctx.hasFileContext).toBe(true);
    });

    it("detects explicit intent", () => {
      const ctx = buildConfidenceContext("Crea un componente de login", baseOpts());
      expect(ctx.hasExplicitIntent).toBe(true);
    });

    it("detects vague input", () => {
      const ctx = buildConfidenceContext("arréglalo", baseOpts());
      expect(ctx.isVague).toBe(true);
    });

    it("detects critical files", () => {
      const ctx = buildConfidenceContext("Edita el .env del proyecto", baseOpts());
      expect(ctx.touchesCriticalFiles).toBe(true);
    });

    it("detects ambiguous input", () => {
      const ctx = buildConfidenceContext("Haz algo así como quieras", baseOpts());
      expect(ctx.isAmbiguous).toBe(true);
    });

    it("defaults maxSteps to MAX_CHAIN_STEPS", () => {
      const ctx = buildConfidenceContext("test", baseOpts());
      expect(ctx.maxSteps).toBe(MAX_CHAIN_STEPS);
    });

    it("detects model questions", () => {
      const ctx = buildConfidenceContext("Sigue", {
        ...baseOpts(),
        lastModelResponse: "¿Prefieres React o Vue?",
      });
      expect(ctx.modelAskedQuestion).toBe(true);
    });

    it("no model question when response is normal", () => {
      const ctx = buildConfidenceContext("Sigue", {
        ...baseOpts(),
        lastModelResponse: "He creado el componente Button.tsx correctamente.",
      });
      expect(ctx.modelAskedQuestion).toBe(false);
    });
  });
});
