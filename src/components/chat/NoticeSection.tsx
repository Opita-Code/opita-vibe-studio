/**
 * NoticeSection — Inline informational banner for chat messages.
 *
 * Used for: provider fallback notices, system warnings, etc.
 * Auto-collapses after a configurable timeout.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, ChevronDown } from "lucide-react";

interface NoticeSectionProps {
  content: string;
  /** Auto-collapse after this many ms (default: 10000). Set 0 to disable. */
  autoDismissMs?: number;
}

export function NoticeSection({ content, autoDismissMs = 10_000 }: NoticeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = setTimeout(() => setIsExpanded(false), autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  return (
    <div className="mb-2 animate-fade-in">
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/15 text-[12px] text-sky-300/90 cursor-pointer"
            onClick={() => setIsExpanded(false)}
          >
            <Info size={14} className="mt-0.5 shrink-0 opacity-70" />
            <span className="leading-relaxed">{content}</span>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-[10px] text-sky-400/50 hover:text-sky-400/80 transition-colors"
            onClick={() => setIsExpanded(true)}
          >
            <Info size={10} />
            <span>Aviso</span>
            <ChevronDown size={10} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
