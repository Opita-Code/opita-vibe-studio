import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenBar } from "../../../src/components/usage/TokenBar";
import { useAuthStore } from "../../../src/stores/auth";

function setTokenUsage(overrides: Record<string, unknown> = {}) {
  useAuthStore.setState({
    tokenUsage: {
      tokensUsedToday: 50_000,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 10_000,
      tokensLimitHourly: 30_000,
      plan: "free",
      resetDailyAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      resetHourlyAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ...overrides,
    },
  });
}

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "authenticated",
    isLoading: false,
  });
  setTokenUsage();
});

describe("TokenBar", () => {
  it("should display token usage (daily)", () => {
    render(<TokenBar />);
    // "50K/150K tokens hoy"
    expect(screen.getByText(/50K\/150K tokens hoy/)).toBeTruthy();
  });

  it("should show remaining tokens count", () => {
    render(<TokenBar />);
    expect(screen.getByText(/100K tokens disponibles/)).toBeTruthy();
  });

  it("should render progress bar with role", () => {
    render(<TokenBar />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeTruthy();
    // 50K/150K = 33%
    expect(bar.getAttribute("aria-valuenow")).toBe("33");
  });

  it("should show daily renewal info", () => {
    render(<TokenBar />);
    // Both daily and hourly renewal info are rendered
    expect(screen.getAllByText(/renueva en/).length).toBeGreaterThanOrEqual(1);
  });

  it("should show warning when at 80% usage", () => {
    setTokenUsage({ tokensUsedToday: 125_000 }); // 83%
    render(<TokenBar />);
    expect(screen.getByText(/tokens restantes/)).toBeTruthy();
  });

  it("should show limit reached state", () => {
    setTokenUsage({ tokensUsedToday: 150_000 });
    render(<TokenBar />);
    expect(screen.getByText(/Sin tokens/)).toBeTruthy();
  });

  it("should display compact version", () => {
    render(<TokenBar compact />);
    // compact shows "50K/150K (Gratis)"
    expect(screen.getByText(/50K\/150K/)).toBeTruthy();
  });
});
