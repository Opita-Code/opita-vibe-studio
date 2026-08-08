import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "../../../src/components/layout/CommandPalette";
import { useUIStore } from "../../../src/stores/ui";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// ── Dynamic-imported stores (await import(...)) ─────────────────
const gamificationState = {
  missionPanelOpen: false,
  setMissionPanelOpen: vi.fn(),
};
const chatState = {
  createNewSession: vi.fn(),
};

vi.mock("../../../src/stores/gamification", () => ({
  useGamificationStore: {
    getState: () => gamificationState,
  },
}));

vi.mock("../../../src/stores/chat", () => ({
  useChatStore: {
    getState: () => chatState,
  },
}));

vi.mock("jszip", () => ({
  default: class MockZip {
    file() {}
    async generateAsync() {
      return new Blob(["zip"]);
    }
  },
}));

// ── Project store (for EXPORT_PROJECT) ──────────────────────────
const projectState = {
  activeWorkspaceId: "ws-1",
  workspaces: [{ id: "ws-1", name: "proyecto", path: "/p", files: [], isGitRepo: false, gitBranch: null }],
  fileContents: { "ws-1/src/index.ts": "const a = 1;" },
};

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector(projectState as unknown as Record<string, unknown>),
    { getState: () => projectState },
  ),
}));

function openPalette() {
  useUIStore.setState({ omnibarOpen: true, omnibarQuery: "" });
  return render(<CommandPalette />);
}

beforeEach(() => {
  useUIStore.setState({ omnibarOpen: false, omnibarQuery: "", bugReportVisible: false, settingsVisible: false, terminalVisible: false, activeSidebar: null });
  vi.clearAllMocks();
});

afterEach(() => {
  useUIStore.setState({ omnibarOpen: false, omnibarQuery: "" });
});

describe("CommandPalette", () => {
  it("should render nothing when closed", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should render search input and commands when open", () => {
    openPalette();
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
    expect(screen.getByText("Nuevo Archivo")).toBeDefined();
    expect(screen.getByText("Exportar Proyecto")).toBeDefined();
  });

  it("should toggle open state with Ctrl+P", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "p", ctrlKey: true });
    expect(useUIStore.getState().omnibarOpen).toBe(true);
  });

  it("should close with Escape", () => {
    openPalette();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUIStore.getState().omnibarOpen).toBe(false);
  });

  it("should filter commands when typing in the query", () => {
    openPalette();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "export" } });
    expect(screen.getByText("Exportar Proyecto")).toBeDefined();
    expect(screen.queryByText("Nuevo Archivo")).toBeNull();
  });

  it("should filter by command prefix with '>'", () => {
    openPalette();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: ">termin" } });
    expect(screen.getByText("Alternar Terminal")).toBeDefined();
    expect(screen.queryByText("Configuración del Editor")).toBeNull();
  });

  it("should show empty state when nothing matches", () => {
    openPalette();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzzz" } });
    expect(screen.getByText(/No encontramos nada/)).toBeDefined();
  });

  it("should navigate items with ArrowDown and ArrowUp", () => {
    openPalette();
    const items = screen.getAllByRole("option");
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(items[1].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(items[0].getAttribute("aria-selected")).toBe("true");
  });

  it("should report a bug when REPORT_BUG item is activated", () => {
    openPalette();
    fireEvent.click(screen.getByText("Reportar Bug"));
    expect(useUIStore.getState().bugReportVisible).toBe(true);
    expect(useUIStore.getState().omnibarOpen).toBe(false);
  });

  it("should open settings for OPEN_SETTINGS item", () => {
    openPalette();
    fireEvent.click(screen.getByText("Configuración del Editor"));
    expect(useUIStore.getState().settingsVisible).toBe(true);
  });

  it("should dispatch create-file event for NEW_FILE", () => {
    const listener = vi.fn();
    window.addEventListener("vibe:create-file", listener);
    openPalette();
    fireEvent.click(screen.getByText("Nuevo Archivo"));
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("vibe:create-file", listener);
  });

  it("should toggle missions panel via dynamic import", async () => {
    openPalette();
    fireEvent.click(screen.getByText("Abrir Misiones"));
    await vi.waitFor(() => {
      expect(gamificationState.setMissionPanelOpen).toHaveBeenCalledWith(true);
    });
  });

  it("should toggle chat fullscreen", () => {
    openPalette();
    fireEvent.click(screen.getByText("Chat Pantalla Completa"));
    expect(useUIStore.getState().chatFullscreen).toBe(true);
  });

  it("should create a new chat session via dynamic import", async () => {
    openPalette();
    fireEvent.click(screen.getByText("Nuevo Chat"));
    await vi.waitFor(() => {
      expect(chatState.createNewSession).toHaveBeenCalled();
    });
  });

  it("should toggle explorer sidebar", () => {
    useUIStore.setState({ activeSidebar: "explorer" });
    openPalette();
    fireEvent.click(screen.getByText("Alternar Explorador"));
    expect(useUIStore.getState().activeSidebar).toBeNull();
  });

  it("should toggle terminal", () => {
    useUIStore.setState({ terminalVisible: false });
    openPalette();
    fireEvent.click(screen.getByText("Alternar Terminal"));
    expect(useUIStore.getState().terminalVisible).toBe(true);
  });

  it("should export project as zip", async () => {
    openPalette();
    fireEvent.click(screen.getByText("Exportar Proyecto"));
    await vi.waitFor(() => {
      expect(useUIStore.getState().statusMessage).toContain("Proyecto exportado");
    });
  });

  it("should show error when exporting without a project", async () => {
    projectState.workspaces = [];
    openPalette();
    fireEvent.click(screen.getByText("Exportar Proyecto"));
    await vi.waitFor(() => {
      expect(useUIStore.getState().statusMessage).toBe("Abre un proyecto para exportarlo.");
    });
    projectState.workspaces = [{ id: "ws-1", name: "proyecto", path: "/p", files: [], isGitRepo: false, gitBranch: null }];
  });

  it("should close the palette when clicking the backdrop", () => {
    openPalette();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog.parentElement!);
    expect(useUIStore.getState().omnibarOpen).toBe(false);
  });

  it("should execute the selected item when Enter is pressed", () => {
    openPalette();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(useUIStore.getState().omnibarOpen).toBe(false);
  });
});
