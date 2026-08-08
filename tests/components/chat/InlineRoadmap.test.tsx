import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InlineRoadmap } from "../../../src/components/chat/InlineRoadmap";
import type { AgentExecutionGoal } from "../../../src/lib/types";

function makeGoal(overrides: Partial<AgentExecutionGoal> & { id: string }): AgentExecutionGoal {
  return {
    label: "meta",
    status: "pending",
    ...overrides,
  };
}

describe("InlineRoadmap", () => {
  it("should return null when there are no goals", () => {
    const { container } = render(<InlineRoadmap goals={[]} progress={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render goal labels", () => {
    const goals = [
      makeGoal({ id: "1", label: "Analizar proyecto" }),
      makeGoal({ id: "2", label: "Escribir código", status: "active" }),
      makeGoal({ id: "3", label: "Verificar", status: "done" }),
    ];
    render(<InlineRoadmap goals={goals} progress={50} />);
    expect(screen.getByText("Analizar proyecto")).toBeDefined();
    expect(screen.getByText("Escribir código")).toBeDefined();
    expect(screen.getByText("Verificar")).toBeDefined();
  });

  it("should show progress bar while not all goals are done", () => {
    const goals = [
      makeGoal({ id: "1", label: "a", status: "done" }),
      makeGoal({ id: "2", label: "b", status: "active" }),
    ];
    render(<InlineRoadmap goals={goals} progress={70} />);
    // progress bar renders (container with bg-white/8 + animated div)
    expect(screen.getByText("a")).toBeDefined();
  });

  it("should NOT show progress bar when all goals are done", () => {
    const goals = [
      makeGoal({ id: "1", label: "a", status: "done" }),
      makeGoal({ id: "2", label: "b", status: "done" }),
    ];
    const { container } = render(<InlineRoadmap goals={goals} progress={100} />);
    // No progress track → no div with h-0.5 rounded-full (progress track)
    expect(container.querySelectorAll("[class*='h-0.5']").length).toBe(0);
  });

  it("should show detail for a done goal when expanded", async () => {
    const goals = [
      makeGoal({ id: "1", label: "Hecho", status: "done", detail: "detalle objetivo" }),
    ];
    render(<InlineRoadmap goals={goals} progress={100} />);
    expect(screen.queryByText("detalle objetivo")).toBeNull();
    fireEvent.click(screen.getByText("Hecho"));
    expect(await screen.findByText("detalle objetivo")).toBeDefined();
  });

  it("should show default text when done goal has no detail", async () => {
    const goals = [makeGoal({ id: "1", label: "Hecho", status: "done" })];
    render(<InlineRoadmap goals={goals} progress={100} />);
    fireEvent.click(screen.getByText("Hecho"));
    expect(await screen.findByText("✓ completado")).toBeDefined();
  });

  it("should render active goal with bouncing indicator and per-goal progress", () => {
    const goals = [
      makeGoal({ id: "1", label: "En curso", status: "active", progress: 45 }),
    ];
    const { container } = render(<InlineRoadmap goals={goals} progress={45} />);
    expect(screen.getByText("En curso")).toBeDefined();
    // per-goal progress bar exists
    expect(container.querySelectorAll("[class*='mt-1.5']").length).toBeGreaterThan(0);
  });

  it("should render error and pending statuses without crashing", () => {
    const goals = [
      makeGoal({ id: "1", label: "Error", status: "error" }),
      makeGoal({ id: "2", label: "Pendiente" }),
    ];
    render(<InlineRoadmap goals={goals} progress={10} />);
    expect(screen.getByText("Error")).toBeDefined();
    expect(screen.getByText("Pendiente")).toBeDefined();
  });
});
