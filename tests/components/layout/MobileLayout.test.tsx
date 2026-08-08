import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileLayout } from "../../../src/components/layout/MobileLayout";
import { useUIStore } from "../../../src/stores/ui";
import { useAuthStore } from "../../../src/stores/auth";
import { useGamificationStore } from "../../../src/stores/gamification";

// ── Heavy child mocks ───────────────────────────────────────────
vi.mock("../../../src/renderer/layouts/SidebarSlot", () => ({
  SidebarSlot: () => <div data-testid="sidebar-slot">Sidebar</div>,
}));
vi.mock("../../../src/renderer/layouts/EditorSlot", () => ({
  EditorSlot: () => <div data-testid="editor-slot">Editor</div>,
}));
vi.mock("../../../src/renderer/AppLifecycle", () => ({
  AppLifecycle: () => <div data-testid="app-lifecycle" />,
}));
vi.mock("../../../src/components/editor/FileWatcher", () => ({
  FileWatcher: () => <div data-testid="file-watcher" />,
}));
vi.mock("../../../src/components/chat/ChatHistoryPanel", () => ({
  ChatHistoryPanel: () => <div data-testid="chat-history-panel">Historial</div>,
}));
vi.mock("../../../src/components/layout/MobileHubView", () => ({
  MobileHubView: () => <div data-testid="mobile-hub">Hub</div>,
}));
vi.mock("../../../src/components/settings/SettingsPanel", () => ({
  SettingsPanel: () => <div data-testid="settings-panel" />,
}));
vi.mock("../../../src/components/layout/BugReportModal", () => ({
  BugReportModal: () => <div data-testid="bug-report-modal" />,
}));
vi.mock("../../../src/components/usage/WompiModal", () => ({
  WompiModal: () => <div data-testid="wompi-modal" />,
}));
vi.mock("../../../src/components/layout/CommandPalette", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));
vi.mock("../../../src/components/gamification/MissionPanel", () => ({
  MissionPanel: () => <div data-testid="mission-panel" />,
}));
vi.mock("../../../src/components/gamification/LevelUpCeremony", () => ({
  LevelUpCeremony: () => <div data-testid="level-up-ceremony">Subiste de nivel</div>,
}));
vi.mock("../../../src/components/gamification/XPParticleSystem", () => ({
  XPParticleSystem: () => <div data-testid="xp-particles" />,
}));

describe("MobileLayout", () => {
  beforeEach(() => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({
      pendingMilestone: null,
      dismissMilestone: vi.fn(),
    } as never);
    useUIStore.setState({
      chatHistoryVisible: false,
      settingsVisible: false,
      activeView: "preview",
      activeSidebar: null,
      omnibarOpen: false,
      omnibarQuery: "",
    });
  });

  it("should render the mobile header and bottom nav", () => {
    render(<MobileLayout />);
    expect(screen.getByText("Vibe AI")).toBeDefined();
    expect(screen.getByLabelText("Navegación principal")).toBeDefined();
    expect(screen.getByLabelText("Ir a IA")).toBeDefined();
    expect(screen.getByLabelText("Ir a Code")).toBeDefined();
    expect(screen.getByLabelText("Ir a Vista")).toBeDefined();
    expect(screen.getByLabelText("Ir a Más")).toBeDefined();
  });

  it("should render the chat view by default", () => {
    render(<MobileLayout />);
    expect(screen.getByTestId("sidebar-slot")).toBeDefined();
  });

  it("should hide the Hub tab for guest users", () => {
    useAuthStore.setState({ authMode: "guest" } as never);
    render(<MobileLayout />);
    expect(screen.queryByLabelText("Ir a Hub")).toBeNull();
  });

  it("should switch to the code tab", () => {
    render(<MobileLayout />);
    fireEvent.click(screen.getByLabelText("Ir a Code"));
    expect(screen.getByTestId("editor-slot")).toBeDefined();
  });

  it("should switch to the preview tab and set active view to preview", () => {
    render(<MobileLayout />);
    fireEvent.click(screen.getByLabelText("Ir a Vista"));
    expect(screen.getByTestId("editor-slot")).toBeDefined();
    expect(useUIStore.getState().activeView).toBe("preview");
  });

  it("should switch to the hub tab", () => {
    render(<MobileLayout />);
    fireEvent.click(screen.getByLabelText("Ir a Hub"));
    expect(screen.getByTestId("mobile-hub")).toBeDefined();
  });

  it("should open settings dialog when settings tab is pressed", () => {
    render(<MobileLayout />);
    fireEvent.click(screen.getByLabelText("Ir a Más"));
    expect(useUIStore.getState().settingsVisible).toBe(true);
  });

  it("should toggle the chat history drawer", () => {
    render(<MobileLayout />);
    expect(screen.queryByTestId("chat-history-panel")).toBeNull();
    fireEvent.click(screen.getByLabelText("Menú de historial"));
    expect(screen.getByTestId("chat-history-panel")).toBeDefined();
    // close by clicking the toggle again
    fireEvent.click(screen.getByLabelText("Menú de historial"));
    expect(useUIStore.getState().chatHistoryVisible).toBe(false);
  });

  it("should render level up ceremony when a milestone is pending", () => {
    useGamificationStore.setState({
      pendingMilestone: { level: 2, badge: "badge", label: "Subiste", quotaBoost: 5000 },
    } as never);
    render(<MobileLayout />);
    expect(screen.getByTestId("level-up-ceremony")).toBeDefined();
  });
});
