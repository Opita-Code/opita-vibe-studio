/**
 * Skill Resolution Feedback Harness — Audit trail for skills.
 *
 * Tracks which skills were actually applied vs which failed,
 * enabling the orchestrator to correct course if skills
 * were lost (e.g., after compaction).
 *
 * The feedback loop:
 * 1. Sub-agent reports its skill resolution status
 * 2. This harness compares expected vs actual
 * 3. If mismatch → triggers re-resolution for future calls
 */

import type { Harness, HarnessContext, HarnessResult, SkillResolution } from "../types";

export const skillResolutionHarness: Harness = {
  id: "skill-resolution-feedback",
  name: "Skill Resolution Auditor",
  phase: "post-execute",
  priority: 50,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Active when skills were expected to be resolved
    return ctx.resolvedSkills.length > 0;
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // Check if skills were properly injected
    const audit = auditSkillResolution(
      ctx.skillResolution,
      ctx.resolvedSkills.length,
    );

    return {
      block: false,
      contextUpdates: {},
      summary: audit.message,
    };
  },
};

/**
 * Audit result for skill resolution
 */
export interface SkillAuditResult {
  /** Whether the resolution was successful */
  healthy: boolean;
  /** Human-readable message */
  message: string;
  /** Whether the registry needs to be reloaded */
  needsReload: boolean;
  /** Recommended action */
  action: "none" | "reload-registry" | "warn-user";
}

/**
 * Audits skill resolution status.
 * Pure function for analysis.
 */
export function auditSkillResolution(
  resolution: SkillResolution,
  expectedSkillCount: number,
): SkillAuditResult {
  switch (resolution) {
    case "injected":
      return {
        healthy: true,
        message: `Skills injected successfully (${expectedSkillCount} skills)`,
        needsReload: false,
        action: "none",
      };

    case "fallback-registry":
      return {
        healthy: false,
        message: "Skills loaded from registry fallback — cache was lost (likely compaction)",
        needsReload: true,
        action: "reload-registry",
      };

    case "fallback-path":
      return {
        healthy: false,
        message: "Skills loaded via file path fallback — orchestrator failed to inject",
        needsReload: true,
        action: "reload-registry",
      };

    case "none":
      if (expectedSkillCount > 0) {
        return {
          healthy: false,
          message: `Expected ${expectedSkillCount} skills but none were resolved`,
          needsReload: true,
          action: "warn-user",
        };
      }
      return {
        healthy: true,
        message: "No skills expected or resolved",
        needsReload: false,
        action: "none",
      };
  }
}

/**
 * Determines if the skill registry needs reloading based on
 * a sequence of audit results. If multiple failures occur,
 * the registry is likely stale.
 */
export function shouldReloadRegistry(
  audits: SkillAuditResult[],
  threshold: number = 2,
): boolean {
  const failures = audits.filter((a) => !a.healthy).length;
  return failures >= threshold;
}
