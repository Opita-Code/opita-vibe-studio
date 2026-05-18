/**
 * Intent Classifier — Unified intent detection for the agent system.
 *
 * Replaces both `detectCodeRequest()` from pipeline/engine.ts
 * and `detectMode()` from modes/index.ts.
 *
 * Single source of truth for classifying user messages.
 */

import type { IntentClass } from "./types";

// ─── Keywords ───────────────────────────────────────────────────

/**
 * Conversational intent — user wants inline response, NOT filesystem changes.
 * These have HIGHEST priority.
 */
const CHAT_SIGNALS = [
  // Explicit "in the chat"
  "en el chat", "en este chat", "aquí en el chat",
  "escríbelo aquí", "escribelo aqui", "escríbemelo aquí", "escribemelo aqui",
  "ponlo aquí", "ponlo aqui",
  // "Show me" / "teach me" → educational, not filesystem
  "muéstrame", "muestrame", "enséñame", "enseñame",
  "mostrarme", "puedes mostrarme", "podrías mostrarme", "podrias mostrarme",
  "muéstrame cómo", "muestrame como",
  "cómo se ve", "como se ve", "cómo luce", "como luce",
  // Examples
  "dame un ejemplo", "dame ejemplo", "ejemplo de", "ponme un ejemplo",
  // "Write me" without filesystem
  "escríbeme", "escribeme",
  // Educational / hypothetical
  "cómo sería", "como seria", "cómo quedaría", "como quedaria",
  "cómo se haría", "como se haria", "cómo se hace", "como se hace",
  // Concept questions (not file actions)
  "qué es", "que es", "qué son", "que son",
  "para qué sirve", "para que sirve",
  "cuál es la diferencia", "cual es la diferencia",
  "explícame qué", "explicame que", "explícame la", "explicame la",
];

/**
 * Exploration intent — user wants analysis/planning without file changes.
 */
const EXPLORE_SIGNALS = [
  "explícame", "explicame", "explica ",
  "cómo funciona", "como funciona",
  "qué hace", "que hace", "analiza", "revisar", "entender",
  "recorre", "dónde está", "donde esta",
  "arquitectura", "diseño", "plan", "planificar", "estructura",
  "organizar", "diagrama", "decisión", "decision", "trade-off",
  "comparar", "evaluar", "propuesta",
];

/**
 * Code intent — user wants to CREATE, MODIFY, FIX, or TEST code.
 */
const CODE_SIGNALS = [
  // Create
  "crear", "hacer", "generar", "implementar",
  "nuevo", "nueva", "componente", "página", "pagina",
  "construir", "desarrollar", "armar", "montar", "añadir", "agregar",
  // Modify (previously in detectCodeRequest but missing here)
  "modificar", "cambiar", "diseñar",
  // Fix
  "bug", "error", "falla", "no funciona", "no sirve", "se rompe",
  "arreglar", "corregir", "fix", "depurar", "debug", "rompe",
  "crashea", "problema", "issue",
  // Optimize
  "mejorar", "optimizar", "rendimiento", "lento",
  "refactorizar", "refactor", "limpiar", "simplificar",
  "performance", "rápido", "eficiente", "reducir", "consolidar",
  // Test
  "test", "tests", "prueba", "pruebas", "coverage", "cobertura",
  "testear", "validar", "unitario", "integración", "e2e",
];

/**
 * Pure question patterns — these lean toward chat, not code.
 */
const QUESTION_PATTERNS = [
  "qué es", "que es", "cómo funciona", "como funciona",
  "explíca", "explica", "por qué", "por que",
  "cuál es", "cual es", "qué hace", "que hace",
  "dónde", "donde", "cuándo", "cuando",
];

// ─── Classifier ─────────────────────────────────────────────────

/**
 * Classifies a user message into one of three intents:
 * - `"chat"`: conversational — respond inline, no file changes
 * - `"code"`: action-oriented — create/modify/fix files
 * - `"explore"`: analysis — read files, plan, propose
 *
 * Priority: chat signals > question patterns > explore signals > code signals > default
 *
 * @param text - The user's message
 * @param hasProjectOpen - Whether a project is currently open in the editor
 * @returns The classified intent
 */
export function classifyIntent(
  text: string,
  hasProjectOpen: boolean
): IntentClass {
  const lower = text.toLowerCase().trim();

  // Very short messages are always chat
  if (lower.length < 10) return "chat";

  // 1. Conversational intent — highest priority
  if (CHAT_SIGNALS.some((s) => lower.includes(s))) return "chat";

  // 2. Question patterns without project → chat
  if (QUESTION_PATTERNS.some((q) => lower.includes(q))) {
    // If there's a project open, questions about code lean toward explore
    return hasProjectOpen ? "explore" : "chat";
  }

  // 3. Without a project, everything is chat
  if (!hasProjectOpen) return "chat";

  // 4. Explore signals (analysis, planning)
  if (EXPLORE_SIGNALS.some((s) => lower.includes(s))) return "explore";

  // 5. Code signals (create, modify, fix)
  if (CODE_SIGNALS.some((s) => lower.includes(s))) return "code";

  // 6. Default with project open: chat (require explicit code signals)
  return "chat";
}

// ─── Exports for testing ────────────────────────────────────────

export const _testOnly = {
  CHAT_SIGNALS,
  EXPLORE_SIGNALS,
  CODE_SIGNALS,
  QUESTION_PATTERNS,
};
