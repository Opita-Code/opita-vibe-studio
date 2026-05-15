import { motion } from "framer-motion";
import { useGamificationStore } from "@/stores/gamification";
import { xpForLevel } from "@/lib/xp-constants";

/**
 * XPBar — Compact animated XP progress bar.
 * Shows current level + progress to next level.
 * Designed to fit in the ActivityBar bottom section.
 */
export function XPBar() {
  const { profile, progressPercent, setMissionPanelOpen, missionPanelOpen } = useGamificationStore();

  if (!profile) return null;

  const level = profile.level;
  const nextLevelXp = xpForLevel(level + 1);
  const currentLevelXp = xpForLevel(level);
  const xpInLevel = profile.totalXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;

  return (
    <div
      className="w-10 flex flex-col items-center gap-1 group cursor-pointer"
      title={`Nivel ${level} — ${xpInLevel}/${xpNeeded} XP\nClick para ver misiones`}
      onClick={() => setMissionPanelOpen(!missionPanelOpen)}
      role="button"
      aria-label={`Nivel ${level}, ${xpInLevel} de ${xpNeeded} XP. Abrir misiones.`}
    >
      {/* Level number */}
      <span className="text-[10px] font-bold text-aura-cyan/80 group-hover:text-aura-cyan transition-colors tabular-nums">
        Lv.{level}
      </span>

      {/* Progress bar (vertical) */}
      <div className="w-1.5 h-10 bg-white/5 rounded-full overflow-hidden relative">
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-aura-cyan to-aura-purple"
          initial={{ height: 0 }}
          animate={{ height: `${progressPercent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* XP label */}
      <span className="text-[8px] text-white/30 group-hover:text-white/50 transition-colors">
        XP
      </span>
    </div>
  );
}
