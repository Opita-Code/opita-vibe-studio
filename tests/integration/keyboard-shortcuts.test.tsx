import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import App from "../../src/App";
import { useAuthStore } from "../../src/stores/auth";
import { useUIStore } from "../../src/stores/ui";

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "unauthenticated",
    sessionDetected: true,
    isLoading: false,
    hasCompletedOnboarding: true,
    tokenUsage: {
      promptsUsed: 0,
      promptsLimit: 30,
      billingPeriodStart: new Date().toISOString(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
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
  });
});

afterEach(() => {
  // Clean up any leftover event listeners
  vi.restoreAllMocks();
});

describe("Keyboard shortcuts â€” global handlers in App", () => {
  it("Ctrl+1 should switch to preview view", () => {
    // Set to editor first
    useUIStore.getState().setActiveView("editor");
    render(<App />);
    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(useUIStore.getState().activeView).toBe("preview");
  });

  it("Ctrl+2 should switch to editor view", () => {
    render(<App />);
    // Default is preview â€” verify it switches
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });
    expect(useUIStore.getState().activeView).toBe("editor");
  });

  it("Ctrl+B should toggle explorer visibility", () => {
    render(<App />);
    // Default is collapsed (false)
    expect(useUIStore.getState().explorerVisible).toBe(false);
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(useUIStore.getState().explorerVisible).toBe(true);
    // Toggle again
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(useUIStore.getState().explorerVisible).toBe(false);
  });

  it("Ctrl+, should toggle settings visibility", () => {
    render(<App />);
    // Default is closed (false)
    expect(useUIStore.getState().settingsVisible).toBe(false);
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    expect(useUIStore.getState().settingsVisible).toBe(true);
    // Toggle again
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    expect(useUIStore.getState().settingsVisible).toBe(false);
  });

  it("should not trigger shortcuts without Ctrl key", () => {
    render(<App />);
    useUIStore.getState().setActiveView("preview");
    // Press 2 without Ctrl â€” should NOT change view
    fireEvent.keyDown(window, { key: "2", ctrlKey: false });
    expect(useUIStore.getState().activeView).toBe("preview");
  });

  it("should not trigger shortcuts when Meta key held instead of Ctrl", () => {
    render(<App />);
    useUIStore.getState().setActiveView("preview");
    // Press 2 with Meta â€” should NOT change view
    fireEvent.keyDown(window, { key: "2", metaKey: true });
    expect(useUIStore.getState().activeView).toBe("preview");
  });
});

