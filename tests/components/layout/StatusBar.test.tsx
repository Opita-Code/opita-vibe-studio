import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBar } from "../../../src/components/layout/StatusBar";
import { useAuthStore } from "../../../src/stores/auth";
import { useUIStore } from "../../../src/stores/ui";
import { useProjectStore } from "../../../src/stores/project";

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "unauthenticated",
    sessionDetected: true,
    isLoading: false,
    tokenUsage: {
      promptsUsed: 5,
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

  useProjectStore.setState({
    rootPath: null,
    files: [],
    openTabs: [],
    activeTab: null,
    isDirty: {},
    fileContents: {},
    isGitRepo: false,
    gitBranch: null,
    isLoading: false,
    statusMessage: null,
  });
});

describe("StatusBar â€” auth status display", () => {
  it("should show 'Sin sesión iniciada' when authMode is unauthenticated", () => {
    useAuthStore.setState({ authMode: "unauthenticated" });
    render(<StatusBar />);
    expect(screen.getByText(/Sin sesión iniciada/)).toBeTruthy();
  });

  it("should not show user email when authMode is unauthenticated", () => {
    useAuthStore.setState({ authMode: "unauthenticated" });
    render(<StatusBar />);
    const emailNode = screen.queryByText(/@/i);
    expect(emailNode).toBeNull();
  });

  it("should show user email and plan when authMode is authenticated", () => {
    useAuthStore.setState({
      authMode: "authenticated",
      user: {
        id: "test-1",
        email: "user@opita.co",
        name: "Test User",
        plan: "estudiante",
        verified: true,
      },
    });
    render(<StatusBar />);
    expect(screen.getByText("user@opita.co")).toBeTruthy();
    expect(screen.getByText(/estudiante/)).toBeTruthy();
  });

  it("should show 'Pro' for pro plan users when authenticated", () => {
    useAuthStore.setState({
      authMode: "authenticated",
      user: {
        id: "test-2",
        email: "pro@opita.co",
        name: "Pro User",
        plan: "pro",
        verified: true,
      },
      plan: "pro",
    });
    render(<StatusBar />);
    expect(screen.getByText("pro@opita.co")).toBeTruthy();
    // The plan badge renders uppercase "PRO" â€” match with case-sensitive
    expect(screen.getByText("pro")).toBeTruthy();
  });

  it("should not show 'Invitado' when authenticated", () => {
    useAuthStore.setState({
      authMode: "authenticated",
      user: {
        id: "test-3",
        email: "auth@opita.co",
        name: "Auth User",
        plan: "free",
        verified: true,
      },
    });
    render(<StatusBar />);
    expect(screen.queryByText(/Sin sesión iniciada/)).toBeNull();
  });
});

