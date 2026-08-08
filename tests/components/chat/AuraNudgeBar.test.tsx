import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AuraNudgeBar } from "../../../src/components/chat/AuraNudgeBar";
import { useChatStore } from "../../../src/stores/chat";
import { useProjectStore } from "../../../src/stores/project";
import { usePurchaseIntentStore } from "../../../src/hooks/usePurchaseIntent";

vi.mock("../../../src/lib/aura-nudges", () => ({
  detectNudge: vi.fn(() => null),
  buildNudgeContext: vi.fn(() => ({ input: "", history: [], hasProject: false, maxMessages: 500 })),
}));

import * as nudgeModule from "../../../src/lib/aura-nudges";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useChatStore.setState({
    activeSessionId: "s1",
    sessions: { s1: { id: "s1", title: "t", messages: [], createdAt: 0, updatedAt: 0 } },
  } as never);
  useProjectStore.setState({ workspaces: [] } as never);
  usePurchaseIntentStore.setState({ forcedIntent: null, wompiModalOpen: false });
});

afterEach(() => {
  vi.useRealTimers();
});

function tick(ms = 400) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("AuraNudgeBar", () => {
  it("should render nothing when no nudge is detected", () => {
    render(<AuraNudgeBar inputText="hola" />);
    tick();
    expect(screen.queryByLabelText("Descartar sugerencia")).toBeNull();
  });

  it("should render a detected nudge with dismiss button", () => {
    vi.mocked(nudgeModule.detectNudge).mockReturnValue({ id: "n1", type: "tip", message: "Intenta usar más detalle" });
    render(<AuraNudgeBar inputText="haz una app" />);
    tick();
    expect(screen.getByText("Intenta usar más detalle")).toBeDefined();
    expect(screen.getByLabelText("Descartar sugerencia")).toBeDefined();
  });

  it("should clear the nudge when input becomes empty", () => {
    vi.mocked(nudgeModule.detectNudge).mockReturnValue({ id: "n1", type: "info", message: "Tip" });
    const { rerender } = render(<AuraNudgeBar inputText="algo" />);
    tick();
    expect(screen.getByText("Tip")).toBeDefined();
    rerender(<AuraNudgeBar inputText="" />);
    tick();
    expect(screen.queryByText("Tip")).toBeNull();
  });

  it("should dismiss a nudge and remember it", () => {
    vi.mocked(nudgeModule.detectNudge).mockReturnValue({ id: "n1", type: "tip", message: "Nudge descartado" });
    const { rerender } = render(<AuraNudgeBar inputText="texto" />);
    tick();
    fireEvent.click(screen.getByLabelText("Descartar sugerencia"));
    expect(screen.queryByText("Nudge descartado")).toBeNull();

    rerender(<AuraNudgeBar inputText="texto" />);
    tick();
    expect(screen.queryByText("Nudge descartado")).toBeNull();
  });

  it("should render a purchase nudge with an upgrade button when intent is set", () => {
    usePurchaseIntentStore.setState({ forcedIntent: "token_warning" });
    render(<AuraNudgeBar inputText="hola" />);
    tick();
    expect(screen.getByText("Mejorar Plan")).toBeDefined();
  });

  it("should open the modal when the upgrade button is clicked", () => {
    usePurchaseIntentStore.setState({ forcedIntent: "token_limit" });
    render(<AuraNudgeBar inputText="hola" />);
    tick();
    fireEvent.click(screen.getByText("Mejorar Plan"));
    expect(usePurchaseIntentStore.getState().wompiModalOpen).toBe(true);
  });

  it("should clear the purchase intent when dismissing the nudge", () => {
    usePurchaseIntentStore.setState({ forcedIntent: "large_file" });
    render(<AuraNudgeBar inputText="hola" />);
    tick();
    fireEvent.click(screen.getByLabelText("Descartar sugerencia"));
    expect(usePurchaseIntentStore.getState().forcedIntent).toBeNull();
  });
});
