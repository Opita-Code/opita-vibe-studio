import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CloudSyncPanel } from "../../../src/components/cloud/CloudSyncPanel";
import { useAuthStore } from "../../../src/stores/auth";

const hoisted = vi.hoisted(() => ({ projectState: {} as Record<string, unknown> }));

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (sel?: (s: Record<string, unknown>) => unknown) => (sel ? sel(hoisted.projectState) : hoisted.projectState),
    { getState: () => hoisted.projectState },
  ),
}));

function reset(overrides: Record<string, unknown> = {}) {
  Object.assign(hoisted.projectState, {
    activeWorkspaceId: null,
    workspaces: [],
    isSyncing: false,
    lastSyncedAt: null,
    hasUnsyncedChanges: false,
    autoBackupEnabled: true,
    syncError: null,
    syncProject: vi.fn(),
    restoreProject: vi.fn(),
    setAutoBackup: vi.fn(),
    ...overrides,
  });
}

const AUTH_USER = { id: "u", email: "a@b.co", name: "x", plan: "free", verified: false };

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  useAuthStore.setState({ authMode: "guest", user: null } as never);
});

describe("CloudSyncPanel", () => {
  it("should show the login prompt for unauthenticated users", () => {
    render(<CloudSyncPanel />);
    expect(screen.getByText(/Inicia sesión para respaldar/)).toBeDefined();
  });

  it("should open the login modal from the guest prompt", () => {
    const setLoginModalOpen = vi.fn();
    useAuthStore.setState({ setLoginModalOpen } as never);
    render(<CloudSyncPanel />);
    fireEvent.click(screen.getByText("Iniciar Sesión"));
    expect(setLoginModalOpen).toHaveBeenCalledWith(true);
  });

  it("should show the no-project state for authenticated users without a workspace", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    render(<CloudSyncPanel />);
    expect(screen.getByText("No hay un proyecto abierto.")).toBeDefined();
  });

  it("should render sync controls with a project", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    reset({ activeWorkspaceId: "ws-1" });
    render(<CloudSyncPanel />);
    expect(screen.getByText("Todo respaldado")).toBeDefined();
    expect(screen.getByText("Respaldar")).toBeDefined();
    expect(screen.getByText("Restaurar")).toBeDefined();
    expect(screen.getByText("Auto-respaldo al guardar")).toBeDefined();
  });

  it("should call syncProject on backup", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    const syncProject = vi.fn();
    reset({ activeWorkspaceId: "ws-1", syncProject });
    render(<CloudSyncPanel />);
    fireEvent.click(screen.getByText("Respaldar"));
    expect(syncProject).toHaveBeenCalled();
  });

  it("should call restoreProject on restore", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    const restoreProject = vi.fn();
    reset({ activeWorkspaceId: "ws-1", restoreProject });
    render(<CloudSyncPanel />);
    fireEvent.click(screen.getByText("Restaurar"));
    expect(restoreProject).toHaveBeenCalled();
  });

  it("should toggle auto-backup", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    const setAutoBackup = vi.fn();
    reset({ activeWorkspaceId: "ws-1", autoBackupEnabled: true, setAutoBackup });
    render(<CloudSyncPanel />);
    fireEvent.click(screen.getByLabelText("Desactivar auto-respaldo"));
    expect(setAutoBackup).toHaveBeenCalledWith(false);
  });

  it("should show syncing status and sync error", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    reset({ activeWorkspaceId: "ws-1", isSyncing: true, syncError: "Fallo de red" });
    render(<CloudSyncPanel />);
    expect(screen.getByText("Sincronizando...")).toBeDefined();
    expect(screen.getByText("Fallo de red")).toBeDefined();
  });

  it("should show unsynced changes state", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    reset({ activeWorkspaceId: "ws-1", hasUnsyncedChanges: true });
    render(<CloudSyncPanel />);
    expect(screen.getByText("Cambios sin respaldar")).toBeDefined();
  });

  it("should format last sync time", () => {
    useAuthStore.setState({ authMode: "authenticated", user: AUTH_USER } as never);
    reset({ activeWorkspaceId: "ws-1", lastSyncedAt: new Date(Date.now() - 30_000) });
    render(<CloudSyncPanel />);
    expect(screen.getByText("Hace un momento")).toBeDefined();
  });

  it("should close via onClose", () => {
    const onClose = vi.fn();
    render(<CloudSyncPanel onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Cerrar panel de sincronización"));
    expect(onClose).toHaveBeenCalled();
  });
});
