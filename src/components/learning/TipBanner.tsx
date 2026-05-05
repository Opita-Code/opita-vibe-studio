import { useEffect, useRef, useState } from "react";
import { useLearningStore } from "@/stores/learning";

/**
 * Auto-dismiss timeout en milisegundos.
 * El tip se oculta automáticamente después de este tiempo.
 */
const AUTO_DISMISS_MS = 8_000;

/**
 * Banner no intrusivo que muestra tips de aprendizaje "¿Sabías que...?".
 *
 * - Aparece en la parte inferior del editor/chat
 * - Se auto-descarta después de 8 segundos
 * - El usuario puede descartarlo manualmente con "Entendido 👍"
 * - El usuario puede expandir para ver la explicación completa con "Quiero saber más 🔍"
 */
interface TipBannerProps {
  /** Posición del banner en la pantalla */
  position?: "bottom-left" | "bottom-right";
}

export function TipBanner({ position = "bottom-left" }: TipBannerProps) {
  const currentTip = useLearningStore((s) => s.currentTip);
  const isVisible = useLearningStore((s) => s.isVisible);
  const dismissTip = useLearningStore((s) => s.dismissTip);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Auto-dismiss ──────────────────────────────────────────
  useEffect(() => {
    if (isVisible && currentTip) {
      timerRef.current = setTimeout(() => {
        dismissTip();
      }, AUTO_DISMISS_MS);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isVisible, currentTip, dismissTip]);

  // ── Resetear expansión al cambiar de tip ──────────────────
  useEffect(() => {
    setIsExpanded(false);
  }, [currentTip]);

  if (!isVisible || !currentTip) return null;

  const positionClass = position === "bottom-right" ? "right-4" : "left-4";

  return (
    <div
      className={`fixed bottom-10 ${positionClass} z-50 max-w-md`}
      style={{ animation: "slideInUp 0.3s ease-out" }}
    >
      <div className="bg-[#2d2d2d] border border-[#444] rounded-lg shadow-xl p-4">
        {/* Encabezado */}
        <div className="flex items-start gap-3">
          <span className="text-lg shrink-0 mt-0.5">💡</span>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#d4d4d4] leading-relaxed">
              {currentTip.question}
            </p>

            {/* Explicación expandida */}
            {isExpanded && (
              <div className="mt-2 p-3 bg-[#1e1e1e] rounded text-xs text-[#b0b0b0] leading-relaxed">
                {currentTip.explanation}
              </div>
            )}
          </div>

          {/* Botón cerrar */}
          <button
            onClick={dismissTip}
            className="text-[#888] hover:text-[#d4d4d4] transition-colors shrink-0 px-1"
            title="Cerrar"
            aria-label="Cerrar tip"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#3a3a3a]">
          <button
            onClick={dismissTip}
            className="px-3 py-1 text-xs bg-[#007acc] text-white rounded hover:bg-[#0098ff] transition-colors"
          >
            Entendido 👍
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 text-xs text-[#888] hover:text-[#d4d4d4] hover:bg-[#3a3a3a] rounded transition-colors"
          >
            {isExpanded ? "Mostrar menos ▲" : "Quiero saber más 🔍"}
          </button>
        </div>
      </div>
    </div>
  );
}
