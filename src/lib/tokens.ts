import type { TokenUsage, UserPlan } from "./types";

// ─── Plan Limits (tokens por ventana temporal) ──────────────────

export const PLAN_LIMITS: Record<UserPlan, { daily: number; hourly: number }> = {
  free:       { daily: 150_000,   hourly: 30_000 },
  estudiante: { daily: 250_000,   hourly: 60_000 },
  pro:        { daily: 1_000_000, hourly: 200_000 },
};

// ─── Storage Limits (Bytes) ──────────────────────────────────────

export const STORAGE_LIMITS: Record<UserPlan, number> = {
  free:        5 * 1024 * 1024,   // 5MB
  estudiante: 50 * 1024 * 1024,   // 50MB
  pro:       500 * 1024 * 1024,   // 500MB
};

export const PLAN_NAMES: Record<UserPlan, string> = {
  free: "Gratis",
  estudiante: "Estudiante",
  pro: "Vibe Pro",
};

export const PLAN_FEATURES: Record<UserPlan, string[]> = {
  free: [
    "150K tokens base (gana hasta 300K con misiones)",
    "Misiones diarias para ganar quota",
    "Vista previa en vivo",
    "Editor de código + BYOK",
  ],
  estudiante: [
    "250K tokens base (gana hasta 400K con misiones)",
    "XP ×1.5 y misiones avanzadas",
    "Orquestación SDD (V4-Flash)",
    "Sincronización Cloud",
  ],
  pro: [
    "1M tokens diarios",
    "XP ×2 y todas las misiones",
    "Subagentes Autónomos (Edición de código)",
    "Modo degradado (nunca se bloquea)",
  ],
};

// ─── Token Formatting ───────────────────────────────────────────

/**
 * Formatea un número de tokens para display humano.
 * 150000 → "150K", 1000000 → "1M", 45230 → "45.2K"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const val = tokens / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const val = tokens / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return tokens.toString();
}

// ─── Token Usage Helpers ────────────────────────────────────────

/**
 * Calcula cuántos tokens le quedan al usuario hoy.
 */
export function getRemainingTokens(usage: TokenUsage): number {
  return Math.max(0, usage.tokensLimitDaily - usage.tokensUsedToday);
}

/**
 * Verifica si el usuario alcanzó el límite diario.
 */
export function isLimitReached(usage: TokenUsage): boolean {
  return usage.tokensUsedToday >= usage.tokensLimitDaily;
}

/**
 * Verifica si el usuario alcanzó el límite horario.
 */
export function isHourlyLimitReached(usage: TokenUsage): boolean {
  return usage.tokensUsedThisHour >= usage.tokensLimitHourly;
}

/**
 * Retorna el porcentaje de uso diario (0-100).
 */
export function getUsagePercent(usage: TokenUsage): number {
  if (usage.tokensLimitDaily <= 0) return 100;
  return Math.min(100, Math.round((usage.tokensUsedToday / usage.tokensLimitDaily) * 100));
}

/**
 * Retorna el porcentaje de uso horario (0-100).
 */
export function getHourlyUsagePercent(usage: TokenUsage): number {
  if (usage.tokensLimitHourly <= 0) return 100;
  return Math.min(100, Math.round((usage.tokensUsedThisHour / usage.tokensLimitHourly) * 100));
}

/**
 * Formatea una fecha ISO como "5 de mayo" (en español).
 */
export function formatRenewalDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = date.getUTCDate();
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${day} de ${months[date.getUTCMonth()]}`;
}

/**
 * Calcula los minutos restantes hasta el reset horario.
 */
export function getMinutesUntilHourlyReset(isoDate: string): number {
  const now = Date.now();
  const end = new Date(isoDate).getTime();
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60)));
}

/**
 * Calcula las horas restantes hasta el reset diario.
 */
export function getHoursUntilDailyReset(isoDate: string): number {
  const now = Date.now();
  const end = new Date(isoDate).getTime();
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60)));
}
