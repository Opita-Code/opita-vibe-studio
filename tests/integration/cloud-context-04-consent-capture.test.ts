/**
 * Integration Test: Consent + Context Capture
 *
 * Verifies that the consent store and context capture functions work together
 * correctly for progressive capture:
 *
 * - Basic context (theme, language, skill level, auth mode, active view):
 *   ALWAYS captured regardless of consent state
 * - Rich context (learning events, active model): ONLY captured when
 *   richConsent is explicitly toggled ON
 *
 * Tests also verify that toggling consent immediately affects capture behavior
 * and that the Zustand store subscriptions trigger correct re-renders.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConsentStore } from "../../src/stores/consent";
import { useUIStore } from "../../src/stores/ui";
import { useAuthStore } from "../../src/stores/auth";
import { useLearningStore } from "../../src/stores/learning";
import {
  captureBasicContext,
  captureRichContext,
  getBasicContextSnapshot,
  getRichContextSnapshot,
  isRichCaptureAllowed,
  useBasicContextCapture,
  useRichContextCapture,
} from "../../src/lib/context-capture";

describe("Consent + Context Capture integration", () => {
  beforeEach(() => {
    // Reset all stores to defaults
    useConsentStore.setState({
      basicConsent: true,
      richConsent: false,
      dataExportRequested: false,
      dataDeletionRequested: false,
      deletionConfirmStep: false,
    });
    useUIStore.setState({
      sidebarWidth: 240,
      statusMessage: "Listo",
      activeModel: "deepseek-chat",
      connectedProvider: "DeepSeek",
      tokensRemaining: 0,
      terminalVisible: false,
      terminalHeight: 200,
      settingsVisible: false,
      activeView: "preview",
      explorerVisible: false,
      chatWidth: 320,
      splitRatio: 0.5,
      chatPosition: "left",
      splitOrientation: "vertical",
    });
    useAuthStore.setState({
      user: null,
      session: null,
      plan: "free",
      authMode: "unauthenticated",
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
    useLearningStore.setState({
      shownTips: [],
      tipQueue: [],
      learningEvents: [],
      isVisible: false,
      currentTip: null,
    });
    localStorage.clear();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Progressive capture: basic always on
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should capture basic context regardless of consent state", () => {
    // Default: richConsent is OFF
    const basic = captureBasicContext();
    expect(basic).toHaveProperty("theme");
    expect(basic).toHaveProperty("language");
    expect(basic).toHaveProperty("skillLevel");
    expect(basic).toHaveProperty("authMode");
    expect(basic).toHaveProperty("activeView");

    // Enable rich consent â€” basic should still work
    useConsentStore.setState({ richConsent: true });
    const stillBasic = captureBasicContext();
    expect(stillBasic.authMode).toBeDefined();
  });

  it("should reflect live store state in basic context", () => {
    useAuthStore.setState({ authMode: "authenticated" });
    useUIStore.setState({ activeView: "editor" });

    const basic = captureBasicContext();
    expect(basic.authMode).toBe("authenticated");
    expect(basic.activeView).toBe("editor");
  });

  it("should capture basic context snapshot even when consent is OFF", () => {
    useConsentStore.setState({ richConsent: false });

    const snapshot = getBasicContextSnapshot();
    expect(snapshot).toHaveProperty("theme");
    expect(snapshot).toHaveProperty("language");
    expect(snapshot).toHaveProperty("skillLevel");
    expect(snapshot).toHaveProperty("authMode");
    expect(snapshot).toHaveProperty("activeView");
  });

  it("should not include rich context keys in basic snapshot", () => {
    const snapshot = getBasicContextSnapshot();
    expect(snapshot).not.toHaveProperty("learningEvents");
    expect(snapshot).not.toHaveProperty("activeModel");
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Rich capture gated by consent
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should return null for rich capture when consent is OFF", () => {
    useConsentStore.setState({ richConsent: false });

    const rich = captureRichContext();
    expect(rich).toBeNull();
  });

  it("should return rich data when consent is ON", () => {
    useConsentStore.setState({ richConsent: true });

    const rich = captureRichContext();
    expect(rich).not.toBeNull();
    expect(rich).toHaveProperty("learningEvents");
    expect(rich).toHaveProperty("activeModel");
    expect(rich).toHaveProperty("projects");
    expect(rich).toHaveProperty("fileTypes");
  });

  it("should include learning events from the learning store when consent ON", () => {
    useConsentStore.setState({ richConsent: true });
    useLearningStore.getState().addEvent({
      type: "tip_shown",
      concept: "react-hooks",
      timestamp: Date.now(),
    });
    useLearningStore.getState().addEvent({
      type: "code_pattern",
      concept: "closure",
      timestamp: Date.now(),
    });

    const rich = captureRichContext()!;
    expect(rich.learningEvents).toHaveLength(2);
    expect(rich.learningEvents[0].concept).toBe("react-hooks");
    expect(rich.learningEvents[1].concept).toBe("closure");
  });

  it("should NOT include learning events when consent is OFF even if events exist", () => {
    useConsentStore.setState({ richConsent: false });
    useLearningStore.getState().addEvent({
      type: "tip_shown",
      concept: "flexbox",
      timestamp: Date.now(),
    });

    const rich = captureRichContext();
    expect(rich).toBeNull();
  });

  it("should toggle behavior when consent changes", () => {
    // Start OFF
    expect(captureRichContext()).toBeNull();

    // Toggle ON
    useConsentStore.getState().toggleRichConsent();
    expect(useConsentStore.getState().richConsent).toBe(true);
    expect(captureRichContext()).not.toBeNull();

    // Toggle OFF again
    useConsentStore.getState().toggleRichConsent();
    expect(useConsentStore.getState().richConsent).toBe(false);
    expect(captureRichContext()).toBeNull();
  });

  it("should return correct result from isRichCaptureAllowed", () => {
    expect(isRichCaptureAllowed()).toBe(false);
    useConsentStore.setState({ richConsent: true });
    expect(isRichCaptureAllowed()).toBe(true);
    useConsentStore.setState({ richConsent: false });
    expect(isRichCaptureAllowed()).toBe(false);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Snapshot gating
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should return null from getRichContextSnapshot when consent is OFF", () => {
    useConsentStore.setState({ richConsent: false });

    const snapshot = getRichContextSnapshot();
    expect(snapshot).toBeNull();
  });

  it("should return rich keys from getRichContextSnapshot when consent is ON", () => {
    useConsentStore.setState({ richConsent: true });
    useLearningStore.getState().addEvent({
      type: "tip_shown",
      concept: "typescript",
      timestamp: Date.now(),
    });

    const snapshot = getRichContextSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot).toHaveProperty("learningEvents");
    expect(snapshot).toHaveProperty("activeModel");
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // React hooks integration
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should provide basic context via hook regardless of consent", () => {
    const { result } = renderHook(() => useBasicContextCapture());
    expect(result.current).toHaveProperty("theme");
    expect(result.current).toHaveProperty("authMode");
    expect(result.current).toHaveProperty("activeView");
  });

  it("should return null from rich context hook when consent is OFF", () => {
    const { result } = renderHook(() => useRichContextCapture());
    expect(result.current).toBeNull();
  });

  it("should return rich data from hook when consent is ON", () => {
    useConsentStore.setState({ richConsent: true });
    const { result } = renderHook(() => useRichContextCapture());
    expect(result.current).not.toBeNull();
    expect(result.current).toHaveProperty("learningEvents");
  });

  it("should reflect consent changes in hook on re-render", () => {
    const { result, rerender } = renderHook(() => useRichContextCapture());
    expect(result.current).toBeNull();

    useConsentStore.setState({ richConsent: true });
    rerender();
    expect(result.current).not.toBeNull();
  });

  it("should reflect learning store changes in hook when consent is ON", () => {
    useConsentStore.setState({ richConsent: true });

    const { result, rerender } = renderHook(() => useRichContextCapture());
    expect(result.current!.learningEvents).toHaveLength(0);

    useLearningStore.getState().addEvent({
      type: "tip_shown",
      concept: "css-grid",
      timestamp: Date.now(),
    });
    rerender();
    expect(result.current!.learningEvents).toHaveLength(1);
    expect(result.current!.learningEvents[0].concept).toBe("css-grid");
  });
});

