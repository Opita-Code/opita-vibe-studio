// ─── Plan Registry ──────────────────────────────────────────────
//
// Single source of truth for plan definitions.
// Add new plans HERE — no shotgun surgery across the codebase.
//
// Usage:
//   import { canAccess, getPlan, requiresTier } from "@/lib/plan-registry";
//   if (canAccess(plan, "sub_agents")) { ... }
//

import type { UserPlan } from "./types";

// ─── Capabilities ───────────────────────────────────────────────

export type Capability =
  // Tier 0 — Everyone
  | "chat"
  | "byok"
  | "preview"
  | "templates"
  // Tier 1 — Estudiante+
  | "cloud_sync"
  | "sdd"
  // Tier 2 — Pro+
  | "sub_agents"
  | "advanced_models"
  | "degraded_mode"
  // Future — Tier 3+
  | "team_sharing"
  | "custom_agents"
  | "priority_queue";

// ─── Plan Config ────────────────────────────────────────────────

export interface PlanConfig {
  readonly id: UserPlan;
  readonly name: string;
  readonly tier: number;
  readonly limits: {
    readonly tokensDaily: number;
    readonly tokensHourly: number;
    readonly storageMB: number;
  };
  readonly capabilities: ReadonlySet<Capability>;
  readonly xpMultiplier: number;
  readonly quotaCap: number;
  readonly quotaDecayFloor: number;
  readonly features: readonly string[]; // Marketing copy for UI
}

// ─── Capability Sets ────────────────────────────────────────────

const TIER_0_CAPS: Capability[] = ["chat", "byok", "preview", "templates"];
const TIER_1_CAPS: Capability[] = [...TIER_0_CAPS, "cloud_sync", "sdd"];
const TIER_2_CAPS: Capability[] = [
  ...TIER_1_CAPS,
  "sub_agents",
  "advanced_models",
  "degraded_mode",
];

// ─── Registry ───────────────────────────────────────────────────

const PLANS: Record<UserPlan, PlanConfig> = {
  free: {
    id: "free",
    name: "Gratis",
    tier: 0,
    limits: { tokensDaily: 150_000, tokensHourly: 30_000, storageMB: 5 },
    capabilities: new Set(TIER_0_CAPS),
    xpMultiplier: 1,
    quotaCap: 300_000,
    quotaDecayFloor: 150_000,
    features: [
      "150K tokens base (gana hasta 300K con misiones)",
      "Misiones diarias para ganar quota",
      "Vista previa en vivo",
      "Editor de código + BYOK",
    ],
  },
  estudiante: {
    id: "estudiante",
    name: "Estudiante",
    tier: 1,
    limits: { tokensDaily: 250_000, tokensHourly: 60_000, storageMB: 50 },
    capabilities: new Set(TIER_1_CAPS),
    xpMultiplier: 1.5,
    quotaCap: 400_000,
    quotaDecayFloor: 250_000,
    features: [
      "250K tokens base (gana hasta 400K con misiones)",
      "XP ×1.5 y misiones avanzadas",
      "Orquestación SDD (V4-Flash)",
      "Sincronización Cloud",
    ],
  },
  pro: {
    id: "pro",
    name: "Vibe Pro",
    tier: 2,
    limits: { tokensDaily: 1_000_000, tokensHourly: 200_000, storageMB: 500 },
    capabilities: new Set(TIER_2_CAPS),
    xpMultiplier: 2,
    quotaCap: 1_000_000,
    quotaDecayFloor: 1_000_000,
    features: [
      "1M tokens diarios",
      "XP ×2 y todas las misiones",
      "Subagentes Autónomos (Edición de código)",
      "Modo degradado (nunca se bloquea)",
    ],
  },
};

// ─── Public API ─────────────────────────────────────────────────

/** Get the full config for a plan. Falls back to "free" for unknown IDs. */
export function getPlan(id: UserPlan): PlanConfig {
  return PLANS[id] ?? PLANS.free;
}

/** Check if a plan has a specific capability. */
export function canAccess(plan: UserPlan, capability: Capability): boolean {
  return getPlan(plan).capabilities.has(capability);
}

/** Check if a plan meets a minimum tier level. */
export function requiresTier(plan: UserPlan, minTier: number): boolean {
  return getPlan(plan).tier >= minTier;
}

// ─── Convenience Re-exports (backward compat) ──────────────────

/** Get plan token/storage limits. */
export function getPlanLimits(
  plan: UserPlan,
): { daily: number; hourly: number } {
  const { tokensDaily, tokensHourly } = getPlan(plan).limits;
  return { daily: tokensDaily, hourly: tokensHourly };
}

/** Get plan storage limit in bytes. */
export function getStorageLimit(plan: UserPlan): number {
  return getPlan(plan).limits.storageMB * 1024 * 1024;
}

/** Get plan display name. */
export function getPlanName(plan: UserPlan): string {
  return getPlan(plan).name;
}

/** Get plan marketing features list. */
export function getPlanFeatures(plan: UserPlan): readonly string[] {
  return getPlan(plan).features;
}

/** Get XP multiplier for plan. */
export function getXpMultiplier(plan: UserPlan): number {
  return getPlan(plan).xpMultiplier;
}

/** Get quota decay floor for plan. */
export function getQuotaDecayFloor(plan: UserPlan): number {
  return getPlan(plan).quotaDecayFloor;
}

/** Get quota cap for plan. */
export function getQuotaCap(plan: UserPlan): number {
  return getPlan(plan).quotaCap;
}

/** All registered plan IDs. */
export function getAllPlanIds(): UserPlan[] {
  return Object.keys(PLANS) as UserPlan[];
}
