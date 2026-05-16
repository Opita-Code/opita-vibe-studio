// ─── Mission Tracker ───────────────────────────────────────────
//
// Subscribes to VibeEventBus and auto-validates missions
// by matching events against completionCriteria.
// Maintains session-local progress counters per mission.
//

import { vibeEvents, type VibeEvent } from "@/lib/vibe-events";
import { useGamificationStore } from "@/stores/gamification";

/** Per-mission event counters for the current session */
let missionProgress = new Map<string, number>();

/** Timestamps of first event per mission (for `within` criteria) */
let missionFirstEvent = new Map<string, number>();

const STORAGE_KEY = "vibe_mission_tracker";

// Load from localStorage on init
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const data = JSON.parse(saved);
    missionProgress = new Map(Object.entries(data.progress || {}));
    missionFirstEvent = new Map(Object.entries(data.firstEvent || {}));
  }
} catch (e) {
  console.warn("Failed to load mission progress from localStorage", e);
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      progress: Object.fromEntries(missionProgress),
      firstEvent: Object.fromEntries(missionFirstEvent)
    }));
  } catch (e) {
    console.warn("Failed to save mission progress to localStorage", e);
  }
}

// ─── Core Logic ─────────────────────────────────────────────────

function matchesFilter(event: VibeEvent, filter?: Record<string, string>): boolean {
  if (!filter) return true;
  for (const [key, value] of Object.entries(filter)) {
    if ((event as any)[key] !== value) return false;
  }
  return true;
}

function handleEvent(event: VibeEvent): void {
  const store = useGamificationStore.getState();
  const { missions } = store;

  for (const mission of missions) {
    // Skip completed or missions without auto-criteria
    if (mission.completed || !mission.completionCriteria) continue;

    const criteria = mission.completionCriteria;

    // Check event type match
    if (criteria.eventType !== event.type) continue;

    // Check filter match
    if (!matchesFilter(event, criteria.filter)) continue;

    // Check time window
    if (criteria.within) {
      const firstEvent = missionFirstEvent.get(mission.id);
      if (!firstEvent) {
        missionFirstEvent.set(mission.id, Date.now());
      } else if (Date.now() - firstEvent > criteria.within) {
        // Window expired — reset progress
        missionProgress.set(mission.id, 0);
        missionFirstEvent.set(mission.id, Date.now());
        continue;
      }
    }

    // Increment progress
    const current = (missionProgress.get(mission.id) || 0) + 1;
    missionProgress.set(mission.id, current);

    // Calculate progress percentage
    const progressPercent = Math.min(100, Math.round((current / criteria.count) * 100));

    // Update mission progress in store (optimistic UI update)
    store.updateMissionProgress(mission.id, progressPercent);

    // Check if mission is complete
    if (current >= criteria.count) {
      // Auto-complete! 🎉
      store.completeMission(mission.id);
      // Clean up tracking
      missionProgress.delete(mission.id);
      missionFirstEvent.delete(mission.id);
    }
    
    saveProgress();
  }
}

// ─── Lifecycle ──────────────────────────────────────────────────

let unsubscribe: (() => void) | null = null;

/**
 * Start tracking events for mission auto-completion.
 * Call once when the gamification system initializes.
 */
export function startMissionTracker(): void {
  if (unsubscribe) return; // Already tracking
  unsubscribe = vibeEvents.on("*", handleEvent);
}

export function stopMissionTracker(): void {
  unsubscribe?.();
  unsubscribe = null;
}

/**
 * Reset progress counters (e.g., when new missions are loaded).
 */
export function resetMissionProgress(): void {
  missionProgress.clear();
  missionFirstEvent.clear();
  saveProgress();
}

/**
 * Get current progress for a specific mission (0-based count).
 */
export function getMissionProgress(missionId: string): number {
  return missionProgress.get(missionId) || 0;
}
