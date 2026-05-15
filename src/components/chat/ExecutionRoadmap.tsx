/**
 * ExecutionRoadmap — Visual progress indicator for agent execution.
 *
 * Shows the current SDD phases as a vertical step list with animated
 * status indicators. The user sees friendly labels like "Analizando..."
 * without knowing about internal methodology.
 *
 * Appears inside the chat message area when the build agent is active.
 */

import { useMemo } from "react";
import type { RoadmapGoal } from "@/agent/types";

// ─── Props ─────────────────────────────────────────────────────

interface ExecutionRoadmapProps {
  goals: RoadmapGoal[];
  progress: number;
}

// ─── Status Indicator ──────────────────────────────────────────

function StatusDot({ status }: { status: RoadmapGoal["status"] }) {
  switch (status) {
    case "done":
      return (
        <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );

    case "active":
      return (
        <div className="w-5 h-5 rounded-full border-2 border-cyan-400 flex items-center justify-center shrink-0 relative">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <div className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping" />
        </div>
      );

    case "error":
      return (
        <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      );

    case "pending":
    default:
      return (
        <div className="w-5 h-5 rounded-full border border-white/20 shrink-0" />
      );
  }
}

// ─── Component ─────────────────────────────────────────────────

export function ExecutionRoadmap({ goals, progress }: ExecutionRoadmapProps) {
  const activeGoal = useMemo(
    () => goals.find((g) => g.status === "active"),
    [goals]
  );

  if (goals.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-obsidian-900/60 backdrop-blur-sm p-4 my-3 mx-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold tracking-widest uppercase text-white/50">
          Progreso
        </span>
        <span className="text-[11px] font-mono text-white/40">
          {progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 rounded-full bg-white/10 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Goal Steps */}
      <div className="space-y-1">
        {goals.map((goal, i) => (
          <div key={goal.id} className="flex items-start gap-3 relative">
            {/* Connector line */}
            {i < goals.length - 1 && (
              <div
                className={`absolute left-[9px] top-5 w-[1px] h-[calc(100%+4px)] ${
                  goal.status === "done"
                    ? "bg-emerald-500/30"
                    : "bg-white/10"
                }`}
              />
            )}

            <StatusDot status={goal.status} />

            <div className="flex-1 min-w-0 py-0.5">
              <span
                className={`text-xs font-medium block ${
                  goal.status === "active"
                    ? "text-cyan-300"
                    : goal.status === "done"
                      ? "text-white/50"
                      : goal.status === "error"
                        ? "text-red-400"
                        : "text-white/30"
                }`}
              >
                {goal.label}
              </span>

              {/* Sub-progress for active goal */}
              {goal.status === "active" && goal.progress !== undefined && (
                <div className="w-full h-0.5 rounded-full bg-white/5 mt-1.5">
                  <div
                    className="h-full rounded-full bg-cyan-500/50 transition-all duration-300"
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Active phase label */}
      {activeGoal && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] text-cyan-300/80 font-medium">
              {activeGoal.label}...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
