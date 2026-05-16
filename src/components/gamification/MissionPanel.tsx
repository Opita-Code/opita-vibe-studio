import { motion, AnimatePresence } from "framer-motion";
import { useGamificationStore } from "@/stores/gamification";
import { useAuthStore } from "@/stores/auth";
import { StreakFlame } from "./StreakFlame";
import { useEffect, useState } from "react";
import type { Mission } from "@/lib/types";

import { BookOpen, Hammer, Telescope, Sparkles, X, Target, Check } from "lucide-react";

const TYPE_ICONS: Record<string, { Icon: any; color: string; label: string }> = {
  aprender: { Icon: BookOpen, color: "from-blue-500/20 to-blue-600/10 text-blue-400", label: "Aprender" },
  construir: { Icon: Hammer, color: "from-emerald-500/20 to-emerald-600/10 text-emerald-400", label: "Construir" },
  explorar: { Icon: Telescope, color: "from-amber-500/20 to-amber-600/10 text-amber-400", label: "Explorar" },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  novato: { label: "Novato", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  intermedio: { label: "Intermedio", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  avanzado: { label: "Avanzado", color: "text-red-400 bg-red-500/10 border-red-500/20" },
};

// ─── Progress Ring ──────────────────────────────────────────────

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const size = 72;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - percent);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background ring */}
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white/90 tabular-nums">{completed}/{total}</span>
        <span className="text-[8px] text-white/30 uppercase tracking-wider">misiones</span>
      </div>
    </div>
  );
}

// ─── Mission Card ───────────────────────────────────────────────

function MissionCard({ mission }: { mission: Mission }) {
  const config = TYPE_ICONS[mission.type] || TYPE_ICONS.aprender;
  const difficulty = DIFFICULTY_LABELS[mission.difficulty] || DIFFICULTY_LABELS.novato;
  const progress = mission.progress ?? 0;
  const criteriaCount = mission.completionCriteria?.count ?? 1;
  const currentCount = Math.round((progress / 100) * criteriaCount);
  const hasAutoValidation = !!mission.completionCriteria;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all ${
        mission.completed
          ? "bg-white/[0.02] border-white/5"
          : "bg-gradient-to-br border-white/10 hover:border-white/20"
      } ${!mission.completed ? config.color : ""}`}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border ${mission.completed ? "bg-white/5 border-white/5 text-emerald-500/50" : `bg-gradient-to-br ${config.color} border-white/10`}`}>
              {mission.completed ? <Check size={16} strokeWidth={3} /> : <config.Icon size={16} strokeWidth={2.5} />}
            </div>
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

        {/* Progress bar (for auto-validated missions) */}
        {hasAutoValidation && !mission.completed && (
          <div className="flex flex-col gap-1.5">
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-aura-cyan to-aura-purple"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30 tabular-nums">
                {currentCount}/{criteriaCount}
              </span>
              <span className="text-[10px] text-white/20">
                {progress === 0 ? "Pendiente" : progress < 100 ? "En progreso..." : "¡Completando!"}
              </span>
            </div>
          </div>
        )}

        {/* Footer: Rewards */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-medium ${mission.completed ? "text-white/20" : "text-aura-cyan/70"}`}>
              +{mission.xpReward} XP
            </span>
            <span className={`text-[11px] font-medium ${mission.completed ? "text-white/20" : "text-emerald-400/70"}`}>
              +{(mission.quotaReward / 1000).toFixed(0)}K quota
            </span>
          </div>

          {/* Auto badge */}
          {hasAutoValidation && !mission.completed && (
            <span className="text-[9px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-aura-cyan/40 animate-pulse" />
              Auto
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Mission Complete Toast ─────────────────────────────────────

function MissionCompleteToast({ mission, onDismiss }: { mission: Mission; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      id="gamification-toast"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100]"
    >
      <div className="bg-obsidian-900/95 backdrop-blur-xl border border-aura-cyan/30 rounded-2xl px-5 py-3 shadow-[0_0_40px_rgba(6,182,212,0.2)] flex items-center gap-3">
        <motion.div
          className="p-2 rounded-full bg-aura-cyan/20 text-aura-cyan"
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10, delay: 0.1 }}
        >
          <Sparkles size={24} strokeWidth={2.5} />
        </motion.div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-aura-cyan to-aura-purple">
            ¡Misión completada!
          </span>
          <span className="text-xs text-white/50">{mission.title}</span>
        </div>
        <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
          <span className="text-xs font-bold text-aura-cyan">+{mission.xpReward} XP</span>
          <span className="text-xs font-bold text-emerald-400">+{(mission.quotaReward / 1000).toFixed(0)}K</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────

/**
 * MissionPanel — Side panel showing daily missions, XP stats, and streak.
 * Opens from the ActivityBar as a slide-out panel.
 * Features auto-validated missions with real-time progress tracking.
 */
export function MissionPanel() {
  const {
    missionPanelOpen,
    setMissionPanelOpen,
    missions,
    profile,
    fetchProfile,
    fetchMissions,
    progressPercent,
    xpRemaining,
  } = useGamificationStore();
  const { authMode } = useAuthStore();

  // Track recently completed missions for celebration toast
  const [completedToast, setCompletedToast] = useState<Mission | null>(null);
  const [prevCompletedIds, setPrevCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (missionPanelOpen && authMode === "authenticated") {
      fetchProfile();
      fetchMissions();
    }
  }, [missionPanelOpen, authMode]);

  // Detect newly completed missions for toast
  useEffect(() => {
    const currentCompleted = new Set(missions.filter(m => m.completed).map(m => m.id));
    for (const id of currentCompleted) {
      if (!prevCompletedIds.has(id)) {
        const mission = missions.find(m => m.id === id);
        if (mission && prevCompletedIds.size > 0) {
          setCompletedToast(mission);
        }
      }
    }
    setPrevCompletedIds(currentCompleted);
  }, [missions]);

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
    <>
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
              className="fixed left-12 top-0 bottom-0 w-80 bg-obsidian-900/95 backdrop-blur-xl border-r border-white/5 z-[85] flex flex-col overflow-hidden"
            >
              {/* Header with Progress Ring */}
              <div className="p-4 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target size={20} className="text-aura-cyan" />
                    <h2 className="text-sm font-bold text-white/90">Misiones Diarias</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {profile && <StreakFlame streakDays={profile.streakDays} />}
                    <button
                      onClick={() => setMissionPanelOpen(false)}
                      className="text-white/30 hover:text-white/60 transition-colors"
                      aria-label="Cerrar panel de misiones"
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* Progress Ring + XP Summary */}
                {profile && (
                  <div className="flex items-center gap-4">
                    <ProgressRing completed={completedCount} total={totalCount} />
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/50">Nivel {profile.level}</span>
                        <span className="text-[10px] text-white/30 tabular-nums">
                          {xpRemaining} XP para Lv.{profile.level + 1}
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
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30">
                          Quota: {(profile.effectiveDailyQuota / 1000).toFixed(0)}K tokens
                        </span>
                        <span className="text-[10px] text-emerald-400/60 font-medium">
                          {completedCount === totalCount && totalCount > 0
                            ? "🎉 ¡Todas completadas!"
                            : `${completedCount}/${totalCount} completadas`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-validation banner */}
              {authMode === "authenticated" && missions.some(m => m.completionCriteria && !m.completed) && (
                <div className="px-4 py-2 border-b border-white/5 flex-shrink-0">
                  <div className="flex items-center gap-2 text-[10px] text-white/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-aura-cyan/50 animate-pulse" />
                    Las misiones se completan automáticamente al realizar las acciones
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

      {/* Mission Complete Toast — shows outside panel */}
      <AnimatePresence>
        {completedToast && (
          <MissionCompleteToast
            mission={completedToast}
            onDismiss={() => setCompletedToast(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
