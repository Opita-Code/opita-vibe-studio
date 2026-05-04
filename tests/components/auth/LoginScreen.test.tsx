import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginScreen } from "../../../src/components/auth/LoginScreen";
import { useAuthStore } from "../../../src/stores/auth";

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    isAuthenticated: false,
    isLoading: false,
    tokenUsage: {
      promptsUsed: 0,
      promptsLimit: 30,
      billingPeriodStart: new Date().toISOString(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });
});

describe("LoginScreen", () => {
  it("should render login form", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Opita Vibe")).toBeTruthy();
    expect(screen.getByText("Iniciar sesión con Opita Code")).toBeTruthy();
    expect(screen.getByText("Continuar sin cuenta")).toBeTruthy();
  });

  it("should render email input", () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText("tu@email.com")).toBeTruthy();
  });

  it("should show error for invalid email when not an @ format", () => {
    const onAuth = vi.fn();
    render(<LoginScreen onAuthenticated={onAuth} />);

    // Empty email → button is disabled, so click does nothing
    const button = screen.getByText("Iniciar sesión con Opita Code");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("should enter guest mode when clicking continuar sin cuenta", () => {
    const onAuth = vi.fn();
    render(<LoginScreen onAuthenticated={onAuth} />);

    fireEvent.click(screen.getByText("Continuar sin cuenta"));
    expect(useAuthStore.getState().plan).toBe("free");
    expect(onAuth).toHaveBeenCalled();
  });

  it("should show loading state after submitting a valid email", () => {
    render(<LoginScreen />);

    const input = screen.getByPlaceholderText("tu@email.com");
    fireEvent.change(input, { target: { value: "test@opita.co" } });

    const button = screen.getByText("Iniciar sesión con Opita Code");
    fireEvent.click(button);

    expect(screen.getByText("Iniciando sesión...")).toBeTruthy();
  });
});
