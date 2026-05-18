/**
 * Result Contract Harness — Standardizes phase envelopes.
 *
 * Ensures every SDD phase returns a consistent PhaseEnvelope.
 * Runs post-execute to validate and normalize the output.
 */

import type { Harness, HarnessContext, HarnessResult, PhaseEnvelope, SDDPhase } from "../types";
import { getNextPhases } from "./phase-dag";

export const resultContractHarness: Harness = {
  id: "result-contract",
  name: "Result Contract Validator",
  phase: "post-execute",
  priority: 90, // Late — validates after execution

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.currentPhase !== undefined;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // This harness doesn't block — it enriches the context with
    // computed next-phase recommendations after a phase completes.
    const completed = ctx.completedPhases.includes(ctx.currentPhase!)
      ? ctx.completedPhases
      : [...ctx.completedPhases, ctx.currentPhase!];

    const nextPhases = getNextPhases(completed);

    return {
      block: false,
      contextUpdates: {
        completedPhases: completed,
      },
      summary: `Phase "${ctx.currentPhase}" completed. Next available: [${nextPhases.join(", ") || "none"}]`,
    };
  },
};

/**
 * Creates a standardized PhaseEnvelope from raw phase output.
 * Use this in sub-agents to format their return value.
 */
export function createPhaseEnvelope(
  phase: SDDPhase,
  status: PhaseEnvelope["status"],
  summary: string,
  opts: {
    artifacts?: string[];
    nextRecommended?: SDDPhase | "none";
    risks?: string[];
    skillResolution?: PhaseEnvelope["skillResolution"];
  } = {},
): PhaseEnvelope {
  return {
    phase,
    status,
    executiveSummary: summary,
    artifacts: opts.artifacts ?? [],
    nextRecommended: opts.nextRecommended ?? "none",
    risks: opts.risks ?? [],
    skillResolution: opts.skillResolution ?? "none",
  };
}

/**
 * Validates a PhaseEnvelope has all required fields.
 * Returns validation errors (empty = valid).
 */
export function validateEnvelope(envelope: Partial<PhaseEnvelope>): string[] {
  const errors: string[] = [];

  if (!envelope.phase) errors.push("Missing 'phase'");
  if (!envelope.status) errors.push("Missing 'status'");
  if (!envelope.executiveSummary) errors.push("Missing 'executiveSummary'");
  if (!Array.isArray(envelope.artifacts)) errors.push("Missing 'artifacts' array");
  if (!envelope.skillResolution) errors.push("Missing 'skillResolution'");

  return errors;
}
