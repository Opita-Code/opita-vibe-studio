/**
 * Model Router — Intelligent model selection by plan tier.
 *
 * Pure function that decides which AI provider and model to use
 * based on: user plan, action type, SDD phase, and availability.
 *
 * This module has ZERO side effects — no AWS, no env vars reading.
 * The caller passes availability flags.
 */

import { canAccess, requiresTier } from "@/lib/plan-registry";

// ─── Types ─────────────────────────────────────────────────────

export interface ModelRouterInput {
  /** User plan tier */
  plan: "free" | "estudiante" | "pro";
  /** Request action */
  /** Request action: chat, build (basic code), subagent (SDD phases), save_key */
  action: "chat" | "build" | "subagent" | "save_key";
  /** SDD subagent phase (when action === "subagent") */
  subagentId?: string;
  /** Explicit model ID from client */
  modelId?: string;
  /** Custom API key (BYOK) */
  customApiKey?: string;
  /** Pro user over quota — forced to cheaper model */
  degraded: boolean;
  /** Whether Google AI Studio key is available on backend */
  hasGoogleAI: boolean;
  /** Whether DeepSeek key is available on backend */
  hasDeepSeek: boolean;
}

export interface ModelSelection {
  providerId: string;
  modelId: string;
  /** True if using user's own API key */
  byok: boolean;
  /** True if the request should be blocked (plan restriction) */
  blocked?: boolean;
  /** Reason for blocking */
  blockReason?: string;
}

// ─── Constants ─────────────────────────────────────────────────

/** SDD phases that require deeper reasoning (premium models for Pro) */
const HIGH_COGNITIVE_PHASES = new Set([
  "sdd-explore",
  "sdd-propose",
  "sdd-design",
  "sdd-verify",
]);

/** Default fallback when nothing else is available */
const FALLBACK: Pick<ModelSelection, "providerId" | "modelId"> = {
  providerId: "deepseek",
  modelId: "deepseek-chat",
};

// ─── Router ────────────────────────────────────────────────────

/**
 * Selects the optimal AI provider and model for a request.
 *
 * Routing table:
 * ┌─────────────┬──────────────────────────┬────────────────────────┐
 * │ Plan        │ Chat / Build / Mech. SDD │ High-Cognitive SDD     │
 * ├─────────────┼──────────────────────────┼────────────────────────┤
 * │ Free        │ gemini-2.5-flash         │ BLOCKED (subagent only)│
 * │ Estudiante  │ gemini-2.5-flash         │ gemini-2.5-flash       │
 * │ Pro         │ gemini-2.5-flash         │ deepseek-v4-pro        │
 * │ Pro degraded│ gemini-2.5-flash         │ gemini-2.5-flash       │
 * │ BYOK (any)  │ user's choice            │ user's choice          │
 * └─────────────┴──────────────────────────┴────────────────────────┘
 */
export function selectModel(input: ModelRouterInput): ModelSelection {
  const { plan, action, subagentId, modelId, customApiKey, degraded, hasGoogleAI, hasDeepSeek } = input;

  // ─── BYOK: User's own key → respect their model choice ────
  if (customApiKey && customApiKey !== "aws-managed") {
    return {
      providerId: inferProvider(modelId),
      modelId: modelId || "deepseek-chat",
      byok: true,
    };
  }

  // ─── Plan restriction: Free cannot use subagent (without BYOK) ──
  if (action === "subagent" && !requiresTier(plan, 1)) {
    return {
      ...FALLBACK,
      byok: false,
      blocked: true,
      blockReason: "Para usar la orquestación SDD, necesitas Vibe Estudiante o Vibe Pro. upgrade tu plan para continuar.",
    };
  }

  // ─── Explicit modelId from client (non-BYOK) ──────────────
  if (modelId && customApiKey !== "aws-managed") {
    return {
      providerId: inferProvider(modelId),
      modelId,
      byok: false,
    };
  }

  // ─── Degraded Pro: always cheapest available ───────────────
  if (degraded) {
    return {
      ...pickFlash(hasGoogleAI, hasDeepSeek),
      byok: false,
    };
  }

  // ─── Subagent routing by plan and phase ────────────────────
  if (action === "subagent" && subagentId) {
    const isHighCognitive = HIGH_COGNITIVE_PHASES.has(subagentId);

    if (canAccess(plan, "advanced_models") && isHighCognitive) {
      // Pro + high cognitive → premium model
      return {
        providerId: "deepseek",
        modelId: "deepseek-v4-pro",
        byok: false,
      };
    }

    // Everything else (estudiante, pro mechanical) → flash
    return {
      ...pickFlash(hasGoogleAI, hasDeepSeek),
      byok: false,
    };
  }

  // ─── Default chat routing ──────────────────────────────────
  return {
    ...pickFlash(hasGoogleAI, hasDeepSeek),
    byok: false,
  };
}

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Picks the best available "flash" (cheap) model.
 * Prefers Google AI Studio (free tier) over DeepSeek.
 */
function pickFlash(
  hasGoogleAI: boolean,
  hasDeepSeek: boolean
): Pick<ModelSelection, "providerId" | "modelId"> {
  if (hasGoogleAI) {
    return { providerId: "gemini", modelId: "gemini-2.5-flash" };
  }
  if (hasDeepSeek) {
    return { providerId: "deepseek", modelId: "deepseek-v4-flash" };
  }
  return FALLBACK;
}

/**
 * Infers the provider from a model ID string.
 */
function inferProvider(modelId?: string): string {
  if (!modelId) return "deepseek";
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")) return "openai";
  if (modelId.startsWith("gemini")) return "gemini";
  if (modelId.startsWith("deepseek")) return "deepseek";
  if (modelId.includes("/")) return "openrouter"; // e.g. "google/gemini-2.5-flash"
  return "deepseek";
}
