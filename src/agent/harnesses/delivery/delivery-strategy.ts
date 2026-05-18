/**
 * Delivery Strategy Harness — How code is delivered.
 *
 * Decides whether to apply changes directly, use a feature
 * branch, create a PR, use stacked PRs, or accept a size
 * exception based on git state, change scope, and user preference.
 */

import type { Harness, HarnessContext, HarnessResult, DeliveryStrategy } from "../types";

/** Patterns indicating large scope → feature branch or PR */
const LARGE_SCOPE_PATTERNS = [
  "sistema", "módulo", "modulo", "migrar", "migración", "migracion",
  "refactor completo", "reescribir", "arquitectura",
  "múltiples archivos", "multiples archivos",
];

/** Patterns indicating user wants explicit PR */
const PR_PATTERNS = [
  "pull request", "pr ", "branch", "rama",
];

export const deliveryStrategyHarness: Harness = {
  id: "delivery-strategy",
  name: "Delivery Strategy Decider",
  phase: "post-classify",
  priority: 40,

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const strategy = decideDeliveryStrategy(
      ctx.userText,
      ctx.project.hasGit,
      ctx.plan,
    );

    return {
      block: false,
      contextUpdates: { deliveryStrategy: strategy },
      summary: `Delivery: ${strategy}`,
    };
  },
};

/**
 * Decides delivery strategy. Migrated from orchestrator's decideDelivery.
 * Enhanced with stacked-pr and size-exception options.
 */
export function decideDeliveryStrategy(
  userText: string,
  hasGit: boolean,
  plan: "free" | "estudiante" | "pro",
): DeliveryStrategy {
  // No git → always direct
  if (!hasGit) return "direct";

  // Free plan → always direct (no branch management)
  if (plan === "free") return "direct";

  const lower = userText.toLowerCase();

  // User explicitly requests PR
  if (PR_PATTERNS.some((p) => lower.includes(p))) return "pr";

  // User explicitly requests stacked
  if (lower.includes("stacked") || lower.includes("chained") || lower.includes("encadenado")) {
    return "stacked-pr";
  }

  // Large scope → feature branch
  if (LARGE_SCOPE_PATTERNS.some((p) => lower.includes(p))) return "feature-branch";

  // Default for paid plans: direct (safest for beginners)
  return "direct";
}
