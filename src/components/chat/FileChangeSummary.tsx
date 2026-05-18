/**
 * FileChangeSummary — Shows files created/modified/deleted by agent.
 *
 * Appears at the end of an agent execution.
 * Click to open diff view for modified files.
 */

import { motion } from "framer-motion";
import { useProjectStore } from "@/stores/project";
import type { AgentFileChange } from "@/lib/types";

// ─── Props ─────────────────────────────────────────────────────

interface FileChangeSummaryProps {
  files: AgentFileChange[];
}

// ─── Action badge ──────────────────────────────────────────────

const ACTION_CONFIG = {
  created:  { label: "nuevo",      color: "text-emerald-400", bg: "bg-emerald-500/10", icon: "+" },
  modified: { label: "modificado", color: "text-amber-400",   bg: "bg-amber-500/10",   icon: "~" },
  deleted:  { label: "eliminado", color: "text-red-400",     bg: "bg-red-500/10",     icon: "−" },
} as const;

// ─── Component ─────────────────────────────────────────────────

export function FileChangeSummary({ files }: FileChangeSummaryProps) {
  if (files.length === 0) return null;

  const handleFileClick = (file: AgentFileChange) => {
    if (file.action !== "deleted") {
      useProjectStore.getState().openDiffMode(file.path);
    }
  };

  const createdCount = files.filter(f => f.action === "created").length;
  const modifiedCount = files.filter(f => f.action === "modified").length;
  const deletedCount = files.filter(f => f.action === "deleted").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.1 }}
      className="rounded-lg border border-white/8 bg-black/20 p-2.5 mt-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
          <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
          <path d="M14 3v5h5" />
        </svg>
        <span className="text-[10px] font-bold tracking-wider uppercase text-white/40">
          {files.length} archivo{files.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {createdCount > 0 && (
            <span className="text-[9px] font-mono text-emerald-400/70">+{createdCount}</span>
          )}
          {modifiedCount > 0 && (
            <span className="text-[9px] font-mono text-amber-400/70">~{modifiedCount}</span>
          )}
          {deletedCount > 0 && (
            <span className="text-[9px] font-mono text-red-400/70">−{deletedCount}</span>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="space-y-0.5">
        {files.map(file => {
          const config = ACTION_CONFIG[file.action];
          const basename = file.path.split("/").pop() ?? file.path;

          return (
            <button
              key={file.path}
              onClick={() => handleFileClick(file)}
              disabled={file.action === "deleted"}
              className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors ${
                file.action !== "deleted"
                  ? "hover:bg-white/5 cursor-pointer"
                  : "cursor-default opacity-60"
              }`}
            >
              <span className={`text-[10px] font-mono font-bold w-3 ${config.color}`}>
                {config.icon}
              </span>
              <span className="text-[10px] text-white/60 truncate flex-1 font-mono">
                {basename}
              </span>
              {file.linesChanged !== undefined && (
                <span className="text-[9px] text-white/25 font-mono">
                  {file.linesChanged}L
                </span>
              )}
              <span className={`text-[8px] font-medium uppercase px-1 py-0.5 rounded ${config.bg} ${config.color}`}>
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
