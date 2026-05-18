/**
 * ThinkingChip — Collapsible thinking/reasoning indicator.
 *
 * Shows a compact chip above the message content with an executive label.
 * Collapsed by default. Expands to show full reasoning content on click.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ChevronDown, ChevronRight } from "lucide-react";

interface ThinkingChipProps {
  content: string;
  /** Executive label — auto-generated if not provided */
  label?: string;
  /** Start collapsed (default: true) */
  defaultCollapsed?: boolean;
}

/**
 * Auto-generates an executive label from thinking content.
 * Counts file references, tool mentions, and produces a summary.
 */
function generateLabel(content: string): string {
  const fileRefs = content.match(/\b[\w-]+\.(tsx?|jsx?|css|json|md|yml|yaml)\b/g);
  const uniqueFiles = fileRefs ? [...new Set(fileRefs)] : [];

  if (uniqueFiles.length > 0) {
    return `Analizó ${uniqueFiles.length} archivo${uniqueFiles.length > 1 ? "s" : ""}`;
  }

  // Count sentences as a rough proxy for analysis depth
  const sentences = content.split(/[.!?]\s/).length;
  if (sentences > 5) return "Análisis detallado";
  return "Razonamiento";
}

export function ThinkingChip({ content, label, defaultCollapsed = true }: ThinkingChipProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const displayLabel = useMemo(() => label || generateLabel(content), [label, content]);

  return (
    <div className="mb-2 animate-fade-in">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-[11px] font-medium text-purple-400/70 hover:text-purple-400 transition-colors group"
      >
        <Brain size={13} className="opacity-70 group-hover:opacity-100 transition-opacity" />
        <span>{displayLabel}</span>
        {isCollapsed ? (
          <ChevronRight size={12} className="opacity-50" />
        ) : (
          <ChevronDown size={12} className="opacity-50" />
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 pl-5 border-l-2 border-purple-500/20 text-xs text-purple-300/60 font-mono whitespace-pre-wrap italic leading-relaxed max-h-[200px] overflow-y-auto scroll-smooth">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
