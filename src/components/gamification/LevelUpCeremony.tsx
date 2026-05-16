import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

interface LevelUpCeremonyProps {
  level: number;
  badge: string;
  label: string;
  quotaBoost: number;
  onDismiss: () => void;
}

// ─── Particle System ────────────────────────────────────────────

function Particle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: Math.random() * 6 + 3,
        height: Math.random() * 6 + 3,
        backgroundColor: color,
        left: `${50 + x}%`,
        top: "50%",
      }}
      initial={{ opacity: 0, scale: 0, y: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1.5, 1, 0.5],
        y: [0, -80 - Math.random() * 120],
        x: [0, x * 3],
      }}
      transition={{
        duration: 1.5 + Math.random() * 0.5,
        delay: delay,
        ease: "easeOut",
      }}
    />
  );
}

const PARTICLE_COLORS = [
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#3b82f6", // blue
  "#fbbf24", // amber
  "#34d399", // emerald
  "#f472b6", // pink
];

function ParticleBurst() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.3,
    x: (Math.random() - 0.5) * 60,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <Particle key={p.id} delay={p.delay} x={p.x} color={p.color} />
      ))}
    </div>
  );
}

// ─── Ceremony ───────────────────────────────────────────────────

/**
 * LevelUpCeremony — Fullscreen overlay celebration for level-up milestones.
 * Shows particle burst, animated badge, and reward details.
 * Auto-dismisses after 4 seconds.
 */
export function LevelUpCeremony({ level, badge, label, quotaBoost, onDismiss }: LevelUpCeremonyProps) {
  const [visible, setVisible] = useState(true);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 500);
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={dismiss}
        >
          {/* Backdrop with radial glow */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(circle at center, rgba(6,182,212,0.15) 0%, rgba(0,0,0,0.85) 70%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Particle burst */}
          <ParticleBurst />

          {/* Content card */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className="relative flex flex-col items-center gap-4 z-10"
          >
            {/* Pulsing ring behind badge */}
            <motion.div
              className="absolute w-32 h-32 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)",
              }}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 0.2, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Badge */}
            <motion.div
              className="w-24 h-24 rounded-2xl bg-gradient-to-br from-aura-cyan/20 to-aura-purple/20 border-2 border-aura-cyan/30 flex items-center justify-center shadow-[0_0_60px_rgba(6,182,212,0.3)]"
              initial={{ rotate: -180, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 150,
                damping: 12,
                delay: 0.2,
              }}
            >
              <span className="text-5xl" role="img" aria-label={label}>
                {badge}
              </span>
            </motion.div>

            {/* Level number */}
            <motion.div
              className="flex flex-col items-center gap-1"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-aura-cyan via-aura-blue to-aura-purple">
                ¡Nivel {level}!
              </span>
              <span className="text-sm text-white/60 font-medium">{label}</span>
            </motion.div>

            {/* Reward */}
            {quotaBoost > 0 && (
              <motion.div
                className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <span className="text-sm font-bold text-emerald-400">
                  +{(quotaBoost / 1000).toFixed(0)}K quota diaria
                </span>
              </motion.div>
            )}

            {/* Dismiss hint */}
            <motion.span
              className="text-[10px] text-white/20 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              Click para cerrar
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
