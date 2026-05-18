/**
 * Engram Memory Harness — Cross-session persistence.
 *
 * The nucleus of persistence. Ensures the agent maintains memory
 * between sessions and across agents, preventing rediscovery of
 * past decisions.
 *
 * Responsibilities:
 * 1. Load relevant context from Engram at session start
 * 2. Ensure phase artifacts are persisted after execution
 * 3. Recover state after compaction
 *
 * NOTE: This harness manages the POLICY of when to persist.
 * The actual Engram calls happen in the sub-agents that have
 * access to the MCP tools. This harness just sets flags and
 * artifact references in the context.
 */

import type { Harness, HarnessContext, HarnessResult, ArtifactStoreMode } from "../types";

export const engramMemoryHarness: Harness = {
  id: "engram-memory",
  name: "Engram Memory Manager",
  phase: "pre-execute",
  priority: 20, // After artifact-dependency (15)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    // Active when using engram or hybrid storage
    return ctx.artifactStore === "engram" || ctx.artifactStore === "hybrid";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // Build the list of artifacts to retrieve based on current phase
    const retrievalPlan = buildRetrievalPlan(ctx);

    return {
      block: false,
      contextUpdates: {},
      summary: retrievalPlan.length > 0
        ? `Engram retrieval plan: [${retrievalPlan.join(", ")}]`
        : "Engram: no artifacts to retrieve",
    };
  },
};

/**
 * Determines which Engram topic keys to retrieve for the current phase.
 * Returns topic keys in the format "sdd/{change-name}/{artifact-type}".
 */
export function buildRetrievalPlan(ctx: Readonly<HarnessContext>): string[] {
  if (!ctx.currentPhase) return [];
  if (ctx.artifactStore !== "engram" && ctx.artifactStore !== "hybrid") return [];

  const keys: string[] = [];

  // Phase-specific retrieval
  switch (ctx.currentPhase) {
    case "spec":
    case "design":
      keys.push("proposal");
      break;
    case "tasks":
      keys.push("spec", "design");
      break;
    case "apply":
      keys.push("tasks", "spec", "design");
      // Check for existing apply-progress (continuation)
      keys.push("apply-progress");
      break;
    case "verify":
      keys.push("spec", "tasks", "apply-progress");
      break;
    case "archive":
      keys.push("proposal", "spec", "design", "tasks", "apply-progress", "verify-report");
      break;
  }

  return keys;
}

/**
 * Determines which artifact to persist after phase execution.
 * Returns the topic key suffix.
 */
export function getPersistenceTarget(
  phase: HarnessContext["currentPhase"],
): string | null {
  if (!phase) return null;

  const targets: Record<string, string> = {
    explore: "explore",
    propose: "proposal",
    spec: "spec",
    design: "design",
    tasks: "tasks",
    apply: "apply-progress",
    verify: "verify-report",
    archive: "archive-report",
  };

  return targets[phase] ?? null;
}

/**
 * Generates the Engram persistence instructions for a sub-agent prompt.
 * The sub-agent uses these to know HOW to persist its output.
 */
export function generatePersistenceInstructions(
  changeName: string,
  phase: HarnessContext["currentPhase"],
  mode: ArtifactStoreMode,
): string {
  if (mode === "none" || !phase) return "";

  const target = getPersistenceTarget(phase);
  if (!target) return "";

  const topicKey = `sdd/${changeName}/${target}`;

  if (mode === "engram" || mode === "hybrid") {
    return [
      `PERSISTENCE (MANDATORY — do NOT skip):`,
      `After completing your work, you MUST call:`,
      `  mem_save(`,
      `    title: "${topicKey}",`,
      `    topic_key: "${topicKey}",`,
      `    type: "architecture",`,
      `    project: "{project}",`,
      `    capture_prompt: false,`,
      `    content: "{your full artifact markdown}"`,
      `  )`,
      `If you return without calling mem_save, the next phase CANNOT find your artifact.`,
    ].join("\n");
  }

  return "";
}
