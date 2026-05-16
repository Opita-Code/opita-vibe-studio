import { motion } from "framer-motion";

/**
 * StreakFlame — Animated fire streak indicator.
 *
 * Intensity scales with streak length:
 * - 1-2 days: small ember
 * - 3-6 days: growing flame
 * - 7-13 days: strong fire with glow
 * - 14-29 days: intense blaze
 * - 30+ days: inferno with particles
 */
export function StreakFlame({ streakDays }: { streakDays: number }) {
  if (streakDays <= 0) return null;

  // Visual intensity based on streak
  const intensity = getIntensity(streakDays);

  return (
    <div
      className={`flex items-center gap-1 cursor-default ${intensity.textColor}`}
      title={`Racha de ${streakDays} día${streakDays > 1 ? "s" : ""} consecutivo${streakDays > 1 ? "s" : ""}`}
    >
      {/* Animated flame */}
      <div className="relative">
        <motion.span
          className={`text-sm inline-block ${intensity.glow}`}
          role="img"
          aria-label="Racha"
          animate={{
            scale: [1, intensity.scaleMax, 1],
            rotate: [0, intensity.rotateMax, -intensity.rotateMax, 0],
          }}
          transition={{
            duration: intensity.speed,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {intensity.emoji}
        </motion.span>

        {/* Particles for high streaks */}
        {streakDays >= 14 && (
          <>
            <motion.span
              className="absolute -top-1 -right-0.5 text-[6px] pointer-events-none"
              animate={{
                y: [-2, -8],
                opacity: [0.8, 0],
                scale: [1, 0.5],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: 0,
              }}
            >
              ✨
            </motion.span>
            <motion.span
              className="absolute -top-0.5 -left-0.5 text-[5px] pointer-events-none"
              animate={{
                y: [-1, -6],
                opacity: [0.6, 0],
                scale: [1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.4,
              }}
            >
              ✨
            </motion.span>
          </>
        )}
      </div>

      {/* Count */}
      <span className="text-[11px] font-bold tabular-nums">{streakDays}</span>
    </div>
  );
}

function getIntensity(days: number) {
  if (days >= 30) {
    return {
      emoji: "🔥",
      textColor: "text-orange-300",
      glow: "drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]",
      scaleMax: 1.3,
      rotateMax: 8,
      speed: 0.6,
    };
  }
  if (days >= 14) {
    return {
      emoji: "🔥",
      textColor: "text-orange-400",
      glow: "drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]",
      scaleMax: 1.2,
      rotateMax: 6,
      speed: 0.8,
    };
  }
  if (days >= 7) {
    return {
      emoji: "🔥",
      textColor: "text-orange-400",
      glow: "drop-shadow-[0_0_4px_rgba(251,146,60,0.4)]",
      scaleMax: 1.15,
      rotateMax: 4,
      speed: 1,
    };
  }
  if (days >= 3) {
    return {
      emoji: "🔥",
      textColor: "text-amber-400",
      glow: "",
      scaleMax: 1.1,
      rotateMax: 3,
      speed: 1.2,
    };
  }
  return {
    emoji: "🕯️",
    textColor: "text-amber-600",
    glow: "",
    scaleMax: 1.05,
    rotateMax: 2,
    speed: 1.5,
  };
}
