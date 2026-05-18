/**
 * Artifact Dependency Harness — Validates required inputs.
 *
 * Each SDD phase has mandatory input artifacts. If any are missing,
 * execution is blocked with a clear message about what's needed.
 *
 * Example: apply phase requires tasks + spec + design.
 * If tasks artifact is missing, the harness blocks with:
 * "Phase 'apply' requires artifact 'tasks'. Run sdd-tasks first."
 */

import type { Harness, HarnessContext, HarnessResult, SDDPhase, ArtifactRef } from "../types";

/** Maps each phase to its REQUIRED input artifacts */
const REQUIRED_ARTIFACTS: Record<SDDPhase, SDDPhase[]> = {
  explore: [],
  propose: [],           // Can use explore output but doesn't require it
  spec: ["propose"],
  design: ["propose"],
  tasks: ["spec", "design"],
  apply: ["tasks"],       // Also needs spec+design but reads them through tasks
  verify: ["apply"],      // Needs apply-progress
  archive: ["verify"],
};

export const artifactDependencyHarness: Harness = {
  id: "artifact-dependency",
  name: "Artifact Dependency Guard",
  phase: "pre-execute",
  priority: 15, // After phase-dag (10), before skill loading

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.currentPhase !== undefined;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const phase = ctx.currentPhase!;
    const required = REQUIRED_ARTIFACTS[phase];

    if (required.length === 0) {
      return {
        block: false,
        contextUpdates: {},
        summary: `Phase "${phase}" has no required artifacts`,
      };
    }

    const missing = required.filter((dep) => !ctx.artifacts[dep]);

    if (missing.length > 0) {
      return {
        block: true,
        blockReason:
          `Phase "${phase}" requires artifacts: [${missing.join(", ")}]. ` +
          `Available: [${Object.keys(ctx.artifacts).join(", ") || "none"}]. ` +
          `Generate the missing artifacts first.`,
        contextUpdates: {},
        summary: `Blocked: missing artifacts for ${phase}`,
      };
    }

    return {
      block: false,
      contextUpdates: {},
      summary: `All required artifacts present for "${phase}": [${required.join(", ")}]`,
    };
  },
};

/**
 * Creates an ArtifactRef for a given phase and change name.
 */
export function createArtifactRef(
  type: ArtifactRef["type"],
  changeName: string,
  filePath?: string,
  observationId?: number,
): ArtifactRef {
  return {
    type,
    topicKey: `sdd/${changeName}/${type}`,
    filePath,
    observationId,
  };
}

/**
 * Checks if all required artifacts for a phase are available.
 * Pure function for pre-validation.
 */
export function checkArtifactReadiness(
  phase: SDDPhase,
  available: Partial<Record<string, ArtifactRef>>,
): { ready: boolean; missing: SDDPhase[] } {
  const required = REQUIRED_ARTIFACTS[phase];
  const missing = required.filter((dep) => !available[dep]);
  return { ready: missing.length === 0, missing };
}
