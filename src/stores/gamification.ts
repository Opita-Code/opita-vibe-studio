import { create } from "zustand";
import type {
  GamificationProfile,
  Mission,
  MilestoneProgress,
} from "@/lib/types";
import { startMissionTracker, stopMissionTracker, resetMissionProgress } from "@/lib/mission-tracker";
import {
  calculateLevel,
  levelProgress,
  xpToNextLevel,
  MILESTONES,
  QUOTA_DECAY_FLOOR,
  getDifficulty,
} from "@/lib/xp-constants";
import { useAuthStore } from "./auth";

// ─── Types ──────────────────────────────────────────────────────

interface GamificationState {
  profile: GamificationProfile | null;
  missions: Mission[];
  milestones: MilestoneProgress[];
  isLoading: boolean;
  missionPanelOpen: boolean;
  /** Computed: progress percentage to next level */
  progressPercent: number;
  /** Computed: XP needed for next level */
  xpRemaining: number;
  /** Milestone toast queue */
  pendingMilestone: { level: number; badge: string; label: string; quotaBoost: number } | null;
  /** Prevent double-click on mission complete */
  completingMissionId: string | null;
  /** Event payload to trigger the particle physics overlay */
  xpBurstEvent: { id: string; amount: number } | null;
}

interface GamificationActions {
  fetchProfile: () => Promise<void>;
  fetchMissions: () => Promise<void>;
  completeMission: (missionId: string) => Promise<void>;
  setMissionPanelOpen: (open: boolean) => void;
  /** Called after chat message to award passive XP */
  awardPassiveXP: (action: string) => void;
  /** Dismiss milestone toast */
  dismissMilestone: () => void;
  /** Update real-time progress for a mission (called by MissionTracker) */
  updateMissionProgress: (missionId: string, progress: number) => void;
  /** Initialize event tracking for auto-validated missions */
  initTracker: () => void;
  /** Cleanup event tracking */
  destroyTracker: () => void;
  /** Trigger a particle burst animation for the XP bar */
  triggerXPBurst: (amount: number) => void;
  /** Clear the particle burst event */
  clearXPBurst: (id: string) => void;
}

export type GamificationStore = GamificationState & GamificationActions;

// ─── API Helper ─────────────────────────────────────────────────

function getApiUrl(): string {
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");
  return isLocalhost
    ? "http://localhost:3000"
    : "https://api.opitacode.com";
}

async function gamificationFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const authState = useAuthStore.getState();
  const token = authState.session?.token;

  return fetch(`${getApiUrl()}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

// ─── Store ──────────────────────────────────────────────────────

export const useGamificationStore = create<GamificationStore>((set, get) => ({
  profile: null,
  missions: [],
  milestones: [],
  isLoading: false,
  missionPanelOpen: false,
  progressPercent: 0,
  xpRemaining: 0,
  pendingMilestone: null,
  completingMissionId: null,
  xpBurstEvent: null,

  setMissionPanelOpen: (open) => set({ missionPanelOpen: open }),
  dismissMilestone: () => set({ pendingMilestone: null }),
  triggerXPBurst: (amount) => set({ xpBurstEvent: { id: Date.now().toString(), amount } }),
  clearXPBurst: (id) => set((state) => (state.xpBurstEvent?.id === id ? { xpBurstEvent: null } : state)),

  updateMissionProgress: (missionId, progress) => {
    set((state) => ({
      missions: state.missions.map((m) =>
        m.id === missionId ? { ...m, progress } : m,
      ),
    }));
  },

  initTracker: () => startMissionTracker(),
  destroyTracker: () => stopMissionTracker(),

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const res = await gamificationFetch("/gamification");
      if (!res.ok) return;
      const data = await res.json();

      const profile: GamificationProfile = {
        totalXp: data.totalXp ?? 0,
        level: data.level ?? calculateLevel(data.totalXp ?? 0),
        streakDays: data.streakDays ?? 0,
        lastActiveDate: data.lastActiveDate ?? "",
        earnedQuota: data.earnedQuota ?? 0,
        effectiveDailyQuota: data.effectiveDailyQuota ?? 150_000,
      };

      const milestones: MilestoneProgress[] = MILESTONES.map((m) => ({
        level: m.level,
        badge: m.badge,
        label: m.label,
        unlocked: profile.level >= m.level,
        unlockedAt: data.milestones?.[m.level]?.unlockedAt,
        reward: m.reward,
      }));

      set({
        profile,
        milestones,
        progressPercent: levelProgress(profile.totalXp),
        xpRemaining: xpToNextLevel(profile.totalXp),
      });
    } catch {
      // Non-critical — gamification is optional
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMissions: async () => {
    try {
      const profile = get().profile;
      const plan = useAuthStore.getState().plan;
      const difficulty = getDifficulty(profile?.level ?? 0);
      const floor =
        QUOTA_DECAY_FLOOR[plan as keyof typeof QUOTA_DECAY_FLOOR] ??
        QUOTA_DECAY_FLOOR.free;

      const res = await gamificationFetch("/gamification/missions", {
        method: "POST",
        body: JSON.stringify({
          difficulty,
          quotaFloor: floor,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      resetMissionProgress();
      set({ missions: data.missions ?? [] });
    } catch {
      // Non-critical
    }
  },

  completeMission: async (missionId: string) => {
    // Guard against double-clicks
    if (get().completingMissionId === missionId) return;
    set({ completingMissionId: missionId });

    try {
      const res = await gamificationFetch(
        `/gamification/missions/${missionId}/complete`,
        { method: "POST" },
      );
      if (!res.ok) return;
      const data = await res.json();

      // Update local state optimistically
      set((state) => ({
        missions: state.missions.map((m) =>
          m.id === missionId
            ? { ...m, completed: true, completedAt: new Date().toISOString() }
            : m,
        ),
      }));

      // Trigger XP Particles
      if (data.xpAwarded) {
        get().triggerXPBurst(data.xpAwarded);
      }

      // Show milestone toast if leveled up to a milestone
      if (data.newMilestone) {
        set({
          pendingMilestone: {
            level: data.newMilestone.level,
            badge: data.newMilestone.badge,
            label: data.newMilestone.label,
            quotaBoost: data.quotaAwarded,
          },
        });
      }

      // Always refresh profile to get updated XP, level, and quota
      await get().fetchProfile();

      // Refresh token usage if quota increased
      if (data.quotaAwarded) {
        useAuthStore.getState().fetchTokenUsage();
      }
    } catch {
      // Non-critical
    } finally {
      set({ completingMissionId: null });
    }
  },

  awardPassiveXP: (() => {
    // Debounce: max 1 passive XP call per 30 seconds
    let lastCall = 0;
    return (action: string) => {
      const now = Date.now();
      if (now - lastCall < 30_000) return;
      lastCall = now;
      gamificationFetch("/gamification/xp/award", {
        method: "POST",
        body: JSON.stringify({ action }),
      }).catch(() => {});
    };
  })(),
}));
