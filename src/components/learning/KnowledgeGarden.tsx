import { useMemo, useState } from "react";
import { useLearningStore } from "@/stores/learning";
import { TIP_DICTIONARY } from "@/lib/tips";

// ─── Constants ─────────────────────────────────────────────────

/**
 * Estados de aprendizaje para cada concepto.
 * - locked: no se ha visto ningún tip de este concepto
 * - sprout: se ha visto al menos un tip
 * - mastered: se han visto 3+ eventos de aprendizaje del concepto
 */
export type ConceptState = "locked" | "sprout" | "mastered";

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Obtiene todos los conceptos únicos del diccionario de tips.
 */
function getAllConcepts(): string[] {
  const concepts = new Set<string>();
  for (const tip of TIP_DICTIONARY) {
    concepts.add(tip.concept);
  }
  return Array.from(concepts).sort();
}

/**
 * Determina el estado de un concepto basado en los tips mostrados y eventos.
 */
function getConceptState(
  concept: string,
  shownTipIds: string[],
  learningEvents: Array<{ concept: string }>,
): ConceptState {
  // Contar eventos de aprendizaje para este concepto
  const eventCount = learningEvents.filter((e) => e.concept === concept).length;

  // Contar tips mostrados de este concepto
  const shownCount = TIP_DICTIONARY.filter(
    (tip) => tip.concept === concept && shownTipIds.includes(tip.id),
  ).length;

  if (eventCount >= 3 || shownCount >= 3) return "mastered";
  if (shownCount >= 1) return "sprout";
  return "locked";
}

/**
 * Emoji según el estado del concepto.
 */
function conceptEmoji(state: ConceptState): string {
  switch (state) {
    case "locked":
      return "🌱";
    case "sprout":
      return "🌿";
    case "mastered":
      return "🌳";
  }
}

// ─── Component ─────────────────────────────────────────────────

interface KnowledgeGardenProps {
  /** `true` para mostrar el jardín, `false` para ocultarlo */
  isOpen: boolean;
  /** Callback para cerrar el jardín */
  onClose: () => void;
}

/**
 * Jardín de conocimiento — muestra una cuadrícula de conceptos
 * con su estado de aprendizaje.
 *
 * Cada concepto es una "planta":
 * - 🌱 Semilla: no explorado todavía
 * - 🌿 Brote: ya viste al menos un tip
 * - 🌳 Árbol: dominás el concepto (3+ eventos)
 */
export function KnowledgeGarden({ isOpen, onClose }: KnowledgeGardenProps) {
  const shownTips = useLearningStore((s) => s.shownTips);
  const learningEvents = useLearningStore((s) => s.learningEvents);

  const concepts = useMemo(() => getAllConcepts(), []);

  const conceptStates = useMemo(
    () =>
      concepts.map((concept) => ({
        concept,
        state: getConceptState(concept, shownTips, learningEvents),
      })),
    [concepts, shownTips, learningEvents],
  );

  if (!isOpen) return null;

  const mastered = conceptStates.filter((c) => c.state === "mastered").length;
  const sprouted = conceptStates.filter((c) => c.state === "sprout").length;
  const total = conceptStates.length;

  return (
    <div className="bg-[#252526] border-t border-[#333] p-3">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#969696]">
          🌱 Jardín de Conocimiento
        </span>
        <button
          onClick={onClose}
          className="text-xs text-[#888] hover:text-[#d4d4d4] transition-colors px-1.5 py-0.5 rounded hover:bg-[#333]"
          aria-label="Cerrar jardín"
        >
          ✕
        </button>
      </div>

      {/* Progreso */}
      <div className="text-xs text-[#888] mb-2">
        {mastered} dominados · {sprouted} en progreso · {total - mastered - sprouted} por
        explorar
      </div>

      {/* Cuadrícula de conceptos */}
      <div className="grid grid-cols-5 gap-1.5">
        {conceptStates.map(({ concept, state }) => (
          <ConceptIcon key={concept} concept={concept} state={state} />
        ))}
      </div>
    </div>
  );
}

// ─── Concept Icon ──────────────────────────────────────────────

interface ConceptIconProps {
  concept: string;
  state: ConceptState;
}

/**
 * Icono individual de un concepto en el jardín.
 * Muestra tooltip al hacer hover explicando el concepto y su estado.
 */
function ConceptIcon({ concept, state }: ConceptIconProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const stateLabel = {
    locked: "Sin explorar",
    sprout: "En progreso",
    mastered: "Dominado",
  }[state];

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        className={`w-8 h-8 flex items-center justify-center rounded text-base
          transition-all duration-200
          ${
            state === "locked"
              ? "opacity-40 hover:opacity-60"
              : "opacity-90 hover:opacity-100 hover:scale-110"
          }
          ${state === "mastered" ? "bg-[#1a3a1a] border border-[#2a5a2a]" : ""}
          ${state === "sprout" ? "bg-[#2a2a1a] border border-[#4a4a2a]" : ""}
          ${state === "locked" ? "bg-transparent" : ""}
        `}
        title={`${concept}: ${stateLabel}`}
        aria-label={`${concept}: ${stateLabel}`}
      >
        {conceptEmoji(state)}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full mb-2 z-10 px-2 py-1 bg-[#1e1e1e] border border-[#444] rounded text-xs text-[#d4d4d4] whitespace-nowrap shadow-lg pointer-events-none">
          <p className="font-semibold capitalize">{concept}</p>
          <p className="text-[#888]">{stateLabel}</p>
        </div>
      )}
    </div>
  );
}
