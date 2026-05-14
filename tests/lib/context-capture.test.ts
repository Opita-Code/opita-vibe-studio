import { describe, it, expect, beforeEach, vi } from "vitest";
import { useConsentStore } from "../../src/stores/consent";
import { useUIStore } from "../../src/stores/ui";
import { useAuthStore } from "../../src/stores/auth";
import { useLearningStore } from "../../src/stores/learning";

beforeEach(() => {
  useConsentStore.setState({
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
});

// We import AFTER setting up state to ensure clean state
import {
  captureBasicContext,
  captureRichContext,
  getBasicContextSnapshot,
  getRichContextSnapshot,
  isRichCaptureAllowed,
  useBasicContextCapture,
  useRichContextCapture,
  BASIC_CONTEXT_KEYS,
  RICH_CONTEXT_KEYS,
} from "../../src/lib/context-capture";

describe("captureBasicContext", () => {
  it("should return basic context data with theme, language, skill level", () => {
    const ctx = captureBasicContext();
    expect(ctx).toHaveProperty("theme");
    expect(ctx).toHaveProperty("language");
    expect(ctx).toHaveProperty("skillLevel");
  });

  it("should reflect current UI theme state", () => {
    // The theme is derived from UI state (dark mode)
    const ctx = captureBasicContext();
    expect(ctx.theme).toBeDefined();
    expect(typeof ctx.theme).toBe("string");
  });

  it("should include auth mode in basic context", () => {
    useAuthStore.setState({ authMode: "authenticated" });
    const ctx = captureBasicContext();
    expect(ctx.authMode).toBe("authenticated");
  });

  it("should include active view in basic context", () => {
    useUIStore.setState({ activeView: "split" });
    const ctx = captureBasicContext();
    expect(ctx.activeView).toBe("split");
  });
});

describe("captureRichContext", () => {
  it("should return null when richConsent is false", () => {
    useConsentStore.setState({ richConsent: false });
    const ctx = captureRichContext();
    expect(ctx).toBeNull();
  });

  it("should return rich context data when richConsent is true", () => {
    useConsentStore.setState({ richConsent: true });
    const ctx = captureRichContext();
    expect(ctx).not.toBeNull();
    expect(ctx).toHaveProperty("learningEvents");
    expect(ctx).toHaveProperty("projects");
    expect(ctx).toHaveProperty("fileTypes");
  });

  it("should include learning events from the learning store", () => {
    useConsentStore.setState({ richConsent: true });
    useLearningStore.getState().addEvent({
      type: "file_created",
      concept: "flexbox",
      timestamp: Date.now(),
    });
    const ctx = captureRichContext()!;
    expect(ctx.learningEvents).toHaveLength(1);
    expect(ctx.learningEvents[0].concept).toBe("flexbox");
  });

  it("should include active model as project info", () => {
    useConsentStore.setState({ richConsent: true });
    useUIStore.setState({ activeModel: "gemini-2.0-flash" });
    const ctx = captureRichContext()!;
    expect(ctx.activeModel).toBe("gemini-2.0-flash");
  });

  it("should NOT capture rich context when consent is off even if events exist", () => {
    useConsentStore.setState({ richConsent: false });
    useLearningStore.getState().addEvent({
      type: "code_completed",
      concept: "hooks",
      timestamp: Date.now(),
    });
    const ctx = captureRichContext();
    expect(ctx).toBeNull();
  });
});

describe("getBasicContextSnapshot", () => {
  it("should return a key-value map of basic context data", () => {
    const snapshot = getBasicContextSnapshot();
    expect(snapshot).toHaveProperty("theme");
    expect(snapshot).toHaveProperty("language");
    expect(snapshot).toHaveProperty("skillLevel");
    expect(snapshot).toHaveProperty("authMode");
  });

  it("should include only BASIC_CONTEXT_KEYS entries", () => {
    const snapshot = getBasicContextSnapshot();
    const keys = Object.keys(snapshot);
    for (const key of keys) {
      expect(BASIC_CONTEXT_KEYS).toContain(key);
    }
  });
});

describe("getRichContextSnapshot", () => {
  it("should return null when consent is false", () => {
    useConsentStore.setState({ richConsent: false });
    expect(getRichContextSnapshot()).toBeNull();
  });

  it("should return key-value map when consent is true", () => {
    useConsentStore.setState({ richConsent: true });
    useLearningStore.getState().addEvent({
      type: "tip_shown",
      concept: "typescript",
      timestamp: Date.now(),
    });
    const snapshot = getRichContextSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot).toHaveProperty("learningEvents");
  });

  it("should return null when consent was toggled off", () => {
    useConsentStore.setState({ richConsent: true });
    // Make sure it returns data when on
    expect(getRichContextSnapshot()).not.toBeNull();
    // Then toggle off
    useConsentStore.setState({ richConsent: false });
    expect(getRichContextSnapshot()).toBeNull();
  });
});

describe("Context key constants", () => {
  it("should define BASIC_CONTEXT_KEYS properly", () => {
    expect(BASIC_CONTEXT_KEYS).toContain("theme");
    expect(BASIC_CONTEXT_KEYS).toContain("language");
    expect(BASIC_CONTEXT_KEYS).toContain("skillLevel");
    expect(BASIC_CONTEXT_KEYS).toContain("authMode");
  });

  it("should define RICH_CONTEXT_KEYS properly", () => {
    expect(RICH_CONTEXT_KEYS).toContain("learningEvents");
    expect(RICH_CONTEXT_KEYS).toContain("activeModel");
  });
});

// â”€â”€â”€ Triangulation: Edge cases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("captureBasicContext edge cases", () => {
  it("should reflect guest auth mode", () => {
    useAuthStore.setState({ authMode: "unauthenticated" });
    expect(captureBasicContext().authMode).toBe("unauthenticated");
  });

  it("should reflect authenticated auth mode", () => {
    useAuthStore.setState({ authMode: "authenticated" });
    expect(captureBasicContext().authMode).toBe("authenticated");
  });

  it("should reflect activeView changes", () => {
    useUIStore.setState({ activeView: "editor" });
    expect(captureBasicContext().activeView).toBe("editor");
    useUIStore.setState({ activeView: "split" });
    expect(captureBasicContext().activeView).toBe("split");
  });
});

describe("captureRichContext edge cases", () => {
  it("should return empty arrays when no events recorded", () => {
    useConsentStore.setState({ richConsent: true });
    const ctx = captureRichContext()!;
    expect(ctx.learningEvents).toHaveLength(0);
    expect(Array.isArray(ctx.projects)).toBe(true);
    expect(Array.isArray(ctx.fileTypes)).toBe(true);
  });

  it("should reflect active model changes", () => {
    useConsentStore.setState({ richConsent: true });
    useUIStore.setState({ activeModel: "claude-3-opus" });
    expect(captureRichContext()!.activeModel).toBe("claude-3-opus");
  });

  it("should return null after consent was ON then turned OFF", () => {
    useConsentStore.setState({ richConsent: true });
    expect(captureRichContext()).not.toBeNull();
    useConsentStore.setState({ richConsent: false });
    expect(captureRichContext()).toBeNull();
  });
});

describe("getBasicContextSnapshot edge cases", () => {
  it("should always return the same keys regardless of auth state", () => {
    useAuthStore.setState({ authMode: "unauthenticated" });
    const guestSnapshot = getBasicContextSnapshot();
    useAuthStore.setState({ authMode: "authenticated" });
    const authSnapshot = getBasicContextSnapshot();
    // Both should have the same keys
    expect(Object.keys(guestSnapshot).sort()).toEqual(
      Object.keys(authSnapshot).sort(),
    );
    // But different values for authMode
    expect(guestSnapshot.authMode).toBe("unauthenticated");
    expect(authSnapshot.authMode).toBe("authenticated");
  });

  it("should include ONLY BASIC_CONTEXT_KEYS", () => {
    const snapshot = getBasicContextSnapshot();
    const keys = Object.keys(snapshot);
    expect(keys.every((k) => BASIC_CONTEXT_KEYS.includes(k as never))).toBe(
      true,
    );
  });
});

describe("getRichContextSnapshot edge cases", () => {
  it("should include ONLY RICH_CONTEXT_KEYS", () => {
    useConsentStore.setState({ richConsent: true });
    const snapshot = getRichContextSnapshot();
    expect(snapshot).not.toBeNull();
    const keys = Object.keys(snapshot!);
    expect(keys.every((k) => RICH_CONTEXT_KEYS.includes(k as never))).toBe(
      true,
    );
  });
});

// â”€â”€â”€ React Hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { renderHook } from "@testing-library/react";

describe("useBasicContextCapture", () => {
  it("should return basic context data on mount", () => {
    const { result } = renderHook(() => useBasicContextCapture());
    expect(result.current).toHaveProperty("theme");
    expect(result.current).toHaveProperty("authMode");
    expect(result.current).toHaveProperty("activeView");
  });

  it("should reflect updated store values", () => {
    const { result, rerender } = renderHook(() => useBasicContextCapture());
    expect(result.current.authMode).toBe("unauthenticated");
    useAuthStore.setState({ authMode: "authenticated" });
    rerender();
    expect(result.current.authMode).toBe("authenticated");
  });
});

describe("useRichContextCapture", () => {
  it("should return null when consent is off", () => {
    const { result } = renderHook(() => useRichContextCapture());
    expect(result.current).toBeNull();
  });

  it("should return rich context when consent is on", () => {
    useConsentStore.setState({ richConsent: true });
    const { result } = renderHook(() => useRichContextCapture());
    expect(result.current).not.toBeNull();
    expect(result.current).toHaveProperty("learningEvents");
  });

  it("should reflect consent toggle changes", () => {
    const { result, rerender } = renderHook(() => useRichContextCapture());
    expect(result.current).toBeNull();
    useConsentStore.setState({ richConsent: true });
    rerender();
    expect(result.current).not.toBeNull();
  });
});

describe("isRichCaptureAllowed", () => {
  it("should return false by default", () => {
    expect(isRichCaptureAllowed()).toBe(false);
  });

  it("should return true after consent is enabled", () => {
    useConsentStore.setState({ richConsent: true });
    expect(isRichCaptureAllowed()).toBe(true);
  });

  it("should return false after consent is toggled back off", () => {
    useConsentStore.setState({ richConsent: true });
    expect(isRichCaptureAllowed()).toBe(true);
    useConsentStore.setState({ richConsent: false });
    expect(isRichCaptureAllowed()).toBe(false);
  });
});

