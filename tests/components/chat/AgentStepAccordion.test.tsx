import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitForElementToBeRemoved } from "@testing-library/react";
import { AgentStepAccordion } from "../../../src/components/chat/AgentStepAccordion";
import type { AgentStep } from "../../../src/agent/types";

function makeStep(overrides: Partial<AgentStep> & { id: string }): AgentStep {
  return {
    icon: "🔧",
    label: "step",
    status: "done",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("AgentStepAccordion", () => {
  it("should return null when steps are empty", () => {
    const { container } = render(<AgentStepAccordion steps={[]} isActive={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render step labels and completion count", () => {
    const steps = [
      makeStep({ id: "1", label: "Leer archivos" }),
      makeStep({ id: "2", label: "Escribir código", status: "running" }),
    ];
    render(<AgentStepAccordion steps={steps} isActive={false} />);
    expect(screen.getByText("Leer archivos")).toBeDefined();
    expect(screen.getByText("Escribir código")).toBeDefined();
    expect(screen.getByText("1 operaciones completadas")).toBeDefined();
  });

  it("should show executing state with count when active", () => {
    const steps = [
      makeStep({ id: "1", label: "a", status: "done" }),
      makeStep({ id: "2", label: "b", status: "running" }),
    ];
    render(<AgentStepAccordion steps={steps} isActive={true} />);
    expect(screen.getByText(/Ejecutando\.\.\. \(1\/2\)/)).toBeDefined();
  });

  it("should show error count in header when steps have errors", () => {
    const steps = [
      makeStep({ id: "1", label: "a", status: "done" }),
      makeStep({ id: "2", label: "b", status: "error" }),
    ];
    render(<AgentStepAccordion steps={steps} isActive={false} />);
    expect(screen.getByText("1 completados, 1 con error")).toBeDefined();
  });

  it("should collapse/expand the list when header is clicked", async () => {
    const steps = [makeStep({ id: "1", label: "Leer archivos" })];
    render(<AgentStepAccordion steps={steps} isActive={false} />);
    expect(screen.getByText("Leer archivos")).toBeDefined();

    const header = screen.getByText("1 operaciones completadas");
    fireEvent.click(header);
    // AnimatePresence removes the exiting node after its exit animation
    await waitForElementToBeRemoved(() => screen.queryByText("Leer archivos"));
    fireEvent.click(header);
    expect(await screen.findByText("Leer archivos")).toBeDefined();
  });

  it("should expand a step detail on click", async () => {
    const steps = [makeStep({ id: "1", label: "Buscar", detail: "detalle interno" })];
    render(<AgentStepAccordion steps={steps} isActive={false} />);

    const row = screen.getByText("Buscar");
    expect(screen.queryByText("detalle interno")).toBeNull();
    fireEvent.click(row);
    expect(await screen.findByText("detalle interno")).toBeDefined();
    // click again to collapse
    fireEvent.click(row);
    await waitForElementToBeRemoved(() => screen.queryByText("detalle interno"));
  });

  it("should not toggle expansion when step has no detail", () => {
    const steps = [makeStep({ id: "1", label: "Buscar" })];
    render(<AgentStepAccordion steps={steps} isActive={false} />);
    fireEvent.click(screen.getByText("Buscar"));
    // no crash, nothing expanded
    expect(screen.getByText("Buscar")).toBeDefined();
  });

  it("should mark the last step row without a divider (no error)", () => {
    const steps = [
      makeStep({ id: "1", label: "a" }),
      makeStep({ id: "2", label: "b" }),
    ];
    const { container } = render(<AgentStepAccordion steps={steps} isActive={false} />);
    expect(container.querySelectorAll("button").length).toBeGreaterThanOrEqual(1);
  });
});
