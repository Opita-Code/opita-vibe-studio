import { motion, AnimatePresence } from "framer-motion";
import { useGamificationStore } from "@/stores/gamification";
import { useAuthStore } from "@/stores/auth";
import { StreakIndicator } from "./StreakIndicator";
import { useEffect } from "react";
import type { Mission } from "@/lib/types";

const TYPE_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  aprender: { icon: "📖", color: "from-blue-500/20 to-blue-600/10", label: "Aprender" },
  construir: { icon: "🔨", color: "from-emerald-500/20 to-emerald-600/10", label: "Construir" },
  explorar: { icon: "🔍", color: "from-amber-500/20 to-amber-600/10", label: "Explorar" },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  novato: { label: "Novato", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  intermedio: { label: "Intermedio", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  avanzado: { label: "Avanzado", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

function MissionCard({ mission, onComplete, isCompleting }: { mission: Mission; onComplete: (id: string) => void; isCompleting: boolean }) {
  const config = TYPE_ICONS[mission.type] || TYPE_ICONS.aprender;
  const difficulty = DIFFICULTY_LABELS[mission.difficulty] || DIFFICULTY_LABELS.novato;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        mission.completed
          ? "bg-white/[0.02] border-white/5 opacity-60"
          : "bg-gradient-to-br border-white/10 hover:border-white/20"
      } ${!mission.completed ? config.color : ""}`}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0" role="img" aria-hidden="true">
              {mission.completed ? "✅" : config.icon}
            </span>
            <div className="min-w-0">
              <h4 className={`text-sm font-semibold truncate ${mission.completed ? "text-white/40 line-through" : "text-white/90"}`}>
                {mission.title}
              </h4>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${difficulty.color}`}>
                {difficulty.label}
              </span>
            </div>
          </div>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            mission.completed ? "bg-white/5 text-white/30" : "bg-white/5 text-white/60"
          }`}>
            {config.label}
          </span>
        </div>

        {/* Description */}
        <p className={`text-xs leading-relaxed ${mission.completed ? "text-white/25" : "text-white/50"}`}>
          {mission.description}
        </p>

        {/* Footer: Rewards + Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-medium ${mission.completed ? "text-white/20" : "text-aura-cyan/70"}`}>
              +{mission.xpReward} XP
            </span>
            <span className={`text-[11px] font-medium ${mission.completed ? "text-white/20" : "text-emerald-400/70"}`}>
              +{(mission.quotaReward / 1000).toFixed(0)}K quota
            </span>
          </div>

          {!mission.completed && (
            <button
              onClick={() => onComplete(mission.id)}
              disabled={isCompleting}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                isCompleting
                  ? "bg-white/5 text-white/30 border border-white/10 cursor-wait"
                  : "bg-aura-cyan/10 text-aura-cyan border border-aura-cyan/20 hover:bg-aura-cyan/20 hover:border-aura-cyan/40"
              }`}
            >
              {isCompleting ? "..." : "Completar"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * MissionPanel — Side panel showing daily missions, XP stats, and streak.
 * Opens from the ActivityBar as a slide-out panel.
 */
export function MissionPanel() {
  const {
    missionPanelOpen,
    setMissionPanelOpen,
    missions,
    profile,
    fetchProfile,
    fetchMissions,
    completeMission,
    progressPercent,
    xpRemaining,
    completingMissionId,
  } = useGamificationStore();
  const { authMode } = useAuthStore();

  useEffect(() => {
    if (missionPanelOpen && authMode === "authenticated") {
      fetchProfile();
      fetchMissions();
    }
  }, [missionPanelOpen, authMode]);

  // Escape key to close
  useEffect(() => {
    if (!missionPanelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMissionPanelOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [missionPanelOpen, setMissionPanelOpen]);

  const completedCount = missions.filter((m) => m.completed).length;
  const totalCount = missions.length;

  return (
    <AnimatePresence>
      {missionPanelOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[80]"
            onClick={() => setMissionPanelOpen(false)}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-12 top-0 bottom-0 w-80 bg-obsidian-950 border-r border-white/5 z-[85] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <h2 className="text-sm font-bold text-white/90">Misiones Diarias</h2>
              </div>
              <div className="flex items-center gap-3">
                {profile && <StreakIndicator streakDays={profile.streakDays} />}
                <button
                  onClick={() => setMissionPanelOpen(false)}
                  className="text-white/30 hover:text-white/60 transition-colors"
                  aria-label="Cerrar panel de misiones"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* XP Summary */}
            {profile && (
              <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/50">Nivel {profile.level}</span>
                  <span className="text-[10px] text-white/30 tabular-nums">
                    {xpRemaining} XP para nivel {profile.level + 1}
                  </span>
                </div>
                {/* Horizontal XP bar */}
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-aura-cyan to-aura-purple"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                {/* Quota info */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-white/30">
                    Quota diaria: {(profile.effectiveDailyQuota / 1000).toFixed(0)}K tokens
                  </span>
                  <span className="text-[10px] text-emerald-400/60 font-medium">
                    {completedCount}/{totalCount} completadas
                  </span>
                </div>
              </div>
            )}

            {/* Mission List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              {authMode !== "authenticated" ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <span className="text-2xl">🔒</span>
                  <p className="text-sm text-white/40">
                    Inicia sesión para desbloquear misiones diarias y ganar más quota.
                  </p>
                </div>
              ) : missions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
                  <span className="text-2xl">⏳</span>
                  <p className="text-sm text-white/40">
                    Cargando misiones...
                  </p>
                </div>
              ) : (
                missions.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onComplete={completeMission}
                    isCompleting={completingMissionId === mission.id}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-white/5 flex-shrink-0">
              <p className="text-[10px] text-white/20 text-center leading-relaxed">
                Completa misiones para ganar XP y aumentar tu quota diaria de tokens.
                Las misiones se renuevan cada día a medianoche UTC.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
