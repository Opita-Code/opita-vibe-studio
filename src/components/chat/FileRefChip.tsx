/**
 * FileRefChip — Clickable file reference inline in chat bubbles.
 *
 * Renders `src/utils.ts:42` as a styled chip that navigates to the
 * file + line in Monaco with a temporary highlight.
 *
 * Anti-misclick modes (from UIStore.fileRefClickMode):
 *  - "hold": 300ms press or double-click to navigate
 *  - "click": single click navigates directly
 *  - "disabled": chip is visual-only, no navigation
 */

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCode2 } from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";

// ─── Types ─────────────────────────────────────────────────────

interface FileRefChipProps {
  /** Relative file path (e.g. "src/utils.ts") */
  filePath: string;
  /** Optional start line */
  line?: number;
  /** Optional end line for range highlights */
  endLine?: number;
}

// ─── Navigation Event ──────────────────────────────────────────

/** Dispatch a custom event that MonacoEditor listens for */
function navigateToLine(file: string, line?: number, endLine?: number) {
  window.dispatchEvent(
    new CustomEvent("vibe:navigate-to-line", {
      detail: { file, line: line ?? 1, endLine },
    })
  );
}

// ─── Constants ─────────────────────────────────────────────────

const HOLD_DURATION_MS = 300;

// ─── Component ─────────────────────────────────────────────────

export function FileRefChip({ filePath, line, endLine }: FileRefChipProps) {
  const clickMode = useUIStore((s) => s.fileRefClickMode);
  const setClickMode = useUIStore((s) => s.setFileRefClickMode);
  const openFile = useProjectStore((s) => s.openFile);
  const workspaces = useProjectStore((s) => s.workspaces);
  const activeWorkspaceId = useProjectStore((s) => s.activeWorkspaceId);

  const [showTooltip, setShowTooltip] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve full path from workspace
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const sep = activeWs?.path.includes("\\") ? "\\" : "/";
  const fullPath = activeWs ? `${activeWs.path}${sep}${filePath.replace(/\//g, sep)}` : filePath;

  const basename = filePath.split(/[/\\]/).pop() || filePath;
  const label = line ? (endLine ? `${basename}:${line}-${endLine}` : `${basename}:${line}`) : basename;

  // ─── Navigation handler ──────────────────────────────────────

  const doNavigate = useCallback(async () => {
    await openFile(fullPath);
    // Small delay to let Monaco mount/render
    requestAnimationFrame(() => {
      navigateToLine(fullPath, line, endLine);
    });
  }, [openFile, fullPath, line, endLine]);

  // ─── Hold mode handlers ──────────────────────────────────────

  const onPointerDown = useCallback(() => {
    if (clickMode !== "hold") return;
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      setHolding(false);
      setShowTooltip(false);
      doNavigate();
    }, HOLD_DURATION_MS);
  }, [clickMode, doNavigate]);

  const onPointerUp = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (clickMode === "hold" && holding) {
      // Released too early — show tooltip
      setHolding(false);
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
    }
  }, [clickMode, holding]);

  const onPointerLeave = useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setHolding(false);
  }, []);

  // ─── Click mode handler ──────────────────────────────────────

  const onClick = useCallback(() => {
    if (clickMode === "click") {
      doNavigate();
    }
    // hold and disabled modes don't use onClick
  }, [clickMode, doNavigate]);

  // ─── Double-click as alternative for hold mode ───────────────

  const onDoubleClick = useCallback(() => {
    if (clickMode === "hold") {
      setShowTooltip(false);
      doNavigate();
    }
  }, [clickMode, doNavigate]);

  // ─── Dismiss handler ─────────────────────────────────────────

  const dismissTooltip = useCallback(() => {
    setShowTooltip(false);
    setClickMode("click");
  }, [setClickMode]);

  const isDisabled = clickMode === "disabled";
  const isInteractive = !isDisabled;

  return (
    <span className="relative inline-flex items-center align-baseline">
      <span
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-mono
          border transition-all duration-150 select-none
          ${isInteractive
            ? `bg-aura-purple/10 border-aura-purple/20 text-aura-purple/90
               hover:bg-aura-purple/20 hover:border-aura-purple/40 hover:text-aura-purple
               cursor-pointer active:scale-95`
            : "bg-white/5 border-white/10 text-white/50 cursor-default"
          }
          ${holding ? "scale-95 bg-aura-purple/25 border-aura-purple/50" : ""}
        `}
        title={isDisabled ? filePath : undefined}
      >
        <FileCode2 className="w-3 h-3 shrink-0" />
        {label}
      </span>

      {/* ─── Hold-mode tooltip ──────────────────────────────── */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
                       whitespace-nowrap px-2.5 py-1.5 rounded-lg
                       bg-obsidian-900 border border-white/10 shadow-xl
                       text-[10px] text-white/70"
          >
            <span>Mantén presionado o haz doble clic</span>
            <button
              onClick={(e) => { e.stopPropagation(); dismissTooltip(); }}
              className="ml-2 text-aura-purple/80 hover:text-aura-purple underline"
            >
              No mostrar
            </button>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/10" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
