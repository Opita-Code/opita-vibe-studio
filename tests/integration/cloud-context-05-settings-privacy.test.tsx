/**
 * Integration Test: SettingsPanel + Privacy
 *
 * Verifies that the SettingsPanel and PrivacyPanel components work together
 * correctly, including:
 *
 * - Privacy tab visibility gated by auth state
 * - Consent toggle works in rendered component
 * - Data export flow (request + reset)
 * - Data deletion flow (request â†’ confirm â†’ done)
 * - Privacy policy link renders
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "../../src/components/settings/SettingsPanel";
import { PrivacyPanel } from "../../src/components/settings/PrivacyPanel";
import { useUIStore } from "../../src/stores/ui";
import { useAuthStore } from "../../src/stores/auth";
import { useConsentStore } from "../../src/stores/consent";

function resetStores() {
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
    chatPosition: "left",
    splitOrientation: "vertical",
  });
  useConsentStore.setState({
    basicConsent: true,
    richConsent: false,
    dataExportRequested: false,
    dataDeletionRequested: false,
    deletionConfirmStep: false,
  });
}

describe("SettingsPanel + Privacy integration", () => {
  beforeEach(() => {
    resetStores();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Privacy tab visibility (auth-gated)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should render Privacidad tab for authenticated users", () => {
    useAuthStore.setState({ authMode: "authenticated" });
    render(<SettingsPanel />);
    expect(screen.getByText("Privacidad")).toBeTruthy();
  });

  it("should NOT render Privacidad tab for guest users", () => {
    useAuthStore.setState({ authMode: "unauthenticated", user: null });
    render(<SettingsPanel />);
    expect(screen.queryByText("Privacidad")).toBeNull();
  });

  it("should render Privacidad tab when user transitions from guest to authenticated", () => {
    // Start as guest
    useAuthStore.setState({ authMode: "unauthenticated", user: null });
    const { rerender } = render(<SettingsPanel />);
    expect(screen.queryByText("Privacidad")).toBeNull();

    // Transition to authenticated
    useAuthStore.setState({ authMode: "authenticated" });
    rerender(<SettingsPanel />);
    expect(screen.getByText("Privacidad")).toBeTruthy();
  });

  it("should show PrivacyPanel content when Privacidad tab is active", () => {
    useAuthStore.setState({ authMode: "authenticated" });
    render(<SettingsPanel />);

    // Click the Privacidad tab
    fireEvent.click(screen.getByText("Privacidad"));

    // Content from PrivacyPanel should appear
    expect(screen.getByText(/compartir datos de uso/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /exportar mis datos/i }),
    ).toBeTruthy();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PrivacyPanel consent toggle
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should start with consent toggle OFF", () => {
    render(<PrivacyPanel />);
    const toggle = screen.getByRole("switch", { name: /compartir datos de uso/i });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/apagado/i)).toBeTruthy();
  });

  it("should toggle consent ON when clicking the switch", () => {
    render(<PrivacyPanel />);
    const toggle = screen.getByRole("switch", { name: /compartir datos de uso/i });
    fireEvent.click(toggle);

    expect(useConsentStore.getState().richConsent).toBe(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/prendido/i)).toBeTruthy();
  });

  it("should toggle consent OFF after being ON", () => {
    useConsentStore.setState({ richConsent: true });
    render(<PrivacyPanel />);
    const toggle = screen.getByRole("switch", { name: /compartir datos de uso/i });

    fireEvent.click(toggle);
    expect(useConsentStore.getState().richConsent).toBe(false);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Data export flow
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should show export button and set flag on click", () => {
    render(<PrivacyPanel />);
    const exportBtn = screen.getByRole("button", { name: /exportar mis datos/i });

    fireEvent.click(exportBtn);
    expect(useConsentStore.getState().dataExportRequested).toBe(true);
    expect(screen.getByText(/exportación solicitada/i)).toBeTruthy();
  });

  it("should show close link after export requested", () => {
    render(<PrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /exportar mis datos/i }));

    const closeLink = screen.getByText(/cerrar/i);
    expect(closeLink).toBeTruthy();

    fireEvent.click(closeLink);
    expect(useConsentStore.getState().dataExportRequested).toBe(false);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Data deletion flow
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should show deletion button and confirmation dialog on click", () => {
    render(<PrivacyPanel />);
    const deleteBtn = screen.getByRole("button", { name: /eliminar mis datos/i });

    fireEvent.click(deleteBtn);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(true);
    expect(screen.getByText(/¿estás seguro/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /sí, eliminar/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeTruthy();
  });

  it("should cancel deletion when Cancel is clicked", () => {
    render(<PrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /eliminar mis datos/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(useConsentStore.getState().dataDeletionRequested).toBe(false);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
  });

  it("should confirm deletion when Sí is clicked", () => {
    render(<PrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /eliminar mis datos/i }));
    fireEvent.click(screen.getByRole("button", { name: /sí, eliminar/i }));

    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
    // dataDeletionRequested stays true to signal the action happened
    expect(useConsentStore.getState().dataDeletionRequested).toBe(true);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Privacy policy link
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should render privacy policy link pointing to opita.co", () => {
    render(<PrivacyPanel />);
    const link = screen.getByText(/política de privacidad/i);
    expect(link).toBeTruthy();
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://opita.co/privacidad",
    );
    expect(link.closest("a")).toHaveAttribute("target", "_blank");
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // GDPR rights section
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should render GDPR rights section with expected content", () => {
    render(<PrivacyPanel />);
    expect(screen.getByText(/tus derechos gdpr/i)).toBeTruthy();
    // There are 4 checkmark items in the GDPR list
    const checks = screen.getAllByText(/✓/);
    expect(checks).toHaveLength(4);
  });

  it("should render data usage description with shared info", () => {
    render(<PrivacyPanel />);
    expect(
      screen.getByText(/solo cuando vos nos des permiso/i),
    ).toBeTruthy();
  });
});

