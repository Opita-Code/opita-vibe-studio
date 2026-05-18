/**
 * Session Summary / Compaction Recovery Harness.
 *
 * Generates and saves an operational summary during memory
 * compaction processes, ensuring the next session starts
 * with correct context.
 *
 * In Vibe Studio context, "compaction" means the chat history
 * is too long and the oldest messages get trimmed. This harness
 * ensures critical state is preserved.
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const sessionSummaryHarness: Harness = {
  id: "session-summary",
  name: "Session Summary Manager",
  phase: "post-execute",
  priority: 95, // Very late — after everything else

  shouldActivate(_ctx: Readonly<HarnessContext>): boolean {
    return true;
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    return {
      block: false,
      contextUpdates: {},
      summary: "Session state tracked for potential recovery",
    };
  },
};

/**
 * Generates a session summary from the current context.
 * Used when saving state for recovery after compaction.
 */
export function generateSessionSummary(ctx: Readonly<HarnessContext>): string {
  const lines: string[] = [
    `## Session State`,
    ``,
    `### Project`,
    `- Stack: [${ctx.project.stack.join(", ")}]`,
    `- Test runner: ${ctx.project.testRunner ?? "none"}`,
    `- Package manager: ${ctx.project.packageManager ?? "none"}`,
    `- Git: ${ctx.project.hasGit ? "yes" : "no"}`,
    ``,
    `### Execution`,
    `- Intent: ${ctx.intent ?? "none"}`,
    `- Mode: ${ctx.executionMode}`,
    `- TDD: ${ctx.useTDD ? "active" : "inactive"}`,
    `- Delivery: ${ctx.deliveryStrategy}`,
    `- Artifact store: ${ctx.artifactStore}`,
    ``,
    `### SDD State`,
    `- Current phase: ${ctx.currentPhase ?? "none"}`,
    `- Completed: [${ctx.completedPhases.join(", ")}]`,
    ``,
    `### Skills`,
    `- Resolved: ${ctx.resolvedSkills.length} skills`,
    `- Resolution: ${ctx.skillResolution}`,
    ``,
    `### Harness Trace`,
    ...ctx.harnessTrace
      .filter((t) => t.activated)
      .map((t) => `- ${t.harnessId}: ${t.result} (${t.durationMs.toFixed(1)}ms)`),
  ];

  return lines.join("\n");
}

/**
 * Extracts minimal recovery state from a session summary.
 * Used to bootstrap a new session from a compacted summary.
 */
export function extractRecoveryState(summary: string): {
  completedPhases: string[];
  currentPhase?: string;
  artifactStore?: string;
} {
  const phases: string[] = [];
  let currentPhase: string | undefined;
  let artifactStore: string | undefined;

  const completedMatch = summary.match(/Completed:\s*\[([^\]]*)\]/);
  if (completedMatch?.[1]) {
    phases.push(...completedMatch[1].split(",").map((s) => s.trim()).filter(Boolean));
  }

  const currentMatch = summary.match(/Current phase:\s*(\S+)/);
  if (currentMatch?.[1] && currentMatch[1] !== "none") {
    currentPhase = currentMatch[1];
  }

  const storeMatch = summary.match(/Artifact store:\s*(\S+)/);
  if (storeMatch?.[1] && storeMatch[1] !== "none") {
    artifactStore = storeMatch[1];
  }

  return { completedPhases: phases, currentPhase, artifactStore };
}
