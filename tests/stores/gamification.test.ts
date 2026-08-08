import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGamificationStore } from "@/stores/gamification";
import { useAuthStore } from "@/stores/auth";
import { MILESTONES } from "@/lib/xp-constants";
import type { Mission } from "@/lib/types";

const { startMissionTracker, stopMissionTracker, resetMissionProgress } = vi.hoisted(() => ({
  startMissionTracker: vi.fn(),
  stopMissionTracker: vi.fn(),
  resetMissionProgress: vi.fn(),
}));
vi.mock("@/lib/mission-tracker", () => ({
  startMissionTracker,
  stopMissionTracker,
  resetMissionProgress,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function okJson(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

const makeMission = (id: string): Mission => ({
  id,
  type: "construir",
  title: "Título",
  description: "Descripción",
  xpReward: 20,
  quotaReward: 100,
  difficulty: "novato",
  completed: false,
  progress: 0,
});

const reset = () => {
  useGamificationStore.setState({
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
  });
};

beforeEach(() => {
  reset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(okJson({}));
  vi.clearAllMocks();
  useAuthStore.setState({
    authMode: "authenticated",
    session: { token: "jwt-token", expiresAt: Date.now() + 3600_000 },
    plan: "free",
  });
});

describe("GamificationStore — simple actions", () => {
  it("should toggle the mission panel", () => {
    useGamificationStore.getState().setMissionPanelOpen(true);
    expect(useGamificationStore.getState().missionPanelOpen).toBe(true);
  });

  it("should dismiss the milestone toast", () => {
    useGamificationStore.setState({
      pendingMilestone: { level: 2, badge: "b", label: "l", quotaBoost: 100 },
    });
    useGamificationStore.getState().dismissMilestone();
    expect(useGamificationStore.getState().pendingMilestone).toBeNull();
  });

  it("should trigger and clear the XP burst event", () => {
    const s = useGamificationStore.getState();
    s.triggerXPBurst(50);
    const event = useGamificationStore.getState().xpBurstEvent;
    expect(event?.amount).toBe(50);

    s.clearXPBurst(event!.id);
    expect(useGamificationStore.getState().xpBurstEvent).toBeNull();

    s.triggerXPBurst(10);
    s.clearXPBurst("wrong-id");
    expect(useGamificationStore.getState().xpBurstEvent).not.toBeNull();
  });

  it("should update a mission's progress", () => {
    useGamificationStore.setState({ missions: [makeMission("m1")] });
    useGamificationStore.getState().updateMissionProgress("m1", 5);
    expect(useGamificationStore.getState().missions[0].progress).toBe(5);
  });

  it("should start/stop the mission tracker", () => {
    useGamificationStore.getState().initTracker();
    expect(startMissionTracker).toHaveBeenCalled();
    useGamificationStore.getState().destroyTracker();
    expect(stopMissionTracker).toHaveBeenCalled();
  });
});

describe("GamificationStore — fetchProfile", () => {
  it("should load the profile, milestones and level math", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ totalXp: 250, level: 3, streakDays: 2, earnedQuota: 100, milestones: { 3: { unlockedAt: "t" } } }),
    );

    await useGamificationStore.getState().fetchProfile();

    const state = useGamificationStore.getState();
    expect(state.profile?.totalXp).toBe(250);
    expect(state.profile?.level).toBe(3);
    expect(state.milestones).toHaveLength(MILESTONES.length);
    expect(state.isLoading).toBe(false);
    expect(state.progressPercent).toBeGreaterThanOrEqual(0);
  });

  it("should keep defaults when the API returns partial data", async () => {
    fetchMock.mockResolvedValueOnce(okJson({}));

    await useGamificationStore.getState().fetchProfile();

    const profile = useGamificationStore.getState().profile!;
    expect(profile.totalXp).toBe(0);
    expect(profile.level).toBe(0);
    expect(profile.effectiveDailyQuota).toBe(150_000);
  });

  it("should not update state on non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await useGamificationStore.getState().fetchProfile();
    expect(useGamificationStore.getState().profile).toBeNull();
  });

  it("should swallow fetch errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(useGamificationStore.getState().fetchProfile()).resolves.toBeUndefined();
    expect(useGamificationStore.getState().isLoading).toBe(false);
  });
});

describe("GamificationStore — fetchMissions", () => {
  it("should load missions and reset tracker progress", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ missions: [{ id: "m1" }] }));

    await useGamificationStore.getState().fetchMissions();

    expect(resetMissionProgress).toHaveBeenCalled();
    expect(useGamificationStore.getState().missions).toEqual([{ id: "m1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/gamification/missions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should not update missions on non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await useGamificationStore.getState().fetchMissions();
    expect(useGamificationStore.getState().missions).toEqual([]);
  });

  it("should swallow fetch errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(useGamificationStore.getState().fetchMissions()).resolves.toBeUndefined();
  });
});

describe("GamificationStore — completeMission", () => {
  it("should guard against double-clicks", async () => {
    useGamificationStore.setState({ completingMissionId: "m1" });
    await useGamificationStore.getState().completeMission("m1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should complete a mission, award XP, show milestone and refresh profile", async () => {
    useGamificationStore.setState({ missions: [makeMission("m1")] });
    const fetchTokenUsageSpy = vi
      .spyOn(useAuthStore.getState(), "fetchTokenUsage")
      .mockResolvedValue(undefined);
    fetchMock.mockResolvedValueOnce(
      okJson({
        xpAwarded: 40,
        newMilestone: { level: 4, badge: "badge", label: "Label" },
        quotaAwarded: 500,
      }),
    );

    await useGamificationStore.getState().completeMission("m1");

    const state = useGamificationStore.getState();
    expect(state.missions[0].completed).toBe(true);
    expect(state.completingMissionId).toBeNull();
    expect(state.xpBurstEvent?.amount).toBe(40);
    expect(state.pendingMilestone).toEqual({ level: 4, badge: "badge", label: "Label", quotaBoost: 500 });
    expect(fetchTokenUsageSpy).toHaveBeenCalled();
  });

  it("should still refresh profile on completion without awards", async () => {
    useGamificationStore.setState({ missions: [makeMission("m1")] });
    fetchMock
      .mockResolvedValueOnce(okJson({}))
      .mockResolvedValueOnce(okJson({ totalXp: 10 }));

    await useGamificationStore.getState().completeMission("m1");

    const state = useGamificationStore.getState();
    expect(state.xpBurstEvent).toBeNull();
    expect(state.pendingMilestone).toBeNull();
    expect(state.profile?.totalXp).toBe(10);
  });

  it("should not mark complete on non-ok responses", async () => {
    useGamificationStore.setState({ missions: [makeMission("m1")] });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    await useGamificationStore.getState().completeMission("m1");

    expect(useGamificationStore.getState().missions[0].completed).toBe(false);
  });

  it("should swallow errors and clear the guard", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(useGamificationStore.getState().completeMission("m1")).resolves.toBeUndefined();
    expect(useGamificationStore.getState().completingMissionId).toBeNull();
  });
});

describe("GamificationStore — awardPassiveXP", () => {
  it("should debounce to one award per 30 seconds", async () => {
    vi.useFakeTimers();
    try {
      useGamificationStore.getState().awardPassiveXP("chat_message");
      await vi.advanceTimersByTimeAsync(0); // let the award fetch + profile refresh settle
      const afterFirst = fetchMock.mock.calls.length;
      expect(afterFirst).toBeGreaterThanOrEqual(1);

      // Second immediate call is debounced — no new fetch
      useGamificationStore.getState().awardPassiveXP("chat_message");
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock.mock.calls.length).toBe(afterFirst);

      // After 30s the debounce window resets and a new award fires
      await vi.advanceTimersByTimeAsync(31_000);
      useGamificationStore.getState().awardPassiveXP("chat_message");
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirst);
    } finally {
      vi.useRealTimers();
    }
  });
});
