/**
 * AuraStepChips — Chips de siguiente paso inteligente.
 *
 * Después de cada respuesta del agente, analiza el contexto
 * y muestra 1-2 sugerencias clickables de siguiente paso.
 * 100% client-side, 0 tokens LLM.
 */

import { useMemo } from "react";
import { getNextSteps, buildStepContext } from "@/lib/aura-steps";
import { useChatStore } from "@/stores/chat";
import { useProjectStore } from "@/stores/project";

interface AuraStepChipsProps {
  onStepClick: (action: string) => void;
}

export function AuraStepChips({ onStepClick }: AuraStepChipsProps) {
  const messages = useChatStore((s) => {
    const session = s.sessions[s.activeSessionId];
    return session?.messages ?? [];
  });
  const isStreaming = useChatStore((s) => s.isStreaming);
  const pipelinePhase = useChatStore((s) => s.pipelinePhase);
  const hasProject = useProjectStore((s) => s.workspaces.length > 0);
  const hasOpenFiles = useProjectStore((s) => (s.openTabs?.length ?? 0) > 0);

  const steps = useMemo(() => {
    if (isStreaming || messages.length === 0) return [];

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return [];

    const ctx = buildStepContext(
      messages.map((m) => ({ role: m.role, content: m.content })),
      pipelinePhase,
      hasProject,
      hasOpenFiles,
    );

    return getNextSteps(ctx);
  }, [messages, isStreaming, pipelinePhase, hasProject, hasOpenFiles]);

  if (steps.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 animate-fade-in">
      <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold shrink-0">
        Aura sugiere
      </span>
      {steps.map((step, i) => (
        <button
          key={i}
          onClick={() => onStepClick(step.action)}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded-full bg-aura-cyan/5 border border-aura-cyan/20 text-aura-cyan hover:bg-aura-cyan/15 hover:border-aura-cyan/40 transition-all duration-200 shadow-[0_0_8px_rgba(0,255,255,0.05)]"
        >
          <span>{step.icon}</span>
          {step.label}
        </button>
      ))}
    </div>
  );
}
