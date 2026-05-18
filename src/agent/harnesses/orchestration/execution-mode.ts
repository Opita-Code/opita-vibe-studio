/**
 * Execution Mode Harness — Auto vs Interactive toggle.
 *
 * Balances speed with human control. In auto mode, the agent
 * executes all phases without pausing. In interactive mode,
 * it pauses after planning for user confirmation.
 *
 * Decision factors:
 * - User's explicit preference (from settings store)
 * - Task complexity (simple = auto, complex = interactive)
 * - Plan tier (free always auto for basic tasks)
 */

import type { Harness, HarnessContext, HarnessResult, ExecutionMode } from "../types";

/** Keywords that indicate high complexity → prefer interactive */
const COMPLEXITY_INDICATORS = [
  "sistema", "módulo", "modulo", "migrar", "migración", "migracion",
  "refactor", "reescribir", "arquitectura", "infraestructura",
  "múltiples", "multiples", "base de datos", "database",
  "autenticación", "autenticacion", "seguridad", "security",
  "desplegar", "deploy", "producción", "produccion",
];

/** Keywords that indicate simplicity → prefer auto */
const SIMPLICITY_INDICATORS = [
  "color", "estilo", "css", "texto", "título", "titulo",
  "centrar", "alinear", "espaciado", "margen", "padding",
  "fuente", "tamaño", "tamano", "icono", "imagen",
];

export const executionModeHarness: Harness = {
  id: "execution-mode",
  name: "Execution Mode Decider",
  phase: "post-classify",
  priority: 20,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Always relevant for code/explore intents
    return ctx.intent === "code" || ctx.intent === "explore";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const mode = decideExecutionMode(ctx.userText, ctx.executionMode, ctx.plan);

    return {
      block: false,
      contextUpdates: { executionMode: mode },
      summary: `Execution mode: ${mode}`,
    };
  },
};

/**
 * Decides the execution mode based on user text and context.
 * Pure function — easy to test.
 */
export function decideExecutionMode(
  userText: string,
  currentMode: ExecutionMode,
  _plan: "free" | "estudiante" | "pro",
): ExecutionMode {
  const lower = userText.toLowerCase();

  // User explicitly requests a mode
  if (lower.includes("modo auto") || lower.includes("auto mode") || lower.includes("sin pausa")) {
    return "auto";
  }
  if (lower.includes("paso a paso") || lower.includes("step by step") || lower.includes("interactivo")) {
    return "interactive";
  }

  // High complexity → interactive (let user review plan first)
  const complexityScore = COMPLEXITY_INDICATORS.filter((k) => lower.includes(k)).length;
  if (complexityScore >= 2) return "interactive";

  // Simple styling tasks → auto (no need to review)
  const simplicityScore = SIMPLICITY_INDICATORS.filter((k) => lower.includes(k)).length;
  if (simplicityScore >= 2) return "auto";

  // Default to current mode (user's preference from settings)
  return currentMode;
}
