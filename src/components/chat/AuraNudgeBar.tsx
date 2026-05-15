/**
 * AuraNudgeBar — Barra de nudges contextuales de Aura.
 *
 * Muestra hints proactivos basados en anti-patrones detectados
 * en el input del usuario. 100% client-side, 0 tokens LLM.
 */

import { useState, useEffect } from "react";
import { detectNudge, buildNudgeContext, type AuraNudge } from "@/lib/aura-nudges";
import { useChatStore, MAX_CONTEXT_MESSAGES } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";
import { usePurchaseIntent, getNudgeForIntent } from "@/hooks/usePurchaseIntent";

interface AuraNudgeBarProps {
  inputText: string;
}

const NUDGE_COLORS: Record<AuraNudge["type"], string> = {
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-300",
  tip: "bg-sky-500/10 border-sky-500/20 text-sky-300",
  info: "bg-white/5 border-white/10 text-slate-400",
};

export function AuraNudgeBar({ inputText }: AuraNudgeBarProps) {
  const [nudge, setNudge] = useState<AuraNudge | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const { intent, plan, clearIntent, openModal } = usePurchaseIntent();

  const messages = useChatStore((s) => {
    const session = s.sessions[s.activeSessionId];
    return session?.messages ?? [];
  });
  const hasProject = useProjectStore((s) => s.workspaces.length > 0);

  useEffect(() => {
    // Si hay una intención de compra, tiene máxima prioridad
    if (intent) {
      const intentNudge = getNudgeForIntent(intent, plan);
      if (intentNudge) {
        setNudge({ id: `purchase_${intent}`, message: intentNudge.message, type: intentNudge.type });
        return;
      }
    }

    // Debounce: only check after 300ms of no typing
    const timer = setTimeout(() => {
      if (!inputText.trim()) {
        setNudge(null);
        return;
      }

      const ctx = buildNudgeContext(
        inputText,
        messages.map((m) => ({ role: m.role, content: m.content })),
        hasProject,
        MAX_CONTEXT_MESSAGES,
      );

      const detected = detectNudge(ctx);
      // Don't show the same nudge if user dismissed it
      if (detected && detected.id !== dismissed) {
        setNudge(detected);
      } else if (!detected) {
        setNudge(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputText, messages, hasProject, dismissed, intent, plan]);

  if (!nudge) return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-1.5 text-[11px] border-b ${NUDGE_COLORS[nudge.type]} animate-fade-in`}
    >
      <span className="flex-1">{nudge.message}</span>
      
      {nudge.id.startsWith("purchase_") && (
        <button
          onClick={openModal}
          className="ml-2 px-3 py-1 bg-aura-purple/20 text-aura-purple border border-aura-purple/30 rounded text-[10px] font-bold tracking-wide uppercase hover:bg-aura-purple/30 transition-colors"
        >
          Mejorar Plan
        </button>
      )}

      <button
        onClick={() => {
          setDismissed(nudge.id);
          setNudge(null);
          if (nudge.id.startsWith("purchase_")) {
            clearIntent();
          }
        }}
        className="text-white/30 hover:text-white/60 transition-colors text-xs px-1 ml-1"
        aria-label="Descartar sugerencia"
      >
        ✕
      </button>
    </div>
  );
}
