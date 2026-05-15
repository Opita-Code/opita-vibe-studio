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
    authMode: "authenticated",
    isLoading: false,
    tokenUsage: {
      tokensUsedToday: 50_000,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 10_000,
      tokensLimitHourly: 30_000,
      plan: "free",
      resetDailyAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      resetHourlyAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  });
});

describe("PlanCard", () => {
  it("should render plan name", () => {
    render(<PlanCard />);
    expect(screen.getByText("Gratis")).toBeTruthy();
  });

  it("should show token availability", () => {
    render(<PlanCard />);
    // "100K de 150K tokens disponibles"
    expect(
      screen.getByText((content) => content.includes("tokens disponibles")),
    ).toBeTruthy();
  });

  it("should show upgrade button for free plan", () => {
    render(<PlanCard />);
    expect(screen.getByText("Subir a Estudiante")).toBeTruthy();
  });

  it("should show plan features", () => {
    render(<PlanCard />);
    // Features from PLAN_FEATURES.free
    expect(screen.getByText("Incluye")).toBeTruthy();
  });

  it("should show renewal time", () => {
    render(<PlanCard />);
    expect(screen.getByText(/Se renueva en/)).toBeTruthy();
  });
});
