/**
 * AgentStepAccordion — Collapsible tool execution history.
 *
 * Replaces AuraStepChips with a richer view that shows:
 * - Each tool execution as a compact row
 * - Status icon (running spinner, success checkmark, error X)
 * - Friendly labels (from agent/prompts.ts)
 * - Expandable detail on click
 *
 * Designed for the chat message area — appears inline within assistant messages.
 */

import { useState } from "react";
import type { AgentStep } from "@/agent/types";

// ─── Props ─────────────────────────────────────────────────────

interface AgentStepAccordionProps {
  steps: AgentStep[];
  /** Whether steps are still being added */
  isActive: boolean;
}

// ─── Step Row ──────────────────────────────────────────────────

function StepRow({ step, isLast }: { step: AgentStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`group ${isLast ? "" : "border-b border-white/5"}`}
    >
      <button
        onClick={() => step.detail && setExpanded(!expanded)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
          step.detail
            ? "hover:bg-white/5 cursor-pointer"
            : "cursor-default"
        }`}
      >
        {/* Status Icon */}
        <StepStatusIcon status={step.status} />

        {/* Icon */}
        <span className="text-sm shrink-0">{step.icon}</span>

        {/* Label */}
        <span
          className={`text-xs flex-1 min-w-0 truncate ${
            step.status === "running"
              ? "text-cyan-300"
              : step.status === "done"
                ? "text-white/60"
                : "text-red-400"
          }`}
        >
          {step.label}
        </span>

        {/* Duration */}
        {step.status === "done" && (
          <span className="text-[10px] text-white/25 shrink-0 font-mono">
            ✓
          </span>
        )}

        {/* Expand indicator */}
        {step.detail && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-white/20 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && step.detail && (
        <div className="px-3 pb-2 pl-[42px]">
          <pre className="text-[10px] text-white/40 font-mono whitespace-pre-wrap break-words leading-relaxed bg-black/20 rounded p-2">
            {step.detail}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Status Icon ───────────────────────────────────────────────

function StepStatusIcon({ status }: { status: AgentStep["status"] }) {
  switch (status) {
    case "running":
      return (
        <div className="w-3.5 h-3.5 shrink-0 relative">
          <div className="w-full h-full rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
        </div>
      );

    case "done":
      return (
        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-emerald-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );

    case "error":
      return (
        <div className="w-3.5 h-3.5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-red-400"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      );

    default:
      return <div className="w-3.5 h-3.5 shrink-0" />;
  }
}

// ─── Component ─────────────────────────────────────────────────

export function AgentStepAccordion({
  steps,
  isActive,
}: AgentStepAccordionProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.status === "done").length;
  const errorCount = steps.filter((s) => s.status === "error").length;

  return (
    <div className="rounded-lg border border-white/8 bg-obsidian-900/40 backdrop-blur-sm my-2 mx-1 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isActive ? (
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          ) : errorCount > 0 ? (
            <div className="w-2 h-2 rounded-full bg-red-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          )}

          <span className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">
            {isActive
              ? `Ejecutando... (${doneCount}/${steps.length})`
              : errorCount > 0
                ? `${doneCount} completados, ${errorCount} con error`
                : `${doneCount} operaciones completadas`}
          </span>
        </div>

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-white/30 transition-transform ${
            collapsed ? "" : "rotate-180"
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Steps List */}
      {!collapsed && (
        <div className="border-t border-white/5">
          {steps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
