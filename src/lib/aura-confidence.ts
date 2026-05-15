/**
 * Aura Confidence System — Autonomía inteligente del agente.
 *
 * Calcula un score de confianza (0-100) basado en señales client-side
 * para determinar si Aura debe ejecutar autónomamente, advertir, o pausar.
 *
 * Basado en threshold-based logic + progress monitoring + blast-radius escalation
 * (estándares de la industria 2026).
 *
 * 100% client-side. 0 tokens LLM.
 */

// ─── Types ─────────────────────────────────────────────────────

export interface ConfidenceState {
  /** Puntuación de confianza actual (0-100) */
  score: number;
  /** Categoría del score */
  level: "high" | "medium" | "low";
  /** Razón del score actual */
  reason: string;
  /** Si el agente debería continuar autónomamente */
  shouldContinue: boolean;
  /** Si debe preguntar al usuario antes de continuar */
  shouldAsk: boolean;
}

export interface ConfidenceContext {
  /** Texto del mensaje del usuario */
  input: string;
  /** Si hay un proyecto abierto */
  hasProject: boolean;
  /** Si el mensaje menciona archivos específicos */
  hasFileContext: boolean;
  /** Si es una intención explícita ("Crea X en Y") */
  hasExplicitIntent: boolean;
  /** Si el pedido es vago ("hazlo", "arréglalo") */
  isVague: boolean;
  /** Si el pedido es ambiguo (múltiples interpretaciones) */
  isAmbiguous: boolean;
  /** Si los archivos afectados son críticos (config, package.json, etc.) */
  touchesCriticalFiles: boolean;
  /** Ratio de tokens usados (0-1) */
  contextRatio: number;
  /** Pasos completados en la cadena actual */
  stepsCompleted: number;
  /** Máximo de pasos permitidos */
  maxSteps: number;
  /** Errores consecutivos en la cadena */
  consecutiveErrors: number;
  /** Si la última herramienta se llamó con los mismos args */
  sameToolCalledTwice: boolean;
  /** Si la respuesta del modelo contiene una pregunta */
  modelAskedQuestion: boolean;
}

// ─── Constants ─────────────────────────────────────────────────

/** Máximo de pasos en una cadena autónoma */
export const MAX_CHAIN_STEPS = 10;

/** Tokens mínimos para seguir encadenando */
export const MIN_TOKENS_TO_CONTINUE = 2000;

/** Máximo de errores consecutivos antes de parar */
export const MAX_CONSECUTIVE_ERRORS = 2;

// ─── Patterns ──────────────────────────────────────────────────

const VAGUE_PATTERNS = /^(?:hazlo|arréglalo|cámbialo|modifícalo|corrígelo|mejóralo|optimízalo)\s*$/i;
const AMBIGUOUS_PATTERNS = /(?:algo|alguna cosa|lo que sea|como quieras|tú decides|decide tú)/i;
const CRITICAL_FILES = /(?:package\.json|tsconfig|\.env|config\.|webpack|vite\.config|next\.config|prisma|migration|dockerfile)/i;
const FILE_REFERENCE = /(?:\.tsx?|\.jsx?|\.css|\.html|\.json|\.md|\.yml|\.yaml|src\/|components\/|lib\/|pages\/)/i;
const EXPLICIT_INTENT = /(?:crea|genera|implementa|escribe|agrega|añade|modifica|cambia|corrige|arregla|refactoriza)\s+(?:un|una|el|la|los|las)\s+\w+/i;
const QUESTION_PATTERN = /(?:\?|¿|quieres que|te parece|preferirías|prefieres|estás seguro|necesito que confirmes)/i;

// ─── Calculator ────────────────────────────────────────────────

/**
 * Calcula el score de confianza basado en señales del contexto.
 * Score 80-100 → ejecutar autónomamente
 * Score 50-79  → ejecutar pero avisar
 * Score <50    → pausar y preguntar
 */
export function calculateConfidence(ctx: ConfidenceContext): ConfidenceState {
  let score = 70; // Base: confianza moderada
  let dominantReason = "Base";
  let dominantImpact = 0;

  function track(delta: number, reason: string) {
    score += delta;
    if (Math.abs(delta) > dominantImpact) {
      dominantImpact = Math.abs(delta);
      dominantReason = reason;
    }
  }

  // ── Señales positivas ──
  if (ctx.hasProject) track(10, "Proyecto abierto");
  if (ctx.hasExplicitIntent) track(15, "Intención explícita");
  if (ctx.hasFileContext) track(5, "Contexto de archivos");

  // ── Señales negativas ──
  if (ctx.isVague) track(-30, "Pedido vago — necesita más contexto");
  if (ctx.isAmbiguous) track(-20, "Pedido ambiguo — múltiples interpretaciones");
  if (ctx.touchesCriticalFiles) track(-15, "Toca archivos críticos — requiere revisión");
  if (ctx.contextRatio > 0.8) track(-25, "Contexto casi lleno — riesgo de degradación");

  // ── Guardrails duros ──
  if (ctx.stepsCompleted >= ctx.maxSteps) {
    return {
      score: 0,
      level: "low",
      reason: `Límite de ${ctx.maxSteps} pasos alcanzado`,
      shouldContinue: false,
      shouldAsk: true,
    };
  }
  if (ctx.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    return {
      score: 0,
      level: "low",
      reason: `${ctx.consecutiveErrors} errores consecutivos — posible loop`,
      shouldContinue: false,
      shouldAsk: true,
    };
  }
  if (ctx.sameToolCalledTwice) {
    track(-40, "Misma herramienta con mismos args — posible loop");
  }
  if (ctx.modelAskedQuestion) {
    return {
      score: 0,
      level: "low",
      reason: "El modelo necesita aclaración del usuario",
      shouldContinue: false,
      shouldAsk: true,
    };
  }

  // ── Clamp ──
  score = Math.max(0, Math.min(100, score));

  // ── Categorizar ──
  const level = score >= 80 ? "high" : score >= 50 ? "medium" : "low";

  return {
    score,
    level,
    reason: dominantReason,
    shouldContinue: score >= 50,
    shouldAsk: score < 50,
  };
}

// ─── Context Builder ───────────────────────────────────────────

/**
 * Construye el contexto de confianza a partir del estado de la app.
 */
export function buildConfidenceContext(
  input: string,
  opts: {
    hasProject: boolean;
    contextRatio: number;
    stepsCompleted: number;
    maxSteps?: number;
    consecutiveErrors?: number;
    sameToolCalledTwice?: boolean;
    lastModelResponse?: string;
  },
): ConfidenceContext {
  return {
    input,
    hasProject: opts.hasProject,
    hasFileContext: FILE_REFERENCE.test(input),
    hasExplicitIntent: EXPLICIT_INTENT.test(input),
    isVague: VAGUE_PATTERNS.test(input.trim()),
    isAmbiguous: AMBIGUOUS_PATTERNS.test(input),
    touchesCriticalFiles: CRITICAL_FILES.test(input),
    contextRatio: opts.contextRatio,
    stepsCompleted: opts.stepsCompleted,
    maxSteps: opts.maxSteps ?? MAX_CHAIN_STEPS,
    consecutiveErrors: opts.consecutiveErrors ?? 0,
    sameToolCalledTwice: opts.sameToolCalledTwice ?? false,
    modelAskedQuestion: opts.lastModelResponse
      ? QUESTION_PATTERN.test(opts.lastModelResponse)
      : false,
  };
}
