import { useAuthStore } from "@/stores/auth";
import { useGamificationStore } from "@/stores/gamification";
import { PlanCard } from "@/components/usage/PlanCard";
import { Trophy, Flame, Zap, Award, CheckCircle2, Target } from "lucide-react";
import { calculateLevel } from "@/lib/xp-constants";

/**
 * Mobile Hub View — Dashboard de engagement y uso.
 * Muestra XP, misiones, plan y streaks en un layout touch-friendly.
 */
export function MobileHubView() {
  const authMode = useAuthStore((s) => s.authMode);
  const profile = useGamificationStore((s) => s.profile);
  const missions = useGamificationStore((s) => s.missions);
  const progressPercent = useGamificationStore((s) => s.progressPercent);
  const xpRemaining = useGamificationStore((s) => s.xpRemaining);

  if (authMode !== "authenticated") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <Zap className="w-12 h-12 text-aura-purple/50 mb-4" />
        <h2 className="text-lg font-semibold text-white mb-2">
          Desbloquea tu Hub
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">
          Inicia sesión para ver tu progreso, misiones y logros.
        </p>
        <a
          href={`https://cuenta.opitacode.com/login?return_to=${encodeURIComponent(window.location.href)}`}
          className="px-6 py-3 bg-gradient-to-r from-aura-cyan to-aura-purple text-white font-medium rounded-xl text-sm shadow-lg active:scale-95 transition-transform"
        >
          Iniciar sesión
        </a>
      </div>
    );
  }

  const level = profile?.level ?? calculateLevel(profile?.totalXp ?? 0);
  const totalXp = profile?.totalXp ?? 0;
  const streak = profile?.streakDays ?? 0;
  const completedMissions = missions.filter((m) => m.completed).length;
  const totalMissions = missions.length;

  return (
    <div className="flex flex-col h-full overflow-y-auto overscroll-y-contain">
      {/* Hero Section — Level & XP */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-aura-cyan/20 to-aura-purple/20 border border-white/10 flex items-center justify-center">
              <Award className="w-6 h-6 text-aura-purple" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Nivel {level}</p>
              <p className="text-lg font-bold text-white">{totalXp} XP</p>
            </div>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full px-3 py-1.5">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-orange-300">{streak}</span>
            </div>
          )}
        </div>

        {/* XP Progress Bar */}
        <div className="w-full h-2 bg-obsidian-800 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-gradient-to-r from-aura-cyan to-aura-purple rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-600 text-right">{xpRemaining} XP para el siguiente nivel</p>
      </div>

      {/* Plan Card */}
      <div className="px-5 pb-4">
        <PlanCard />
      </div>

      {/* Missions Section */}
      <div className="px-5 pb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-aura-cyan" />
            <h3 className="text-sm font-semibold text-white">Misiones diarias</h3>
          </div>
          {totalMissions > 0 && (
            <span className="text-xs text-slate-500">{completedMissions}/{totalMissions}</span>
          )}
        </div>

        {missions.length > 0 ? (
          <div className="space-y-2">
            {missions.map((mission) => (
              <div
                key={mission.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  mission.completed
                    ? "bg-aura-cyan/5 border-aura-cyan/20"
                    : "bg-white/[0.02] border-white/8"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  mission.completed
                    ? "bg-aura-cyan/20 text-aura-cyan"
                    : "bg-white/5 text-slate-400"
                }`}>
                  {mission.completed ? <CheckCircle2 className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    mission.completed ? "text-aura-cyan line-through" : "text-white/90"
                  }`}>
                    {mission.title}
                  </p>
                  {mission.description && (
                    <p className="text-xs text-slate-500 truncate">{mission.description}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-aura-purple shrink-0">
                  +{mission.xpReward} XP
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
            <Target className="w-8 h-8 text-white/10 mb-3" />
            <p className="text-sm font-medium text-slate-400">Sin misiones activas</p>
            <p className="text-xs text-slate-500 mt-1">Tus nuevas misiones aparecerán aquí pronto.</p>
          </div>
        )}
      </div>
    </div>
  );
}
