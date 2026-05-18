/**
 * InlineRoadmap — Vertical roadmap inside a message bubble.
 *
 * - SIEMPRE vertical (nunca horizontal — los labels son demasiado largos)
 * - Steps completados son colapsables (solo se muestra el checkmark + label)
 * - El step activo se expande automáticamente
 * - La burbuja crece en vertical naturalmente
 * - Animado con Framer Motion
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentExecutionGoal } from "@/lib/types";
import { ChevronDown } from "lucide-react";

// ─── Props ─────────────────────────────────────────────────────

interface InlineRoadmapProps {
  goals: AgentExecutionGoal[];
  progress: number;
}

// ─── Status Dot ────────────────────────────────────────────────

function GoalDot({ status }: { status: AgentExecutionGoal["status"] }) {
  switch (status) {
    case "done":
      return (
        <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );
    case "active":
      return (
        <div className="w-4 h-4 rounded-full border-2 border-cyan-400 flex items-center justify-center shrink-0 relative">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>
      );
    case "error":
      return (
        <div className="w-4 h-4 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      );
    default:
      return <div className="w-4 h-4 rounded-full border border-white/15 shrink-0" />;
  }
}

// ─── Single Goal Row ────────────────────────────────────────────

function GoalRow({
  goal,
  index,
  isLast,
  isExpanded,
  onToggle,
}: {
  goal: AgentExecutionGoal;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isDone = goal.status === "done";
  const isActive = goal.status === "active";

  const labelColor = isActive
    ? "text-cyan-300"
    : isDone
      ? "text-white/50"
      : goal.status === "error"
        ? "text-red-400"
        : "text-white/25";

  // Done goals are collapsible; active/pending are always visible
  const isCollapsible = isDone;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="relative flex items-start gap-2.5"
    >
      {/* Vertical connector line */}
      {!isLast && (
        <div
          className={`absolute left-[7px] top-4 w-[1px] bottom-0 -mb-0.5 ${
            isDone ? "bg-emerald-500/30" : isActive ? "bg-cyan-400/20" : "bg-white/8"
          }`}
          style={{ height: "calc(100% + 4px)" }}
        />
      )}

      <GoalDot status={goal.status} />

      <div className="flex-1 min-w-0 pb-2.5">
        {isCollapsible ? (
          /* Completed step — clickable to expand detail if any */
          <button
            onClick={onToggle}
            className="flex items-center gap-1.5 group w-full text-left"
          >
            <span className={`text-[11px] font-medium ${labelColor} truncate flex-1`}>
              {goal.label}
            </span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 text-white/20 group-hover:text-white/40 transition-colors"
            >
              <ChevronDown size={10} />
            </motion.div>
          </button>
        ) : (
          /* Active or pending step — always visible */
          <span className={`text-[11px] font-medium ${labelColor} block`}>
            {goal.label}
            {isActive && (
              <span className="ml-1 inline-block w-1 h-1 rounded-full bg-cyan-400 animate-bounce" />
            )}
          </span>
        )}

        {/* Barra de progreso individual — solo en goals activos con progress */}
        {isActive && goal.progress !== undefined && goal.progress > 0 && (
          <div className="mt-1.5 w-full h-[3px] rounded-full bg-white/8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400"
              initial={{ width: 0 }}
              animate={{ width: `${goal.progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        )}

        {/* Expandable detail for done steps */}
        <AnimatePresence>
          {isExpanded && isDone && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <span className="text-[10px] text-emerald-400/50 font-mono">
                {goal.detail ?? "✓ completado"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Component ─────────────────────────────────────────────────

export function InlineRoadmap({ goals, progress }: InlineRoadmapProps) {
  if (goals.length === 0) return null;

  const allDone = goals.every((g) => g.status === "done");

  // Track which done-steps are expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="rounded-lg border border-white/8 bg-black/20 px-3 pt-3 pb-1 mt-2 mb-1"
    >
      {/* Progress bar — only while running */}
      {!allDone && (
        <div className="w-full h-0.5 rounded-full bg-white/8 mb-3 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      )}

      {/* Steps — always vertical */}
      <div className="flex flex-col">
        {goals.map((goal, i) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            index={i}
            isLast={i === goals.length - 1}
            isExpanded={expandedIds.has(goal.id)}
            onToggle={() => toggleExpanded(goal.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}
