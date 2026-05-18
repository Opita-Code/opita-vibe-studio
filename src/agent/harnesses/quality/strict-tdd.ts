/**
 * Strict TDD Harness — Red-Green-Refactor enforcement.
 *
 * When active, requires evidence of:
 * 1. RED: Test written first (fails initially)
 * 2. GREEN: Implementation makes test pass
 * 3. REFACTOR: Code cleaned up (optional evidence)
 *
 * Activation conditions:
 * - Project has a test runner
 * - The request involves creating/modifying testable code
 * - Not explicitly opted out by user
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

/** Patterns that suggest non-testable work (skip TDD) */
const NO_TDD_PATTERNS = [
  "estilo", "css", "color", "fuente", "diseño visual",
  "readme", "documentación", "documentacion",
  "configuración", "configuracion", ".env",
  "renombrar", "mover archivo",
];

/** Patterns that explicitly opt out of TDD */
const OPT_OUT_PATTERNS = [
  "sin test", "no test", "sin prueba", "no prueba",
  "skip test", "without test",
];

/** Patterns that suggest testable code work */
const TDD_PATTERNS = [
  "crear", "nuevo", "nueva", "implementar", "agregar", "añadir",
  "bug", "fix", "arreglar", "corregir",
  "lógica", "logica", "función", "funcion", "servicio", "hook",
  "test", "prueba", "validar", "endpoint", "api",
];

export const strictTDDHarness: Harness = {
  id: "strict-tdd",
  name: "Strict TDD Enforcer",
  phase: "pre-execute",
  priority: 50, // After init and dependency checks

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const useTDD = decideTDD(
      ctx.userText,
      ctx.project.testRunner,
    );

    return {
      block: false,
      contextUpdates: { useTDD },
      summary: useTDD
        ? `Strict TDD active — test runner: ${ctx.project.testRunner}`
        : `TDD skipped — ${!ctx.project.testRunner ? "no test runner" : "non-testable task"}`,
    };
  },
};

/**
 * Decides whether to use TDD for this request.
 * Migrated from orchestrator.ts — now lives here as the single source.
 */
export function decideTDD(
  userText: string,
  testRunner: string | null,
): boolean {
  // No test runner → no TDD, period
  if (!testRunner) return false;

  const lower = userText.toLowerCase();

  // User explicitly opts out
  if (OPT_OUT_PATTERNS.some((p) => lower.includes(p))) return false;

  // Non-testable work patterns
  if (NO_TDD_PATTERNS.some((p) => lower.includes(p))) return false;

  // Testable code patterns
  if (TDD_PATTERNS.some((p) => lower.includes(p))) return true;

  // Default: no TDD (conservative)
  return false;
}

/**
 * Generates TDD instructions for the system prompt.
 * Called by the build agent when TDD is active.
 */
export function generateTDDInstructions(testRunner: string): string {
  return [
    `## Modo TDD Estricto (Activo)`,
    ``,
    `Runner de tests: \`${testRunner}\``,
    ``,
    `Para CADA cambio funcional, sigue este ciclo:`,
    `1. **RED** — Escribe el test primero. Debe fallar.`,
    `2. **GREEN** — Escribe la implementación mínima para que pase.`,
    `3. **REFACTOR** — Limpia el código sin romper tests.`,
    ``,
    `REGLAS:`,
    `- NO escribas implementación sin test primero`,
    `- Ejecuta tests después de cada paso (usa \`${testRunner}\`)`,
    `- Si un test falla inesperadamente, arréglalo antes de continuar`,
    `- Documenta el ciclo RED→GREEN→REFACTOR en tu respuesta`,
  ].join("\n");
}

/**
 * Validates TDD cycle evidence in an apply-progress report.
 * Returns issues found (empty = compliant).
 */
export function validateTDDEvidence(report: string): string[] {
  const issues: string[] = [];

  const hasRed = report.includes("RED") || report.includes("red") || report.includes("🔴");
  const hasGreen = report.includes("GREEN") || report.includes("green") || report.includes("🟢");

  if (!hasRed) {
    issues.push("Missing RED phase evidence — tests must be written first");
  }
  if (!hasGreen) {
    issues.push("Missing GREEN phase evidence — implementation must make tests pass");
  }

  return issues;
}
