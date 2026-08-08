import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionBar } from "../../../src/components/layout/ActionBar";
import { ActivityBar } from "../../../src/components/layout/ActivityBar";
import { ErrorBoundary } from "../../../src/components/ErrorBoundary";
import { useUIStore } from "../../../src/stores/ui";
import { useAuthStore } from "../../../src/stores/auth";
import { useChatStore } from "../../../src/stores/chat";
import { useGamificationStore } from "../../../src/stores/gamification";

// ── ActionBar child mocks ───────────────────────────────────────
vi.mock("../../../src/components/cloud/CloudSyncPanel", () => ({
  CloudSyncPanel: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="cloud-sync-panel">
      <button onClick={onClose}>cerrar</button>
    </div>
  ),
}));
vi.mock("../../../src/components/layout/ExportProjectButton", () => ({
  ExportProjectButton: () => <div data-testid="export-project-button" />,
}));
vi.mock("../../../src/components/gamification/XPBar", () => ({
  XPBar: () => <div data-testid="xp-bar" />,
}));
let sandboxResult = false;
vi.mock("../../../src/lib/sandbox", () => ({
  isSandboxWorkspace: () => sandboxResult,
}));

vi.mock("../../../src/auth/sso", () => ({
  logout: vi.fn(async () => {}),
}));

const hoisted = vi.hoisted(() => ({ projectState: {} as Record<string, unknown> }));

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector?: (state: Record<string, unknown>) => unknown) =>
      selector
        ? selector(hoisted.projectState as Record<string, unknown>)
        : (hoisted.projectState as Record<string, unknown>),
    { getState: () => hoisted.projectState, setState: (patch: Record<string, unknown>) => Object.assign(hoisted.projectState, patch) },
  ),
}));


function resetProjectState(overrides: Record<string, unknown> = {}) {
  Object.assign(hoisted.projectState, {
    activeWorkspaceId: null,
    workspaces: [],
    fileContents: {},
    openTabs: [],
    activeTab: null,
    isDirty: {},
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
    isSyncing: false,
    lastSyncedAt: null,
    hasUnsyncedChanges: false,
    autoBackupEnabled: true,
    syncError: null,
    syncProject: vi.fn(),
    restoreProject: vi.fn(),
    setAutoBackup: vi.fn(),
    statusMessage: null,
    clearStatusMessage: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sandboxResult = false;
  resetProjectState();
  useUIStore.setState({
    actionBarVisible: true,
    activityBarVisible: true,
    statusMessage: null,
    tokensRemaining: 0,
    setOmnibarOpen: vi.fn(),
    setSettingsVisible: vi.fn(),
    settingsVisible: false,
    activeSidebar: null,
    setActiveSidebar: vi.fn(),
  } as never);
  useChatStore.setState({ activeProvider: "", activeModelId: "" } as never);
  useAuthStore.setState({ authMode: "unauthenticated", user: null, plan: "free", setLoginModalOpen: vi.fn() } as never);
  useGamificationStore.setState({
    missionPanelOpen: false,
    missions: [],
    profile: null,
    setMissionPanelOpen: vi.fn(),
    fetchProfile: vi.fn(async () => {}),
  } as never);
});

describe("ActionBar", () => {
  it("should render nothing when hidden", () => {
    useUIStore.setState({ actionBarVisible: false } as never);
    const { container } = render(<ActionBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should render branding and open the omnibar", () => {
    render(<ActionBar />);
    expect(screen.getByText("Vibe Studio")).toBeDefined();
    fireEvent.click(screen.getByText(/Buscar comandos/));
    expect(useUIStore.getState().setOmnibarOpen).toHaveBeenCalledWith(true);
  });

  it("should show the connected provider and model", () => {
    useChatStore.setState({ activeProvider: "DeepSeek", activeModelId: "deepseek-v4-pro" } as never);
    render(<ActionBar />);
    expect(screen.getByText("DeepSeek")).toBeDefined();
  });

  it("should show git branch for a git workspace", () => {
    sandboxResult = false;
    resetProjectState({
      activeWorkspaceId: "ws-1",
      workspaces: [{ id: "ws-1", name: "p", path: "/p", files: [], isGitRepo: true, gitBranch: "main" }],
    });
    render(<ActionBar />);
    expect(screen.getByText("main")).toBeDefined();
  });

  it("should show the sandbox indicator for sandbox workspaces", () => {
    sandboxResult = true;
    resetProjectState({
      activeWorkspaceId: "sandbox-1",
      workspaces: [{ id: "sandbox-1", name: "sb", path: "/sb", files: [], isGitRepo: false, gitBranch: null }],
    });
    render(<ActionBar />);
    expect(screen.getByText("Sandbox")).toBeDefined();
  });

  it("should show status message and token count", () => {
    useUIStore.setState({ statusMessage: "Guardando...", tokensRemaining: 1200 } as never);
    render(<ActionBar />);
    expect(screen.getByText("Guardando...")).toBeDefined();
    expect(document.body.textContent).toContain("tkn");
  });

  it("should show guest auth badge for unauthenticated users", () => {
    useAuthStore.setState({ authMode: "unauthenticated", user: null } as never);
    render(<ActionBar />);
    expect(screen.getByText("Invitado")).toBeDefined();
  });

  it("should show the user email for authenticated users", () => {
    useAuthStore.setState({ authMode: "authenticated", user: { id: "u", email: "opita@co", name: "x", plan: "pro", verified: true } } as never);
    render(<ActionBar />);
    expect(screen.getByText("opita@co")).toBeDefined();
  });

  it("should open the cloud sync panel and close it", () => {
    render(<ActionBar />);
    expect(screen.queryByTestId("cloud-sync-panel")).toBeNull();
    fireEvent.click(screen.getByLabelText("Abrir panel de respaldo en la nube"));
    expect(screen.getByTestId("cloud-sync-panel")).toBeDefined();
    fireEvent.click(screen.getByText("cerrar"));
    expect(screen.queryByTestId("cloud-sync-panel")).toBeNull();
  });
});

describe("ActivityBar", () => {
  it("should render nothing when hidden", () => {
    useUIStore.setState({ activityBarVisible: false } as never);
    const { container } = render(<ActivityBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should render the explorer button and toggle the sidebar", () => {
    useUIStore.setState({ activeSidebar: null } as never);
    render(<ActivityBar />);
    fireEvent.click(screen.getByLabelText("Explorador de Archivos"));
    expect(useUIStore.getState().setActiveSidebar).toHaveBeenCalledWith("explorer");
  });

  it("should render missions for authenticated users and toggle the panel", () => {
    useAuthStore.setState({ authMode: "authenticated", user: { id: "u", email: "a@b.co", name: "x", plan: "free", verified: false } } as never);
    render(<ActivityBar />);
    const missionsBtn = screen.getByLabelText("Misiones Diarias");
    fireEvent.click(missionsBtn);
    expect(useGamificationStore.getState().setMissionPanelOpen).toHaveBeenCalled();
  });

  it("should call fetchProfile on mount for authenticated users", () => {
    const fetchProfile = vi.fn(async () => {});
    useAuthStore.setState({ authMode: "authenticated", user: { id: "u", email: "a@b.co", name: "x", plan: "free", verified: false } } as never);
    useGamificationStore.setState({ fetchProfile } as never);
    render(<ActivityBar />);
    expect(fetchProfile).toHaveBeenCalled();
  });

  it("should open settings via the settings button", () => {
    render(<ActivityBar />);
    fireEvent.click(screen.getByLabelText("Configuración"));
    expect(useUIStore.getState().setSettingsVisible).toHaveBeenCalledWith(true);
  });

  it("should open the profile menu and show account actions for authenticated users", async () => {
    useAuthStore.setState({
      authMode: "authenticated",
      user: { id: "u", email: "opita@co", name: "x", plan: "pro", verified: false },
    } as never);
    useGamificationStore.setState({
      profile: { totalXp: 500, level: 2, streakDays: 3, lastActiveDate: "", earnedQuota: 0, effectiveDailyQuota: 150000 },
    } as never);
    render(<ActivityBar />);
    fireEvent.click(screen.getByLabelText("Perfil y Cuenta"));
    expect(screen.getByText("opita@co")).toBeDefined();
    expect(screen.getByText("Gestionar cuenta")).toBeDefined();
    fireEvent.click(screen.getByText("Cerrar sesión"));
    await vi.waitFor(() => expect(screen.queryByText("Gestionar cuenta")).toBeNull());
  });
});

describe("ErrorBoundary", () => {
  function Bomb(): ReactNode {
    throw new Error("boom");
  }

  it("should render children normally when there is no error", () => {
    render(<ErrorBoundary><div>contenido</div></ErrorBoundary>);
    expect(screen.getByText("contenido")).toBeDefined();
  });

  it("should render the fallback UI when a child throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ErrorBoundary name="Test"><Bomb /></ErrorBoundary>);
    expect(screen.getByText("Algo salió mal en este panel")).toBeDefined();
    expect(screen.getByText("boom")).toBeDefined();
  });

  it("should use the custom fallback when provided", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<ErrorBoundary fallback={<div>fallback custom</div>}><Bomb /></ErrorBoundary>);
    expect(screen.getByText("fallback custom")).toBeDefined();
  });
});
