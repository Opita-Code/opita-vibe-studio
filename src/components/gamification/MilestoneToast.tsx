import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface MilestoneToastProps {
  level: number;
  badge: string;
  label: string;
  quotaBoost: number;
  onDismiss: () => void;
}

/**
 * MilestoneToast — Level-up celebration overlay.
 * Auto-dismisses after 5 seconds with a satisfying animation.
 */
export function MilestoneToast({ level, badge, label, quotaBoost, onDismiss }: MilestoneToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for exit animation
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-6 right-6 z-[100] max-w-sm"
          role="alert"
          aria-live="polite"
        >
          <div className="bg-obsidian-900/95 backdrop-blur-xl border border-aura-cyan/30 rounded-2xl p-5 shadow-[0_0_30px_rgba(6,182,212,0.2)] flex gap-4 items-center">
            {/* Badge */}
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-aura-cyan/20 to-aura-purple/20 border border-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl" role="img" aria-label={label}>{badge}</span>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-aura-cyan to-aura-purple">
                  ¡Nivel {level}!
                </span>
                <span className="text-xs text-white/50">{label}</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">
                +{(quotaBoost / 1000).toFixed(0)}K de quota diaria desbloqueada
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
              className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
