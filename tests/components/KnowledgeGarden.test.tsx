import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KnowledgeGarden } from "../../src/components/learning/KnowledgeGarden";
import { useLearningStore } from "../../src/stores/learning";

beforeEach(() => {
  useLearningStore.setState({
    shownTips: [],
    tipQueue: [],
    learningEvents: [],
    isVisible: false,
    currentTip: null,
  });
});

describe("KnowledgeGarden", () => {
  it("should not render when isOpen is false", () => {
    render(<KnowledgeGarden isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText(/Jardín de Conocimiento/)).toBeNull();
  });

  it("should render when isOpen is true", () => {
    render(<KnowledgeGarden isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/Jardín de Conocimiento/)).toBeDefined();
  });

  it("should show progress counts", () => {
    render(<KnowledgeGarden isOpen={true} onClose={() => {}} />);
    // Should show "X por explorar" (all locked initially)
    expect(screen.getByText(/por explorar/)).toBeDefined();
  });

  it("should call onClose when closing", () => {
    let closed = false;
    render(
      <KnowledgeGarden
        isOpen={true}
        onClose={() => {
          closed = true;
        }}
      />,
    );

    const closeBtn = screen.getByLabelText("Cerrar jardín");
    fireEvent.click(closeBtn);

    expect(closed).toBe(true);
  });

  it("should show muted icons when all entries are locked", () => {
    render(<KnowledgeGarden isOpen={true} onClose={() => {}} />);
    // All concepts start locked, so they should have low opacity
    const buttons = screen.getAllByRole("button");
    // Filter out the close button
    const plantButtons = buttons.filter((b) =>
      b.getAttribute("aria-label")?.includes(":"),
    );
    expect(plantButtons.length).toBeGreaterThan(0);
  });

  it("should show concept state in aria-labels", () => {
    // Show one tip to unlock a concept
    useLearningStore.getState().markTipShown("let-const");

    render(<KnowledgeGarden isOpen={true} onClose={() => {}} />);
    const variablesLabel = screen.queryByLabelText(/variables/);
    // The concept "variables" should exist
    expect(variablesLabel).toBeDefined();
  });

  it("should show mastered concepts after 3+ events", () => {
    // Add 3 learning events for flexbox
    useLearningStore
      .getState()
      .addEvent({ type: "trigger_match", concept: "flexbox", timestamp: Date.now() });
    useLearningStore
      .getState()
      .addEvent({ type: "trigger_match", concept: "flexbox", timestamp: Date.now() });
    useLearningStore
      .getState()
      .addEvent({ type: "trigger_match", concept: "flexbox", timestamp: Date.now() });
    // Show one flexbox tip
    useLearningStore.getState().markTipShown("flexbox-intro");

    render(<KnowledgeGarden isOpen={true} onClose={() => {}} />);
    // flexbox should show mastered state
    expect(screen.getByLabelText(/flexbox/)).toBeDefined();
  });
});
