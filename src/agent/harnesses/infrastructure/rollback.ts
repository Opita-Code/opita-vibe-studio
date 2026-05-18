/**
 * Rollback Harness — Recovery from failed operations.
 *
 * Designs mechanisms to revert operations or guide recovery
 * when technical failures occur.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const rollbackHarness: Harness = {
  id: "rollback",
  name: "Rollback Manager",
  phase: "post-execute",
  priority: 80,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code" && ctx.project.hasGit;
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    return {
      block: false,
      contextUpdates: {},
      summary: "Rollback plan available via git",
    };
  },
};

/**
 * Generates a rollback plan for the current change.
 */
export function generateRollbackPlan(
  changedFiles: string[],
  hasGit: boolean,
): string {
  if (!hasGit) {
    return "⚠️ No git — rollback not available. Changes are permanent.";
  }

  if (changedFiles.length === 0) {
    return "No files changed — no rollback needed.";
  }

  return [
    `## Rollback Plan`,
    ``,
    `Files changed: ${changedFiles.length}`,
    ``,
    `### Quick Rollback`,
    "```bash",
    `git checkout -- ${changedFiles.join(" ")}`,
    "```",
    ``,
    `### Full Rollback (all uncommitted changes)`,
    "```bash",
    `git stash`,
    "```",
    ``,
    `### Selective Rollback`,
    ...changedFiles.map((f) => `- \`git checkout -- ${f}\``),
  ].join("\n");
}
