import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginScreen } from "../../../src/components/auth/LoginScreen";

// Mock SSO to prevent actual fetch calls
vi.mock("../../../src/auth/sso", () => ({
  initiateSSO: vi.fn().mockRejectedValue(new Error("Email inválido")),
  loginWithPassword: vi.fn().mockRejectedValue(new Error("Invalid credentials")),
  registerWithPassword: vi.fn().mockRejectedValue(new Error("Registration failed")),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginScreen", () => {
  it("should render Vibe Studio branding", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Vibe Studio")).toBeTruthy();
    expect(screen.getByText(/Vibecodea en español/)).toBeTruthy();
  });

  it("should render login form with email and password inputs", () => {
    render(<LoginScreen />);
    // Default mode is "password" with "login" view
    expect(screen.getByPlaceholderText("tu@email.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("Contraseña")).toBeTruthy();
    expect(screen.getByText("Iniciar Sesión")).toBeTruthy();
  });

  it("should show error for invalid email when submitting", async () => {
    const { initiateSSO } = await import("../../../src/auth/sso");
    (initiateSSO as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Email inválido"));

    render(<LoginScreen />);

    // Switch to magic link mode
    fireEvent.click(screen.getByText("Enlace Mágico"));

    // Type an invalid email and submit
    const emailInput = screen.getByPlaceholderText("tu@email.com");
    fireEvent.change(emailInput, { target: { value: "invalid" } });
    fireEvent.click(screen.getByText("Recibir Enlace Mágico"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  it("should have auth mode tabs (Contraseña and Enlace Mágico)", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Contraseña")).toBeTruthy();
    expect(screen.getByText("Enlace Mágico")).toBeTruthy();
  });
});
