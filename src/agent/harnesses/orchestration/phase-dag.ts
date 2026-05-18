/**
 * Phase DAG Harness — Ensures correct phase ordering.
 *
 * Validates that the current SDD phase has all its dependencies
 * satisfied before allowing execution. Prevents dangerous skips
 * (e.g., running apply without tasks).
 */

import type { Harness, HarnessContext, HarnessResult, SDDPhase } from "../types";
import { PHASE_DEPENDENCIES } from "../types";

export const phaseDagHarness: Harness = {
  id: "phase-dag",
  name: "Phase DAG Guard",
  phase: "pre-execute",
  priority: 10, // Very early — must run before any phase execution

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Only relevant when we're in an SDD flow with a target phase
    return ctx.currentPhase !== undefined;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const phase = ctx.currentPhase!;
    const deps = PHASE_DEPENDENCIES[phase];

    // Check all dependencies are in completedPhases
    const missing = deps.filter((dep) => !ctx.completedPhases.includes(dep));

    if (missing.length > 0) {
      return {
        block: true,
        blockReason: `Phase "${phase}" requires completed phases: [${missing.join(", ")}]. ` +
          `Currently completed: [${ctx.completedPhases.join(", ") || "none"}]. ` +
          `Run the missing phases first.`,
        contextUpdates: {},
        summary: `Blocked: missing dependencies for ${phase}`,
      };
    }

    return {
      block: false,
      contextUpdates: {},
      summary: `Phase "${phase}" dependencies satisfied: [${deps.join(", ") || "none"}]`,
    };
  },
};

/**
 * Determines the next recommended phase based on the DAG.
 * Pure function — used by the orchestrator to suggest next steps.
 */
export function getNextPhases(completed: SDDPhase[]): SDDPhase[] {
  const all: SDDPhase[] = ["explore", "propose", "spec", "design", "tasks", "apply", "verify", "archive"];
  const remaining = all.filter((p) => !completed.includes(p));

  return remaining.filter((phase) => {
    const deps = PHASE_DEPENDENCIES[phase];
    return deps.every((dep) => completed.includes(dep));
  });
}

/**
 * Validates a full phase sequence against the DAG.
 * Returns the first invalid step, or null if valid.
 */
export function validatePhaseSequence(
  sequence: SDDPhase[],
): { phase: SDDPhase; missing: SDDPhase[] } | null {
  const completed: SDDPhase[] = [];

  for (const phase of sequence) {
    const deps = PHASE_DEPENDENCIES[phase];
    const missing = deps.filter((d) => !completed.includes(d));
    if (missing.length > 0) {
      return { phase, missing };
    }
    completed.push(phase);
  }

  return null;
}
