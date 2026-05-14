import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrivacyPanel } from "../../src/components/settings/PrivacyPanel";
import { useConsentStore } from "../../src/stores/consent";
import { useAuthStore } from "../../src/stores/auth";

beforeEach(() => {
  useConsentStore.setState({
    richConsent: false,
    dataExportRequested: false,
    dataDeletionRequested: false,
    deletionConfirmStep: false,
  });
});

describe("PrivacyPanel", () => {
  it("should render the privacy section title", () => {
    render(<PrivacyPanel />);
    expect(screen.getByText("Privacidad")).toBeTruthy();
  });

  it("should render consent toggle with default OFF", () => {
    render(<PrivacyPanel />);
    // The toggle is a switch role
    const toggleSwitch = screen.getByRole("switch", {
      name: /compartir datos de uso/i,
    });
    expect(toggleSwitch).toBeTruthy();
    expect(toggleSwitch).toHaveAttribute("aria-checked", "false");
    // When off, should show "Apagado" or similar indicator
    expect(screen.getByText(/apagado/i)).toBeTruthy();
  });

  it("should toggle richConsent when clicking toggle", () => {
    render(<PrivacyPanel />);
    const toggleSwitch = screen.getByRole("switch", {
      name: /compartir datos de uso/i,
    });
    fireEvent.click(toggleSwitch);
    expect(useConsentStore.getState().richConsent).toBe(true);
  });

  it("should show 'Prendido' when richConsent is ON", () => {
    useConsentStore.setState({ richConsent: true });
    render(<PrivacyPanel />);
    expect(screen.getByText(/prendido/i)).toBeTruthy();
  });

  it("should render export button", () => {
    render(<PrivacyPanel />);
    expect(
      screen.getByRole("button", { name: /exportar mis datos/i }),
    ).toBeTruthy();
  });

  it("should set dataExportRequested when export button clicked", () => {
    render(<PrivacyPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: /exportar mis datos/i }),
    );
    expect(useConsentStore.getState().dataExportRequested).toBe(true);
  });

  it("should render delete button", () => {
    render(<PrivacyPanel />);
    expect(
      screen.getByRole("button", { name: /eliminar mis datos/i }),
    ).toBeTruthy();
  });

  it("should show confirm dialog when delete is clicked", () => {
    render(<PrivacyPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar mis datos/i }),
    );
    expect(useConsentStore.getState().deletionConfirmStep).toBe(true);
    // Should now show the confirmation message
    expect(screen.getByText(/¿estás seguro/i)).toBeTruthy();
    // Should show confirm and cancel buttons
    expect(
      screen.getByRole("button", { name: /sí, eliminar/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeTruthy();
  });

  it("should cancel deletion when cancel is clicked in confirm step", () => {
    render(<PrivacyPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar mis datos/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(useConsentStore.getState().dataDeletionRequested).toBe(false);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
  });

  it("should confirm deletion when Sí is clicked", () => {
    render(<PrivacyPanel />);
    fireEvent.click(
      screen.getByRole("button", { name: /eliminar mis datos/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /sí, eliminar/i }),
    );
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
    // dataDeletionRequested stays true to signal the action
    expect(useConsentStore.getState().dataDeletionRequested).toBe(true);
  });

  it("should render privacy policy link", () => {
    render(<PrivacyPanel />);
    const policyLink = screen.getByText(/política de privacidad/i);
    expect(policyLink).toBeTruthy();
    expect(policyLink.closest("a")).toHaveAttribute(
      "href",
      "https://opita.co/privacidad",
    );
  });

  it("should render GDPR description text", () => {
    render(<PrivacyPanel />);
    expect(
      screen.getByText(/solo cuando vos nos des permiso/i),
    ).toBeTruthy();
  });
});
