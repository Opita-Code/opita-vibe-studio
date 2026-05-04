import type { TokenUsage, UserPlan } from "./types";

// ─── Plan Limits ────────────────────────────────────────────────

export const PLAN_LIMITS: Record<UserPlan, number> = {
  free: 30,
  estudiante: 200,
  creador: 500,
  pro: 2000,
  universidad: 2000,
};

export const PLAN_NAMES: Record<UserPlan, string> = {
  free: "Gratis",
  estudiante: "Estudiante",
  creador: "Creador",
  pro: "Pro",
  universidad: "Universidad",
};

export const PLAN_FEATURES: Record<UserPlan, string[]> = {
  free: [
    "30 prompts por mes",
    "Modelos gratuitos (DeepSeek, Gemini)",
    "Vista previa en vivo",
    "Editor de código",
  ],
  estudiante: [
    "200 prompts por mes",
    "BYOK: usá tu propia API key",
    "Vista previa en vivo",
    "Editor de código",
    "Verificación de estudiante requerida",
  ],
  creador: [
    "500 prompts por mes",
    "BYOK: usá tu propia API key",
    "Modelos premium (GPT-4o, Claude)",
    "Vista previa en vivo",
    "Soporte prioritario",
  ],
  pro: [
    "2000 prompts por mes",
    "BYOK: usá tu propia API key",
    "Todos los modelos disponibles",
    "Vista previa en vivo",
    "Soporte prioritario 24/7",
    "Acceso anticipado a nuevas funciones",
  ],
  universidad: [
    "2000 prompts por mes",
    "BYOK: usá tu propia API key",
    "Todos los modelos disponibles",
    "Gestión de múltiples estudiantes",
    "Panel de administración",
    "Soporte dedicado",
  ],
};

// ─── Token Estimation ───────────────────────────────────────────

/**
 * Estima tokens a partir de texto usando la regla chars/4.
 * Es una aproximación — todos los providers del MVP usan
 * esta misma fórmula salvo que tengan un tokenizador real.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Token Usage Helpers ────────────────────────────────────────

/**
 * Calcula cuántos prompts le quedan al usuario este período.
 */
export function getRemainingPrompts(usage: TokenUsage): number {
  return Math.max(0, usage.promptsLimit - usage.promptsUsed);
}

/**
 * Verifica si el usuario alcanzó el límite mensual de prompts.
 */
export function isLimitReached(usage: TokenUsage): boolean {
  return usage.promptsUsed >= usage.promptsLimit;
}

/**
 * Retorna el porcentaje de uso (0-100).
 */
export function getUsagePercent(usage: TokenUsage): number {
  if (usage.promptsLimit <= 0) return 100;
  return Math.min(100, Math.round((usage.promptsUsed / usage.promptsLimit) * 100));
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
 * Calcula los días restantes hasta la renovación.
 */
export function getDaysUntilRenewal(isoDate: string): number {
  const now = Date.now();
  const end = new Date(isoDate).getTime();
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
