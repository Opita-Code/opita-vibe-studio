import { describe, it, expect, beforeEach } from "vitest";
import { useConsentStore } from "../../src/stores/consent";

beforeEach(() => {
  useConsentStore.setState({
    richConsent: false,
    dataExportRequested: false,
    dataDeletionRequested: false,
    deletionConfirmStep: false,
  });
  localStorage.clear();
});

describe("ConsentStore", () => {
  it("should start with richConsent false (opt-in off)", () => {
    expect(useConsentStore.getState().richConsent).toBe(false);
  });

  it("should start with no data requests pending", () => {
    expect(useConsentStore.getState().dataExportRequested).toBe(false);
    expect(useConsentStore.getState().dataDeletionRequested).toBe(false);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
  });

  it("should toggle richConsent on and off", () => {
    useConsentStore.getState().toggleRichConsent();
    expect(useConsentStore.getState().richConsent).toBe(true);

    useConsentStore.getState().toggleRichConsent();
    expect(useConsentStore.getState().richConsent).toBe(false);
  });

  it("should request data export", () => {
    useConsentStore.getState().requestDataExport();
    expect(useConsentStore.getState().dataExportRequested).toBe(true);
  });

  it("should clear export request after resetExportRequest", () => {
    useConsentStore.getState().requestDataExport();
    useConsentStore.getState().resetExportRequest();
    expect(useConsentStore.getState().dataExportRequested).toBe(false);
  });

  it("should start deletion flow with confirm step", () => {
    useConsentStore.getState().requestDataDeletion();
    expect(useConsentStore.getState().dataDeletionRequested).toBe(true);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(true);
  });

  it("should cancel deletion flow", () => {
    useConsentStore.getState().requestDataDeletion();
    useConsentStore.getState().cancelDataDeletion();
    expect(useConsentStore.getState().dataDeletionRequested).toBe(false);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
  });

  it("should complete deletion after confirm step", () => {
    useConsentStore.getState().requestDataDeletion();
    useConsentStore.getState().confirmDataDeletion();
    expect(useConsentStore.getState().dataDeletionRequested).toBe(true);
    // After confirm, the action has been taken, reset state
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
  });

  it("should persist richConsent to localStorage", () => {
    useConsentStore.getState().toggleRichConsent();
    const saved = localStorage.getItem("vibe-consent");
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.richConsent).toBe(true);
  });

  it("should restore richConsent from localStorage on init", () => {
    localStorage.setItem(
      "vibe-consent",
      JSON.stringify({ richConsent: true, timestamp: Date.now() })
    );
    // Re-initialize store — for this test we just verify the load function works
    const restored = useConsentStore.getState().loadFromStorage();
    expect(restored).toBe(true);
    expect(useConsentStore.getState().richConsent).toBe(true);
  });

  it("should have basicConsent always true", () => {
    // Basic consent is a constant, not a toggle — basic prefs are always captured
    expect(useConsentStore.getState().basicConsent).toBe(true);
  });

  // ─── Triangulation: Edge cases ──────────────────────────────

  it("should handle multiple rapid toggles of richConsent", () => {
    useConsentStore.getState().toggleRichConsent();
    useConsentStore.getState().toggleRichConsent();
    useConsentStore.getState().toggleRichConsent();
    expect(useConsentStore.getState().richConsent).toBe(true);
    // Persisted state should match
    const saved = localStorage.getItem("vibe-consent");
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.richConsent).toBe(true);
  });

  it("should return false from loadFromStorage when no data exists", () => {
    const restored = useConsentStore.getState().loadFromStorage();
    expect(restored).toBe(false);
    // Should still have default false
    expect(useConsentStore.getState().richConsent).toBe(false);
  });

  it("should persist richConsent false correctly", () => {
    // richConsent starts false — just trigger a persist of false state
    useConsentStore.getState().toggleRichConsent();
    useConsentStore.getState().toggleRichConsent();
    const saved = localStorage.getItem("vibe-consent");
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.richConsent).toBe(false);
  });

  it("should keep dataDeletionRequested true after confirm", () => {
    useConsentStore.getState().requestDataDeletion();
    useConsentStore.getState().confirmDataDeletion();
    // deletionConfirmStep resets but deletionRequested stays to signal action happened
    expect(useConsentStore.getState().dataDeletionRequested).toBe(true);
    expect(useConsentStore.getState().deletionConfirmStep).toBe(false);
  });

});
