import { useGamificationStore } from "@/stores/gamification";

/**
 * LevelBadge — Shows current level badge icon.
 * Displays the highest unlocked milestone badge.
 * Falls back to a generic star for early levels.
 */
export function LevelBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const { profile, milestones } = useGamificationStore();

  if (!profile) return null;

  // Find the highest unlocked milestone
  const unlockedMilestones = milestones.filter((m) => m.unlocked);
  const highest = unlockedMilestones.length > 0
    ? unlockedMilestones[unlockedMilestones.length - 1]
    : null;

  const badge = highest?.badge ?? "⭐";
  const label = highest?.label ?? "Principiante";

  const sizeClasses = size === "md"
    ? "w-8 h-8 text-base"
    : "w-6 h-6 text-sm";

  return (
    <div
      className={`${sizeClasses} rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-default hover:bg-white/10 hover:border-white/20 transition-all`}
      title={`${label} — Nivel ${profile.level}`}
    >
      <span role="img" aria-label={label}>{badge}</span>
    </div>
  );
}
