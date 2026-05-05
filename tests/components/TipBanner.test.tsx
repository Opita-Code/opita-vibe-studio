import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TipBanner } from "../../src/components/learning/TipBanner";
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
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const sampleTip: LearningTip = {
  id: "test-tip",
  concept: "test",
  question: "¿Sabías que...? Esto es una prueba.",
  explanation: "Esta es una explicación detallada de la prueba.",
  tags: ["test"],
};

/**
 * Crea un tip en la store (simula lo que hace pushTip pero sin efectos colaterales).
 */
function setupTip() {
  useLearningStore.setState({
    isVisible: true,
    currentTip: sampleTip,
  });
}

describe("TipBanner", () => {
  it("should not render when no tip is visible", () => {
    render(<TipBanner />);
    expect(screen.queryByText(/¿Sabías que/)).toBeNull();
  });

  it("should render the tip question when visible", () => {
    setupTip();
    render(<TipBanner />);
    expect(screen.getByText(/¿Sabías que/)).toBeDefined();
  });

  it("should show explanation when clicking 'Quiero saber más'", () => {
    setupTip();
    render(<TipBanner />);

    const learnMore = screen.getByText(/Quiero saber más/);
    fireEvent.click(learnMore);

    expect(screen.getByText(/explicación detallada/)).toBeDefined();
  });

  it("should dismiss tip when clicking 'Entendido'", () => {
    setupTip();
    render(<TipBanner />);

    fireEvent.click(screen.getByText(/Entendido/));

    expect(screen.queryByText(/¿Sabías que/)).toBeNull();
  });

  it("should auto-dismiss after 8 seconds", () => {
    setupTip();
    render(<TipBanner />);
    expect(screen.getByText(/¿Sabías que/)).toBeDefined();

    // Fast-forward just past 8 seconds
    act(() => {
      vi.advanceTimersByTime(8100);
    });

    expect(screen.queryByText(/¿Sabías que/)).toBeNull();
  });

  it("should render emoji indicator", () => {
    setupTip();
    render(<TipBanner />);
    expect(screen.getByText("💡")).toBeDefined();
  });
});
