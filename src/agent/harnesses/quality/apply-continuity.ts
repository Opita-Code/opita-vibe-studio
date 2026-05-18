/**
 * Apply Continuity Harness — Resume without losing progress.
 *
 * Allows complex, multi-batch tasks to be resumed without
 * duplicating work. Maintains the operational state across
 * interruptions, compactions, and session boundaries.
 *
 * Responsibilities:
 * - Check for existing apply-progress before starting
 * - Merge new progress with existing progress
 * - Skip already-completed tasks
 * - Track which batch is currently executing
 */

import type { Harness, HarnessContext, HarnessResult } from "../types";

export const applyContinuityHarness: Harness = {
  id: "apply-continuity",
  name: "Apply Continuity Manager",
  phase: "pre-execute",
  priority: 55, // After TDD check (50)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.currentPhase === "apply";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    // Check if we have existing progress
    const hasExistingProgress = ctx.artifacts["apply-progress"] !== undefined;

    return {
      block: false,
      contextUpdates: {},
      summary: hasExistingProgress
        ? "Existing apply-progress found — will merge with new progress"
        : "No existing progress — starting fresh apply",
    };
  },
};

/**
 * Parses completed tasks from an apply-progress artifact.
 * Returns task IDs that have been marked as [x].
 */
export function parseCompletedTasks(progress: string): string[] {
  const completed: string[] = [];
  const lines = progress.split("\n");

  for (const line of lines) {
    // Match both "- [x]" and "- [X]" patterns
    const match = line.match(/^[-*]\s*\[x\]\s*(\d+\.?\d*)\s/i);
    if (match) {
      completed.push(match[1]);
    }
  }

  return completed;
}

/**
 * Merges existing progress with new progress.
 * Ensures no completed task is lost from prior batches.
 */
export function mergeProgress(
  existing: string,
  newProgress: string,
): string {
  const existingTasks = parseCompletedTasks(existing);


  // Build merged output — take the new progress as base,
  // and ensure all previously completed tasks are marked
  let merged = newProgress;

  for (const taskId of existingTasks) {
    // If the task was in existing but not in new, it might have been
    // reset. Re-mark it as completed.
    const uncheckedPattern = new RegExp(
      `^([-*]\\s*)\\[ \\]\\s*(${taskId.replace(".", "\\.")}\\s)`,
      "m"
    );
    merged = merged.replace(uncheckedPattern, `$1[x] $2`);
  }

  return merged;
}

/**
 * Generates the continuity instructions for the apply sub-agent.
 */
export function generateContinuityInstructions(
  completedTasks: string[],
): string {
  if (completedTasks.length === 0) return "";

  return [
    `## Continuidad de Progreso`,
    ``,
    `Las siguientes tareas ya están completadas de un batch anterior:`,
    ...completedTasks.map((t) => `- [x] ${t}`),
    ``,
    `SKIP estas tareas. Comienza desde la primera tarea incompleta.`,
    `Cuando guardes tu progreso, INCLUYE tanto las tareas previas como las nuevas.`,
  ].join("\n");
}
