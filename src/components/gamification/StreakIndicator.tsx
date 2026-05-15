/**
 * StreakIndicator — Fire streak counter.
 * Shows consecutive days with a flame icon and count.
 */
export function StreakIndicator({ streakDays }: { streakDays: number }) {
  if (streakDays <= 0) return null;

  const intensity = streakDays >= 7 ? "text-orange-400" : streakDays >= 3 ? "text-amber-400" : "text-amber-600";
  const glow = streakDays >= 7 ? "drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" : "";

  return (
    <div
      className={`flex items-center gap-1 ${intensity} ${glow} cursor-default`}
      title={`Racha de ${streakDays} día${streakDays > 1 ? "s" : ""} consecutivo${streakDays > 1 ? "s" : ""}`}
    >
      <span className="text-sm" role="img" aria-label="Racha">🔥</span>
      <span className="text-[11px] font-bold tabular-nums">{streakDays}</span>
    </div>
  );
}
