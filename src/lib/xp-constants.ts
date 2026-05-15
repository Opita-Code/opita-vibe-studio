// ─── Gamification Constants ─────────────────────────────────────
//
// XP values, level formula, milestones, and quota rewards.
// Shared between frontend and backend (isomorphic).
//

// ─── XP Awards ──────────────────────────────────────────────────

export const XP_ACTIONS = {
  chat_message: 5,
  template_use: 25,
  project_create: 50,
  feature_explore: 10,
  daily_login: 15,
  mission_complete_novato: 100,
  mission_complete_intermedio: 200,
  mission_complete_avanzado: 350,
  streak_3_bonus: 50,
  streak_7_bonus: 150,
  streak_14_bonus: 300,
  streak_30_bonus: 500,
} as const;

// ─── Plan Multipliers ───────────────────────────────────────────

export const PLAN_MULTIPLIERS = {
  free: 1,
  estudiante: 1.5,
  pro: 2,
} as const;

// ─── Quota Rewards (permanent daily quota increase) ─────────────
// Completing missions permanently raises the user's daily token limit.
// This is the PRIMARY reward — drives retention and monetization bridge.

export const QUOTA_REWARDS = {
  /** Quota bonus per mission completion (added to daily limit) */
  mission_novato: 5_000,
  mission_intermedio: 10_000,
  mission_avanzado: 15_000,
  /** Streak bonuses (one-time per streak milestone) */
  streak_3: 10_000,
  streak_7: 25_000,
  streak_14: 40_000,
  streak_30: 75_000,
} as const;

/** Maximum earned quota for free users (generous ceiling) */
export const FREE_QUOTA_CAP = 300_000;

/** Maximum earned quota for estudiante users */
export const ESTUDIANTE_QUOTA_CAP = 400_000;

/** Pro users don't need quota rewards — already at 1M */
export const PRO_QUOTA_CAP = 1_000_000;

/**
 * Quota decay rate per day of inactivity.
 * After missing a day, earned quota decays by this percentage.
 * Creates urgency to return daily (retention loop).
 * Example: 300K earned → miss 1 day → 270K (lost 30K)
 */
export const QUOTA_DECAY_RATE = 0.10;

/**
 * Minimum quota floor — earned quota never decays below base plan limit.
 * Even after prolonged inactivity, you keep your plan's base quota.
 */
export const QUOTA_DECAY_FLOOR = {
  free: 150_000,
  estudiante: 250_000,
  pro: 1_000_000,
} as const;

// ─── Leveling ───────────────────────────────────────────────────

/**
 * Level formula: level = floor(sqrt(totalXp / 100))
 * Level 1 = 100 XP, Level 5 = 2,500 XP, Level 10 = 10,000 XP
 * Level 25 = 62,500 XP, Level 50 = 250,000 XP
 */
export function calculateLevel(totalXp: number): number {
  return Math.floor(Math.sqrt(totalXp / 100));
}

/**
 * XP needed to reach a specific level.
 */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/**
 * Progress percentage towards next level (0-100).
 */
export function levelProgress(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const range = nextLevelXp - currentLevelXp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((totalXp - currentLevelXp) / range) * 100));
}

/**
 * XP remaining to reach next level.
 */
export function xpToNextLevel(totalXp: number): number {
  const currentLevel = calculateLevel(totalXp);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return Math.max(0, nextLevelXp - totalXp);
}

// ─── Milestones ─────────────────────────────────────────────────

export interface Milestone {
  level: number;
  badge: string;
  label: string;
  reward: {
    type: "quota_boost" | "badge";
    value: number;
  };
}

export const MILESTONES: Milestone[] = [
  { level: 3,  badge: "🌱", label: "Semilla",      reward: { type: "quota_boost", value: 20_000 } },
  { level: 5,  badge: "🔍", label: "Explorador",    reward: { type: "quota_boost", value: 30_000 } },
  { level: 10, badge: "🔨", label: "Constructor",   reward: { type: "quota_boost", value: 50_000 } },
  { level: 15, badge: "⚡", label: "Veloz",         reward: { type: "quota_boost", value: 40_000 } },
  { level: 25, badge: "🏗️", label: "Arquitecto",    reward: { type: "quota_boost", value: 60_000 } },
  { level: 50, badge: "👑", label: "Maestro",       reward: { type: "quota_boost", value: 100_000 } },
];

// ─── Mission Types ──────────────────────────────────────────────

export type MissionType = "aprender" | "construir" | "explorar";
export type MissionDifficulty = "novato" | "intermedio" | "avanzado";

export const MISSIONS_PER_DAY = 3;

/**
 * Difficulty progression based on user level.
 */
export function getDifficulty(level: number): MissionDifficulty {
  if (level < 5) return "novato";
  if (level < 15) return "intermedio";
  return "avanzado";
}

// ─── Streak ─────────────────────────────────────────────────────

export const STREAK_MILESTONES = [3, 7, 14, 30] as const;

/**
 * Calculate streak XP multiplier (for display purposes).
 * 3+ days: 1.5x, 7+ days: 2x
 */
export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 7) return 2;
  if (streakDays >= 3) return 1.5;
  return 1;
}

/**
 * Apply quota decay for days of inactivity.
 * Returns the decayed earned quota.
 */
export function applyQuotaDecay(
  earnedQuota: number,
  daysInactive: number,
  planFloor: number,
): number {
  if (daysInactive <= 0) return earnedQuota;
  const decayed = earnedQuota * Math.pow(1 - QUOTA_DECAY_RATE, daysInactive);
  return Math.max(planFloor, Math.round(decayed));
}
