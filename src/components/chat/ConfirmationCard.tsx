/**
 * ConfirmationCard — Inline phase confirmation inside message bubbles.
 *
 * Replaces the PhaseConfirmationBar fixed at the bottom.
 * Shows what phase completed and what comes next.
 * Buttons: Continue / Pause / Cancel — all within the bubble.
 */

import { motion } from "framer-motion";
import { useChatStore } from "@/stores/chat";
import type { AgentExecution } from "@/lib/types";

// ─── Props ─────────────────────────────────────────────────────

interface ConfirmationCardProps {
  /** The agent execution state with confirmation context */
  execution: AgentExecution;
  /** Message ID this card belongs to */
  messageId: string;
}

// ─── Phase labels ──────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  thinking: "Análisis",
  planning: "Planificación",
  building: "Construcción",
  verifying: "Verificación",
  propose: "Propuesta",
  spec: "Especificación",
  design: "Diseño",
  tasks: "Tareas",
  apply: "Aplicación",
  verify: "Verificación",
};

function phaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

// ─── Component ─────────────────────────────────────────────────

export function ConfirmationCard({ execution, messageId }: ConfirmationCardProps) {
  const confirmation = execution.confirmation;
  if (!confirmation) return null;

  const confirmPhase = useChatStore(s => s.confirmPhase);
  const abortStreaming = useChatStore(s => s.abortStreaming);
  const setMessageStatus = useChatStore(s => s.setMessageStatus);

  const handleContinue = () => {
    confirmPhase();
    setMessageStatus(messageId, "running");
  };

  const handleCancel = () => {
    abortStreaming();
    setMessageStatus(messageId, "done");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="rounded-xl border border-cyan-500/20 bg-gradient-to-b from-cyan-500/5 to-transparent p-3 mt-3"
    >
      {/* Status */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400/80">
          Esperando confirmación
        </span>
      </div>

      {/* Phase transition */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-emerald-400/80 font-medium">
          ✓ {phaseLabel(confirmation.completedPhase)}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-xs text-cyan-300 font-medium">
          {phaseLabel(confirmation.nextPhase)}
        </span>
      </div>

      {/* Summary */}
      {confirmation.summary && (
        <p className="text-[11px] text-white/50 mb-3 leading-relaxed">
          {confirmation.summary}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleContinue}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all shadow-[0_0_10px_rgba(16,185,129,0.08)]"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Continuar
        </button>
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-red-500/10 text-red-400/70 border border-red-500/15 hover:bg-red-500/20 hover:text-red-400 transition-all"
        >
          Cancelar
        </button>
      </div>
    </motion.div>
  );
}
