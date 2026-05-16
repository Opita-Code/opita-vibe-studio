/**
 * AgentActivityBar — Real-time agent transparency panel.
 *
 * Lives ABOVE the message list in ChatPanel. Shows what the agent
 * is doing in real-time with 3 levels of detail:
 *
 * Collapsed: Donut progress + current phase label
 * Expanded:
 *   1. Roadmap — high-level goals with status dots
 *   2. Steps — tool executions with expand/collapse
 *
 * Design: progressive disclosure — least technical first.
 */

import { useState } from "react";
import { useAgentStore } from "@/stores/agent";
import { DonutProgress } from "./DonutProgress";
import { ExecutionRoadmap } from "./ExecutionRoadmap";
import { AgentStepAccordion } from "./AgentStepAccordion";

// ─── Phase Labels (user-facing, in Spanish) ────────────────────

const PHASE_LABELS: Record<string, string> = {
  thinking: "Analizando...",
  planning: "Preparando plan...",
  building: "Construyendo...",
  verifying: "Verificando...",
  chatting: "Respondiendo...",
};

// ─── Component ─────────────────────────────────────────────────

export function AgentActivityBar() {
  const {
    isExecuting,
    phase,
    progress,
    roadmap,
    steps,
    activityBarExpanded,
    setActivityBarExpanded,
  } = useAgentStore();

  const [detailLevel, setDetailLevel] = useState<"roadmap" | "steps">("roadmap");

  // Don't render if agent has never executed in this session
  if (!isExecuting && roadmap.length === 0 && steps.length === 0) {
    return null;
  }

  const phaseLabel = phase ? PHASE_LABELS[phase] || phase : "Completado";
  const hasSteps = steps.length > 0;
  const hasRoadmap = roadmap.length > 0;

  return (
    <div className="border-b border-white/8 bg-obsidian-900/40 backdrop-blur-sm">
      {/* ─── Collapsed Header ────────────────────────────────── */}
      <button
        onClick={() => setActivityBarExpanded(!activityBarExpanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors"
      >
        {/* Donut */}
        <DonutProgress percent={progress} size={24} strokeWidth={2.5} showText={false} />

        {/* Phase + Progress */}
        <div className="flex-1 min-w-0 text-left">
          <span className={`text-xs font-medium ${isExecuting ? "text-cyan-300" : "text-white/50"}`}>
            {phaseLabel}
          </span>
          {isExecuting && (
            <span className="text-[10px] text-white/30 ml-2 font-mono">
              {progress}%
            </span>
          )}
        </div>

        {/* Status dot */}
        {isExecuting ? (
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        )}

        {/* Expand chevron */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-white/30 shrink-0 transition-transform ${
            activityBarExpanded ? "rotate-180" : ""
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ─── Expanded Panel ──────────────────────────────────── */}
      {activityBarExpanded && (
        <div className="border-t border-white/5">
          {/* Tab switcher */}
          {hasRoadmap && hasSteps && (
            <div className="flex gap-1 px-4 pt-2">
              <TabButton
                active={detailLevel === "roadmap"}
                onClick={() => setDetailLevel("roadmap")}
                label="Progreso"
              />
              <TabButton
                active={detailLevel === "steps"}
                onClick={() => setDetailLevel("steps")}
                label="Detalle técnico"
              />
            </div>
          )}

          {/* Content */}
          <div className="max-h-48 overflow-y-auto">
            {detailLevel === "roadmap" && hasRoadmap ? (
              <ExecutionRoadmap goals={roadmap} progress={progress} />
            ) : hasSteps ? (
              <AgentStepAccordion steps={steps} isActive={isExecuting} />
            ) : (
              <div className="px-4 py-3 text-xs text-white/30">
                Esperando acciones del agente...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Button ────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${
        active
          ? "bg-white/10 text-white/70"
          : "text-white/30 hover:text-white/50 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}
