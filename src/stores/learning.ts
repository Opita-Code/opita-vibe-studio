import { create } from "zustand";
import type { LearningTip, LearningEvent } from "@/lib/types";

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
      set({
        currentTip: tip,
        isVisible: true,
        shownTips: [...shownTips, tip.id],
        tipQueue: tipQueue.filter((t) => t.id !== tip.id),
      });
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

  markTipShown: (tipId) =>
    set((state) => ({
      shownTips: [...state.shownTips, tipId],
    })),

  addEvent: (event) =>
    set((state) => ({
      learningEvents: [...state.learningEvents, event],
    })),

  hasTipBeenShown: (tipId) => get().shownTips.includes(tipId),
}));
