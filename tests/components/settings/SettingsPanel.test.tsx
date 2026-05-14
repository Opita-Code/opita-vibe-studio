import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "../../../src/components/settings/SettingsPanel";
import { useUIStore } from "../../../src/stores/ui";
import { useAuthStore } from "../../../src/stores/auth";

beforeEach(() => {
  useUIStore.setState({
    sidebarWidth: 240,
    statusMessage: "Listo",
    activeModel: "deepseek-chat",
    connectedProvider: "DeepSeek",
    tokensRemaining: 0,
    terminalVisible: false,
    terminalHeight: 200,
    settingsVisible: true,
    activeView: "preview",
    explorerVisible: false,
    chatWidth: 320,
    splitRatio: 0.5,
  });
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "authenticated",
    sessionDetected: false,
    isLoading: false,
    supabaseReady: false,
    guestEmail: null,
    needsMigration: false,
    tokenUsage: {
      promptsUsed: 0,
      promptsLimit: 30,
      billingPeriodStart: expect.any(String) as unknown as string,
      billingPeriodEnd: expect.any(String) as unknown as string,
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
    expect(screen.getByText("BYOK")).toBeTruthy();
    expect(screen.getByText("Plan")).toBeTruthy();
    expect(screen.getByText("Tokens")).toBeTruthy();
    // Layout is always visible
    expect(screen.getByText("Layout")).toBeTruthy();
    // Privacidad is visible because authMode is "authenticated"
    expect(screen.getByText("Privacidad")).toBeTruthy();
  });

  it("should NOT render Privacidad tab for guest users", () => {
    useAuthStore.setState({ authMode: "unauthenticated", user: null });
    render(<SettingsPanel />);
    expect(screen.getByText("BYOK")).toBeTruthy();
    expect(screen.queryByText("Privacidad")).toBeNull();
  });

  it("should render close button", () => {
    render(<SettingsPanel />);
    expect(screen.getByLabelText("Cerrar configuración")).toBeTruthy();
  });

  it("should close panel when clicking close button", () => {
    render(<SettingsPanel />);
    fireEvent.click(screen.getByLabelText("Cerrar configuración"));
    expect(useUIStore.getState().settingsVisible).toBe(false);
  });

  it("should close panel when clicking backdrop", () => {
    render(<SettingsPanel />);
    // The backdrop is the first child (div with fixed inset-0 z-40)
    const backdrop = document.querySelector(".fixed.inset-0.z-40");
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      fireEvent.click(backdrop);
    }
    expect(useUIStore.getState().settingsVisible).toBe(false);
  });

  it("should have slide-in transition class on panel", () => {
    render(<SettingsPanel />);
    const panel = document.querySelector(".fixed.right-0.top-0");
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("transition-transform");
    expect(panel?.className).toContain("duration-300");
  });

});

