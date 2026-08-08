import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VibeEvent } from "@/lib/vibe-events";
import type { Mission } from "@/lib/types";

// ─── Mocks ───────────────────────────────────────────────────────

const { tracker, vibeOn, unsub } = vi.hoisted(() => {
  const updateMissionProgress = vi.fn();
  const completeMission = vi.fn();
  const unsub = vi.fn();
  const vibeOn = vi.fn((_type: string, _cb: unknown) => unsub);
  const tracker = {
    missions: [] as Mission[],
    updateMissionProgress,
    completeMission,
  };
  return { tracker, vibeOn, unsub };
});

vi.mock("@/lib/vibe-events", () => ({
  vibeEvents: { on: vibeOn },
}));

vi.mock("@/stores/gamification", () => ({
  useGamificationStore: {
    getState: () => tracker,
  },
}));

const STORAGE_KEY = "vibe_mission_tracker";

function makeMission(partial: Partial<Mission>): Mission {
  return {
    id: "m1",
    type: "construir",
    title: "Título",
    description: "Descripción",
    xpReward: 10,
    quotaReward: 50,
    difficulty: "novato",
    completed: false,
    ...partial,
  };
}

function event(type: string, extra: Record<string, string> = {}): VibeEvent {
  return { type, ...extra } as unknown as VibeEvent;
}

/** Loads the module fresh (it caches localStorage state at import time). */
async function load() {
  vi.resetModules();
  return await import("../../src/lib/mission-tracker");
}

/** Gets the event handler captured by vibeEvents.on. */
function getHandler(): (e: VibeEvent) => void {
  const call = vibeOn.mock.calls.find((c) => c[0] === "*");
  return call![1] as (e: VibeEvent) => void;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  unsub.mockClear();
  tracker.missions = [];
  vibeOn.mockImplementation((_type: string, _cb: unknown) => unsub);
});

describe("mission-tracker lifecycle", () => {
  it("should subscribe on start and guard against double subscription", async () => {
    const { startMissionTracker } = await load();
    startMissionTracker();
    startMissionTracker();
    expect(vibeOn).toHaveBeenCalledTimes(1);
  });

  it("should stop tracking and unsubscribe", async () => {
    const { startMissionTracker, stopMissionTracker } = await load();
    startMissionTracker();
    stopMissionTracker();
    expect(unsub).toHaveBeenCalled();
    stopMissionTracker(); // safe double-stop
  });

  it("should restore progress from localStorage on init", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ progress: { m1: 3 }, firstEvent: { m2: 12345 } }),
    );
    const { getMissionProgress } = await load();
    expect(getMissionProgress("m1")).toBe(3);
    expect(getMissionProgress("unknown")).toBe(0);
  });

  it("should warn and continue on malformed localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getMissionProgress } = await load();
    expect(getMissionProgress("m1")).toBe(0);
    warnSpy.mockRestore();
  });
});

describe("mission-tracker event handling", () => {
  it("should increment progress on a matching event", async () => {
    tracker.missions = [
      makeMission({ completionCriteria: { eventType: "file.change", count: 2 } }),
    ];
    const { startMissionTracker } = await load();
    startMissionTracker();
    const handler = getHandler();

    handler(event("file.change"));
    expect(tracker.updateMissionProgress).toHaveBeenCalledWith("m1", 50);

    handler(event("file.change"));
    expect(tracker.completeMission).toHaveBeenCalledWith("m1");
  });

  it("should skip completed missions and missions without criteria", async () => {
    tracker.missions = [
      makeMission({ completed: true, completionCriteria: { eventType: "file.change", count: 1 } }),
      makeMission({ id: "m2" }),
    ];
    const { startMissionTracker } = await load();
    startMissionTracker();
    const handler = getHandler();

    handler(event("file.change"));
    expect(tracker.updateMissionProgress).not.toHaveBeenCalled();
  });

  it("should skip on event type mismatch and filter mismatch", async () => {
    tracker.missions = [
      makeMission({
        completionCriteria: {
          eventType: "file.change",
          count: 1,
          filter: { path: "/a.ts" },
        },
      }),
    ];
    const { startMissionTracker } = await load();
    startMissionTracker();
    const handler = getHandler();

    handler(event("other.type"));
    expect(tracker.updateMissionProgress).not.toHaveBeenCalled();

    handler(event("file.change", { path: "/b.ts" }));
    expect(tracker.updateMissionProgress).not.toHaveBeenCalled();

    handler(event("file.change", { path: "/a.ts" }));
    expect(tracker.updateMissionProgress).toHaveBeenCalledWith("m1", 100);
    expect(tracker.completeMission).toHaveBeenCalledWith("m1");
  });

  it("should reset progress when the within-window expires", async () => {
    tracker.missions = [
      makeMission({
        completionCriteria: { eventType: "file.change", count: 5, within: 1000 },
      }),
    ];
    const { startMissionTracker } = await load();
    startMissionTracker();
    const handler = getHandler();

    vi.useFakeTimers();
    try {
      handler(event("file.change")); // first event, sets window start → 20%
      handler(event("file.change")); // within window → 40%
      expect(tracker.updateMissionProgress).toHaveBeenLastCalledWith("m1", 40);

      // Expire the window: progress resets internally (no store update)
      vi.setSystemTime(Date.now() + 2000);
      handler(event("file.change"));
      expect(tracker.updateMissionProgress).toHaveBeenLastCalledWith("m1", 40);

      // A fresh event after expiry restarts from 1/5
      handler(event("file.change"));
      expect(tracker.updateMissionProgress).toHaveBeenLastCalledWith("m1", 20);
    } finally {
      vi.useRealTimers();
    }
  });

  it("should persist progress to localStorage after events", async () => {
    tracker.missions = [
      makeMission({ completionCriteria: { eventType: "file.change", count: 2 } }),
    ];
    const { startMissionTracker } = await load();
    startMissionTracker();
    const handler = getHandler();

    handler(event("file.change"));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.progress.m1).toBe(1);
  });

  it("resetMissionProgress should clear counters and save", async () => {
    const { resetMissionProgress } = await load();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ progress: { m1: 5 }, firstEvent: {} }),
    );
    resetMissionProgress();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.progress).toEqual({});
    expect(saved.firstEvent).toEqual({});
  });
});
