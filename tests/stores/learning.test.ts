import { describe, it, expect, beforeEach } from "vitest";
import { useLearningStore } from "../../src/stores/learning";
import type { LearningTip } from "../../src/lib/types";

beforeEach(() => {
  useLearningStore.setState({
    shownTips: [],
    tipQueue: [],
    learningEvents: [],
    isVisible: false,
    currentTip: null,
  });
});

describe("LearningStore", () => {
  const tip: LearningTip = {
    id: "flexbox-1",
    concept: "flexbox",
    question: "¿Sabías que flexbox...?",
    explanation: "Flexbox organiza elementos en filas o columnas.",
    tags: ["css", "layout"],
  };

  it("should push a tip and auto-show it", () => {
    useLearningStore.getState().pushTip(tip);
    const state = useLearningStore.getState();
    expect(state.isVisible).toBe(true);
    expect(state.currentTip?.id).toBe("flexbox-1");
  });

  it("should not show a tip that was already shown", () => {
    useLearningStore.getState().markTipShown("flexbox-1");
    useLearningStore.getState().pushTip(tip);
    expect(useLearningStore.getState().isVisible).toBe(false);
  });

  it("should dismiss tip and clear visibility", () => {
    useLearningStore.getState().pushTip(tip);
    useLearningStore.getState().dismissTip();
    const state = useLearningStore.getState();
    expect(state.isVisible).toBe(false);
    expect(state.currentTip).toBeNull();
  });

  it("should add a learning event", () => {
    const event = { type: "file_created", concept: "flexbox", timestamp: Date.now() };
    useLearningStore.getState().addEvent(event);
    expect(useLearningStore.getState().learningEvents).toHaveLength(1);
    expect(useLearningStore.getState().learningEvents[0].concept).toBe("flexbox");
  });

  it("should track shown tips", () => {
    expect(useLearningStore.getState().hasTipBeenShown("flexbox-1")).toBe(false);
    useLearningStore.getState().markTipShown("flexbox-1");
    expect(useLearningStore.getState().hasTipBeenShown("flexbox-1")).toBe(true);
  });
});
