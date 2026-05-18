/**
 * InlineSteps — Animated tool execution chips inside message bubbles.
 *
 * Shows steps as compact chips when few, expands to list with details.
 * Replaces ReasoningAccordion for agent-aware messages.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentExecutionStep } from "@/lib/types";
import { Terminal, BookOpen, FileEdit, HardDrive, ChevronDown } from "lucide-react";

// ─── Props ─────────────────────────────────────────────────────

interface InlineStepsProps {
  steps: AgentExecutionStep[];
  /** Whether more steps are still coming */
  isLive?: boolean;
}

// ─── Icon resolver ─────────────────────────────────────────────

function StepIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("leer") || lower.includes("read") || lower.includes("buscar") || lower.includes("search")) {
    return <BookOpen size={10} className="opacity-70" />;
  }
  if (lower.includes("escribir") || lower.includes("write") || lower.includes("crear") || lower.includes("create") || lower.includes("modific")) {
    return <FileEdit size={10} className="opacity-70" />;
  }
  if (lower.includes("memor") || lower.includes("save") || lower.includes("guardar")) {
    return <HardDrive size={10} className="opacity-70" />;
  }
  return <Terminal size={10} className="opacity-70" />;
}

// ─── Status dot ────────────────────────────────────────────────

function StepStatus({ status }: { status: AgentExecutionStep["status"] }) {
  switch (status) {
    case "running":
      return (
        <div className="w-2.5 h-2.5 shrink-0 relative">
          <div className="w-full h-full rounded-full border border-cyan-400/50 border-t-cyan-400 animate-spin" />
        </div>
      );
    case "done":
      return (
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30 flex items-center justify-center shrink-0">
          <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );
    case "error":
      return <div className="w-2.5 h-2.5 rounded-full bg-red-500/30 shrink-0" />;
    default:
      return null;
  }
}

// ─── Component ─────────────────────────────────────────────────

export function InlineSteps({ steps, isLive }: InlineStepsProps) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const doneCount = steps.filter(s => s.status === "done").length;
  const activeStep = steps.find(s => s.status === "running");

  return (
    <div className="mt-2">
      {/* ── Header/Toggle ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] font-mono text-white/40 hover:text-white/60 transition-colors"
      >
        {isLive ? (
          <svg width="12" height="12" viewBox="0 0 24 24" className="animate-spin text-cyan-400" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
        ) : (
          <ChevronDown
            size={10}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
        <span>
          {isLive && activeStep
            ? activeStep.label
            : `${doneCount} operación${doneCount === 1 ? "" : "es"}`}
        </span>
      </button>

      {/* ── Expanded list ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden mt-1.5 pl-2 border-l border-white/8"
          >
            {steps.map(step => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-center gap-1.5 py-0.5 text-[10px]"
              >
                <StepStatus status={step.status} />
                <StepIcon label={step.label} />
                <span className={
                  step.status === "running" ? "text-cyan-300" :
                  step.status === "done" ? "text-white/40" :
                  "text-red-400"
                }>
                  {step.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
