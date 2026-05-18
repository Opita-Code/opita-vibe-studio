/**
 * Review Workload Harness — Reviewer cognitive load guard.
 *
 * Prevents the agent from generating massive changes that are
 * impossible for humans to review. Enforces a 400-line budget
 * per PR and recommends chained PRs when exceeded.
 *
 * Budget: 400 changed lines (additions + deletions)
 */

import type { Harness, HarnessContext, HarnessResult, DeliveryStrategy } from "../types";

/** Default line budget per PR */
export const LINE_BUDGET = 400;

/** Risk thresholds */
const RISK_THRESHOLDS = {
  low: 200,
  medium: 350,
  high: 400,
} as const;

export const reviewWorkloadHarness: Harness = {
  id: "review-workload",
  name: "Review Workload Guard",
  phase: "pre-deliver",
  priority: 10,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code" && ctx.deliveryStrategy !== "direct";
  },

  execute(_ctx: Readonly<HarnessContext>): HarnessResult {
    // The workload check happens at tasks time (estimation)
    // and at delivery time (actual count). This harness sets
    // the policy flag.
    return {
      block: false,
      contextUpdates: {},
      summary: `Review workload guard active — ${LINE_BUDGET}-line budget`,
    };
  },
};

/**
 * Assesses the risk level of a change based on estimated lines.
 */
export function assessWorkloadRisk(
  estimatedLines: number,
): { risk: "low" | "medium" | "high"; recommendation: string } {
  if (estimatedLines <= RISK_THRESHOLDS.low) {
    return {
      risk: "low",
      recommendation: "Single PR is fine",
    };
  }

  if (estimatedLines <= RISK_THRESHOLDS.medium) {
    return {
      risk: "medium",
      recommendation: "Single PR acceptable, but consider splitting if logic is complex",
    };
  }

  return {
    risk: "high",
    recommendation: `Estimated ${estimatedLines} lines exceeds ${LINE_BUDGET}-line budget. Use chained PRs.`,
  };
}

/**
 * Generates the review workload forecast for the tasks artifact.
 */
export function generateWorkloadForecast(
  estimatedLines: number,
  taskCount: number,
): string {
  const { risk, recommendation } = assessWorkloadRisk(estimatedLines);

  return [
    `## Review Workload Forecast`,
    ``,
    `- Estimated changed lines: ${estimatedLines}`,
    `- Task count: ${taskCount}`,
    `- 400-line budget risk: ${risk.charAt(0).toUpperCase() + risk.slice(1)}`,
    `- Chained PRs recommended: ${risk === "high" ? "Yes" : "No"}`,
    `- Decision needed before apply: ${risk === "high" ? "Yes" : "No"}`,
    ``,
    `**Recommendation**: ${recommendation}`,
  ].join("\n");
}

/**
 * Resolves the final delivery strategy based on workload risk
 * and user's cached strategy preference.
 */
export function resolveDeliveryFromWorkload(
  risk: "low" | "medium" | "high",
  userStrategy: DeliveryStrategy,
): DeliveryStrategy {
  // Low/medium risk → respect user choice
  if (risk !== "high") return userStrategy;

  // High risk + auto-chain → stacked PRs
  if (userStrategy === "stacked-pr") return "stacked-pr";

  // High risk + size-exception → allow but mark
  if (userStrategy === "size-exception") return "size-exception";

  // High risk + anything else → suggest stacked
  return "stacked-pr";
}
