/**
 * Model Routing Harness — AI model selection per phase.
 *
 * Decides which AI provider/model to use based on:
 * - Plan tier (free → flash, pro → premium for deep phases)
 * - Phase type (high-cognitive vs mechanical)
 * - BYOK (user's own key overrides everything)
 * - Availability (graceful fallback)
 *
 * Migrated from model-router.ts — now composable via harness.
 */

import type { Harness, HarnessContext, HarnessResult, ModelSelection } from "../types";

/** SDD phases that require deeper reasoning */
const HIGH_COGNITIVE_PHASES = new Set([
  "explore", "propose", "design", "verify",
]);

export const modelRoutingHarness: Harness = {
  id: "model-routing",
  name: "Model Routing Decider",
  phase: "pre-execute",
  priority: 40, // After skill registry (30)

  shouldActivate(ctx: Readonly<HarnessContext>): boolean {
    return ctx.intent === "code" || ctx.intent === "explore";
  },

  execute(ctx: Readonly<HarnessContext>): HarnessResult {
    const model = selectModel(ctx);

    return {
      block: model.blocked ?? false,
      blockReason: model.blockReason,
      contextUpdates: { model },
      summary: model.blocked
        ? `Blocked: ${model.blockReason}`
        : `Model: ${model.providerId}/${model.modelId} (byok: ${model.byok})`,
    };
  },
};

/**
 * Selects optimal model for the current context.
 * Pure function — replaces the old model-router.ts logic.
 */
export function selectModel(ctx: Readonly<HarnessContext>): ModelSelection {
  const { plan, customApiKey, requestedModelId, currentPhase } = ctx;

  // BYOK: respect user's choice
  if (customApiKey && customApiKey !== "aws-managed") {
    return {
      providerId: inferProvider(requestedModelId),
      modelId: requestedModelId || "deepseek-chat",
      byok: true,
    };
  }

  // Free plan cannot use subagent without BYOK
  if (ctx.shouldDelegate && plan === "free") {
    return {
      providerId: "gemini",
      modelId: "gemini-2.5-flash",
      byok: false,
      blocked: true,
      blockReason: "Para usar SDD, necesitas Vibe Estudiante o Vibe Pro.",
    };
  }

  // Explicit model from client
  if (requestedModelId) {
    return {
      providerId: inferProvider(requestedModelId),
      modelId: requestedModelId,
      byok: false,
    };
  }

  // Pro + high cognitive phase → premium model
  if (plan === "pro" && currentPhase && HIGH_COGNITIVE_PHASES.has(currentPhase)) {
    return {
      providerId: "deepseek",
      modelId: "deepseek-v4-pro",
      byok: false,
    };
  }

  // Default: flash (cheapest available)
  return {
    providerId: "gemini",
    modelId: "gemini-2.5-flash",
    byok: false,
  };
}

/**
 * Infers provider from model ID string.
 */
function inferProvider(modelId?: string): string {
  if (!modelId) return "deepseek";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")) return "openai";
  if (modelId.startsWith("gemini")) return "gemini";
  if (modelId.startsWith("deepseek")) return "deepseek";
  if (modelId.includes("/")) return "openrouter";
  return "deepseek";
}
