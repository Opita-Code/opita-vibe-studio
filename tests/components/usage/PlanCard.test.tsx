import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanCard } from "../../../src/components/usage/PlanCard";
import { useAuthStore } from "../../../src/stores/auth";

beforeEach(() => {
  useAuthStore.setState({
    user: {
      id: "test-user",
      email: "user@opita.co",
      name: "Test User",
      plan: "free",
      verified: false,
    },
    session: null,
    plan: "free",
    isAuthenticated: true,
    isLoading: false,
    tokenUsage: {
      promptsUsed: 12,
      promptsLimit: 30,
      billingPeriodStart: new Date().toISOString(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

describe("PlanCard", () => {
  it("should render plan name", () => {
    render(<PlanCard />);
    expect(screen.getByText("Gratis")).toBeTruthy();
  });

  it("should show prompt usage", () => {
    render(<PlanCard />);
    expect(
      screen.getByText((content) => content.includes("prompts restantes")),
    ).toBeTruthy();
  });

  it("should show upgrade button for free plan", () => {
    render(<PlanCard />);
    expect(screen.getByText("Actualizar plan")).toBeTruthy();
  });

  it("should show plan features", () => {
    render(<PlanCard />);
    expect(screen.getByText("30 prompts por mes")).toBeTruthy();
  });

  it("should show renewal date", () => {
    render(<PlanCard />);
    expect(screen.getByText(/Se renueva el/)).toBeTruthy();
  });
});
