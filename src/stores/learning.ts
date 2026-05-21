import { create } from "zustand";
import type { LearningTip, LearningEvent } from "@/lib/types";
import { storageBackend, syncEngine } from "@/lib/memory";
import { useAuthStore } from "@/stores/auth";

// ─── Persistence Helpers ────────────────────────────────────────

async function persistLearningEvents(events: LearningEvent[]) {
  try {
    const timestamp = Date.now();
    await storageBackend.set("sync:events", JSON.stringify({ value: events, timestamp }));
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      syncEngine.push(userId).catch((err: unknown) => {
        console.warn("Background learning events sync failed:", err);
      });
    }
  } catch (err: unknown) {
    console.error("Failed to persist learning events:", err);
  }
}

async function persistShownTips(shownTips: string[]) {
  try {
    const timestamp = Date.now();
    await storageBackend.set("sync:shownTips", JSON.stringify({ value: shownTips, timestamp }));
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      syncEngine.push(userId).catch((err: unknown) => {
        console.warn("Background shown tips sync failed:", err);
      });
    }
  } catch (err: unknown) {
    console.error("Failed to persist shown tips:", err);
  }
}

// ─── State ─────────────────────────────────────────────────────

interface LearningState {
  shownTips: string[];
  tipQueue: LearningTip[];
  learningEvents: LearningEvent[];
  isVisible: boolean;
  currentTip: LearningTip | null;
}

// ─── Actions ───────────────────────────────────────────────────

interface LearningActions {
  pushTip: (tip: LearningTip) => void;
  showNext: () => void;
  dismissTip: () => void;
  markTipShown: (tipId: string) => void;
  addEvent: (event: LearningEvent) => void;
  hasTipBeenShown: (tipId: string) => boolean;
  hydrateLearningStore: (events: LearningEvent[], shownTips: string[]) => void;
}

// ─── Store ─────────────────────────────────────────────────────

export type LearningStore = LearningState & LearningActions;

export const useLearningStore = create<LearningStore>((set, get) => ({
  shownTips: [],
  tipQueue: [],
  learningEvents: [],
  isVisible: false,
  currentTip: null,

  pushTip: (tip) => {
    const { shownTips } = get();
    if (shownTips.includes(tip.id)) return; // already shown
    set((state) => ({
      tipQueue: [...state.tipQueue, tip],
    }));
    // Auto-show if nothing is currently visible
    if (!get().isVisible) {
      get().showNext();
    }
  },

  showNext: () => {
    const { tipQueue, shownTips } = get();
    // Find first unshown tip in queue
    const tip = tipQueue.find((t) => !shownTips.includes(t.id));
    if (tip) {
      const nextShownTips = [...shownTips, tip.id];
      set({
        currentTip: tip,
        isVisible: true,
        shownTips: nextShownTips,
        tipQueue: tipQueue.filter((t) => t.id !== tip.id),
      });
      persistShownTips(nextShownTips).catch(console.error);
    }
  },

  dismissTip: () => {
    set({ isVisible: false, currentTip: null });
    // After dismissing, show next if any remain
    const { tipQueue, shownTips } = get();
    const next = tipQueue.find((t) => !shownTips.includes(t.id));
    if (next) {
      // Use setTimeout to avoid React batching issues
      setTimeout(() => get().showNext(), 500);
    }
  },

  markTipShown: (tipId) => {
    const nextShownTips = [...get().shownTips, tipId];
    set({ shownTips: nextShownTips });
    persistShownTips(nextShownTips).catch(console.error);
  },

  addEvent: (event) => {
    const MAX_EVENTS = 500;
    let nextEvents = [...get().learningEvents, event];
    // P1 fix: cap events to prevent unbounded storage growth
    if (nextEvents.length > MAX_EVENTS) {
      nextEvents = nextEvents.slice(-MAX_EVENTS);
    }
    set({ learningEvents: nextEvents });
    persistLearningEvents(nextEvents).catch(console.error);
  },

  hasTipBeenShown: (tipId) => get().shownTips.includes(tipId),

  hydrateLearningStore: (events, shownTips) =>
    set({ learningEvents: events, shownTips }),
}));
