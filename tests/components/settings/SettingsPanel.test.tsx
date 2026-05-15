import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "../../../src/components/settings/SettingsPanel";
import { useUIStore } from "../../../src/stores/ui";
import { useAuthStore } from "../../../src/stores/auth";

beforeEach(() => {
  useUIStore.setState({
    settingsVisible: true,
    activeView: "preview",
    chatWidth: 320,
    chatPosition: "left",
  });
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "authenticated",
    isLoading: false,
    tokenUsage: {
      tokensUsedToday: 0,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 0,
      tokensLimitHourly: 30_000,
      plan: "free",
      resetDailyAt: new Date().toISOString(),
      resetHourlyAt: new Date().toISOString(),
    },
  });
});

describe("SettingsPanel", () => {
  it("should render nothing when settingsVisible is false", () => {
    useUIStore.setState({ settingsVisible: false });
    const { container } = render(<SettingsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("should render panel header when visible", () => {
    render(<SettingsPanel />);
    expect(screen.getByText("Configuración")).toBeTruthy();
  });

  it("should render tab buttons including Privacidad for authenticated users", () => {
    render(<SettingsPanel />);
    // Current tabs: Conexiones IA, Apariencia, Suscripción y Uso, Privacidad (auth)
    expect(screen.getByText("Conexiones IA")).toBeTruthy();
    expect(screen.getByText("Apariencia")).toBeTruthy();
    expect(screen.getByText(/suscripción/i)).toBeTruthy();
    // Privacidad is visible because authMode is "authenticated"
    expect(screen.getByText("Privacidad")).toBeTruthy();
  });

  it("should NOT render Privacidad tab for guest users", () => {
    useAuthStore.setState({ authMode: "unauthenticated", user: null });
    render(<SettingsPanel />);
    expect(screen.getByText("Conexiones IA")).toBeTruthy();
    expect(screen.queryByText("Privacidad")).toBeNull();
  });

  it("should render Agentes SDD tab for pro users", () => {
    useAuthStore.setState({ plan: "pro", authMode: "authenticated" });
    render(<SettingsPanel />);
    expect(screen.getByText("Agentes SDD")).toBeTruthy();
  });

  it("should NOT render Agentes SDD tab for free users", () => {
    useAuthStore.setState({ plan: "free", authMode: "authenticated" });
    render(<SettingsPanel />);
    expect(screen.queryByText("Agentes SDD")).toBeNull();
  });

  it("should close panel when pressing Escape", () => {
    render(<SettingsPanel />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUIStore.getState().settingsVisible).toBe(false);
  });

  it("should close panel when clicking backdrop", () => {
    render(<SettingsPanel />);
    // The backdrop is the outer motion.div with fixed inset-0
    const backdrop = document.querySelector(".fixed.inset-0");
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(useUIStore.getState().settingsVisible).toBe(false);
  });
});
