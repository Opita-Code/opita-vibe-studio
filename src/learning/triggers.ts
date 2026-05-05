import { useLearningStore } from "@/stores/learning";
import { TIP_DICTIONARY, getTipByTrigger, getTipsByTag } from "@/lib/tips";

// ─── Constants ─────────────────────────────────────────────────

/**
 * Umbral mínimo entre tips para evitar saturar al usuario.
 * Máximo 1 tip cada 5 minutos.
 */
const THROTTLE_MS = 5 * 60 * 1000;

// ─── Tipos ─────────────────────────────────────────────────────

export interface CodePattern {
  /** Nombre del patrón (ej: "js-var", "css-flexbox") */
  id: string;
  /** Expresión regular para detectar el patrón en el código */
  regex: RegExp;
  /** Concepto asociado (para lookup de tips por concepto si no hay triggerEvent directo) */
  concept?: string;
  /** Etiquetas adicionales para búsqueda */
  tags?: string[];
}

// ─── Patrones de código → tips ─────────────────────────────────

/**
 * Catálogo de patrones de código que disparan tips.
 * Cada patrón tiene una regex que busca en el código generado o escrito por el usuario.
 */
export const CODE_PATTERNS: CodePattern[] = [
  // ── CSS patterns (more specific first to avoid JS object pattern conflicts) ─
  { id: "css-flexbox", regex: /display:\s*flex/g, tags: ["flexbox"] },
  { id: "css-grid", regex: /display:\s*grid/g, tags: ["grid"] },
  {
    id: "css-inline-style",
    regex: /style\s*=\s*['"]/g,
    concept: "selectores",
    tags: ["css"],
  },
  {
    id: "css-layout",
    regex: /display:\s*(block|inline|inline-block)/g,
    tags: ["flexbox", "grid"],
  },

  // ── HTML ─
  { id: "html-div", regex: /<div[^>]*>/g, tags: ["html"] },
  { id: "html-input", regex: /<input[^>]*>/g, tags: ["html"] },

  // ── Git / npm ─
  { id: "git-commit", regex: /\bgit\s+commit\b/g, tags: ["git"] },
  { id: "git-branch", regex: /\bgit\s+branch\b/g, tags: ["git"] },
  { id: "npm-run", regex: /\bnpm\s+run\b/g, tags: ["npm"] },
  { id: "npm-install", regex: /\bnpm\s+install\b/g, tags: ["npm"] },

  // ── Variables ─
  { id: "js-var", regex: /\bvar\s+\w+\s*=/g, tags: ["variables"] },
  { id: "js-let", regex: /\blet\s+\w+\s*=/g, tags: ["variables"] },

  // ── Funciones ─
  { id: "js-function", regex: /\bfunction\s+\w+\s*\(/g, tags: ["funciones"] },
  { id: "js-arrow", regex: /=>\s*{/g, tags: ["funciones"] },

  // ── Arrays ─
  { id: "js-for-loop", regex: /\bfor\s*\(/g, tags: ["arrays"] },
  { id: "js-array", regex: /\.(push|pop|shift|unshift|splice)\(/g, tags: ["arrays"] },

  // ── Objetos ─ (more specific: requires `=` or `return`/`const` before `{`)
  { id: "js-object", regex: /(const|let|return)\s*\{/g, tags: ["objetos"] },
  { id: "js-destructure", regex: /(const|let)\s*\{[^}]+\}\s*=\s*/g, tags: ["objetos"] },
  { id: "js-concat", regex: /['"`]\s*\+/g, tags: ["strings"] },

  // ── Async ─
  { id: "js-then", regex: /\.then\s*\(/g, tags: ["async"] },
  { id: "js-async", regex: /\basync\s+(function\s+)?\(/g, tags: ["async"] },

  // ── Debugging ─
  { id: "js-console-log", regex: /console\.log\s*\(/g, tags: ["debugging"] },

  // ── Eventos ─
  { id: "js-event-listener", regex: /\.addEventListener\s*\(/g, tags: ["eventos"] },
  {
    id: "js-form-submit",
    regex: /\.addEventListener\s*\(\s*['"]submit['"]/g,
    tags: ["eventos"],
  },
  { id: "js-innerhtml", regex: /\.innerHTML\s*=/g, tags: ["dom"] },
  {
    id: "js-dom-append",
    regex: /\.(appendChild|append|insertAdjacentHTML)\s*\(/g,
    tags: ["dom"],
  },
];

// ─── Estado de throttling ──────────────────────────────────────

let lastTipTimestamp = 0;

/**
 * Escanea un texto en busca de patrones conocidos y dispara tips.
 * @param text - Texto a escanear (puede ser código generado, contenido de archivo, etc.)
 * @returns Cantidad de tips disparados
 */
export function scanAndTrigger(text: string): number {
  const now = Date.now();

  // Throttle: máximo 1 tip cada 5 minutos
  if (now - lastTipTimestamp < THROTTLE_MS) {
    return 0;
  }

  const store = useLearningStore.getState();
  const shownSet = new Set(store.shownTips);

  // Buscar patrones que coincidan
  const matchedTags = new Set<string>();

  for (const pattern of CODE_PATTERNS) {
    pattern.regex.lastIndex = 0; // Resetear estado de la regex
    if (pattern.regex.test(text)) {
      // Intentar primero por triggerEvent directo
      const tipByTrigger = getTipByTrigger(pattern.id);
      if (tipByTrigger && !shownSet.has(tipByTrigger.id)) {
        store.pushTip(tipByTrigger);
        lastTipTimestamp = now;

        // Marcar TODOS los tips del mismo concepto como vistos
        // para evitar mostrar otro tip del mismo concepto después
        markAllConceptTipsShown(tipByTrigger.concept, store);

        // Registrar el evento de aprendizaje
        store.addEvent({
          type: "trigger_match",
          concept: tipByTrigger.concept,
          timestamp: now,
        });

        return 1;
      }

      // Si no hay tip directo, recolectar tags para búsqueda
      if (pattern.tags) {
        pattern.tags.forEach((t) => matchedTags.add(t));
      }
      if (pattern.concept) {
        matchedTags.add(pattern.concept);
      }
    }
  }

  // Si no se encontró un tip directo, buscar por tags
  if (matchedTags.size > 0) {
    const tagsToCheck = Array.from(matchedTags);
    for (const tag of tagsToCheck) {
      const tips = getTipsByTag(tag);
      const unseen = tips.filter((t) => !shownSet.has(t.id));
      if (unseen.length > 0) {
        const tip = unseen[0];
        store.pushTip(tip);
        lastTipTimestamp = now;

        // Marcar TODOS los tips del mismo concepto como vistos
        markAllConceptTipsShown(tip.concept, store);

        store.addEvent({
          type: "trigger_match",
          concept: tag,
          timestamp: now,
        });

        return 1;
      }
    }
  }

  return 0;
}

/**
 * Marca todos los tips del mismo concepto como ya mostrados.
 * Esto evita que se muestren tips diferentes para el mismo concepto
 * cuando el usuario ya ha visto uno.
 */
function markAllConceptTipsShown(
  concept: string,
  store: ReturnType<typeof useLearningStore.getState>,
): void {
  for (const tip of TIP_DICTIONARY) {
    if (tip.concept === concept) {
      store.markTipShown(tip.id);
    }
  }
}

/**
 * Resetea el throttle (útil en tests).
 */
export function resetThrottle(): void {
  lastTipTimestamp = 0;
}

/**
 * Detecta si un fragmento de texto se repite 3+ veces (para sugerir funciones).
 * @param code - Código completo a analizar
 * @returns true si hay repetición significativa
 */
export function detectRepeatedCode(code: string): boolean {
  const lines = code.split("\n").filter((l) => l.trim().length > 10);
  const counts = new Map<string, number>();

  for (let i = 0; i <= lines.length - 3; i++) {
    const block = lines.slice(i, i + 3).join("\n");
    counts.set(block, (counts.get(block) ?? 0) + 1);
  }

  for (const count of counts.values()) {
    if (count >= 3) return true;
  }

  return false;
}
