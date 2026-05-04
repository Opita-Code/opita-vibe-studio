import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TokenBar } from "../../../src/components/usage/TokenBar";
import { useAuthStore } from "../../../src/stores/auth";

beforeEach(() => {
  useAuthStore.setState({
    user: null,
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

describe("TokenBar", () => {
  it("should display prompt usage", () => {
    render(<TokenBar />);
    expect(screen.getByText(/12\/30 prompts este mes/)).toBeTruthy();
  });

  it("should show remaining tokens count", () => {
    render(<TokenBar />);
    expect(screen.getByText(/18 tokens disponibles/)).toBeTruthy();
  });

  it("should render progress bar with role", () => {
    render(<TokenBar />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("aria-valuenow")).toBe("40"); // 12/30 = 40%
  });

  it("should show renewal date", () => {
    render(<TokenBar />);
    expect(screen.getByText(/Se renuevan el/)).toBeTruthy();
  });

  it("should show warning at 80% usage", () => {
    useAuthStore.setState((s) => ({
      tokenUsage: { ...s.tokenUsage, promptsUsed: 25 },
    }));
    render(<TokenBar />);
    expect(screen.getByText(/Te quedan 5 tokens/)).toBeTruthy();
  });

  it("should show limit reached state", () => {
    useAuthStore.setState((s) => ({
      tokenUsage: { ...s.tokenUsage, promptsUsed: 30 },
    }));
    render(<TokenBar />);
    expect(screen.getByText(/Sin tokens/)).toBeTruthy();
  });

  it("should display compact version", () => {
    render(<TokenBar compact />);
    expect(screen.getByText("12/30")).toBeTruthy();
  });
});
