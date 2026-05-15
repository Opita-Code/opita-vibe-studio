import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProjectStore } from "../../src/stores/project";

// Mocks para módulos de sistema de archivos
vi.mock("../../src/lib/fs", () => ({
  loadProject: vi.fn(),
  readFileContent: vi.fn(),
  saveFileContent: vi.fn(),
  isGitRepo: vi.fn(),
}));
vi.mock("../../src/lib/git", () => ({
  getGitBranch: vi.fn(),
}));
vi.mock("../../src/lib/ipc", () => ({
  writeFile: vi.fn(),
}));
vi.mock("../../src/lib/fs-backend/opfs-persistence", () => ({
  persistToOPFS: vi.fn(),
  startAutoPersist: vi.fn(() => () => {}),
}));

import { loadProject, readFileContent, saveFileContent, isGitRepo } from "../../src/lib/fs";
import { getGitBranch } from "../../src/lib/git";

const resetStore = () => {
  useProjectStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    openTabs: [],
    activeTab: null,
    isDirty: {},
    fileContents: {},
    isLoading: false,
    statusMessage: null,
    diffMode: false,
    diffOriginalContent: "",
    diffModifiedContent: "",
    isSyncing: false,
    lastSyncedAt: null,
    hasUnsyncedChanges: false,
    autoBackupEnabled: false,
    syncError: null,
  });
};

beforeEach(() => {
  resetStore();
});

describe("ProjectStore — workspace management", () => {
  it("should start with no workspaces", () => {
    const state = useProjectStore.getState();
    expect(state.workspaces).toHaveLength(0);
    expect(state.activeWorkspaceId).toBeNull();
  });

  it("should update workspace git info", () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/test",
        name: "test",
        path: "/test",
        files: [],
        isGitRepo: false,
        gitBranch: null,
      }],
      activeWorkspaceId: "/test",
    });

    const store = useProjectStore.getState();
    store.updateWorkspaceGitInfo("/test", "main", true);
    const ws = useProjectStore.getState().workspaces.find(w => w.id === "/test");
    expect(ws?.gitBranch).toBe("main");
    expect(ws?.isGitRepo).toBe(true);
  });

  it("should update workspace files", () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/test",
        name: "test",
        path: "/test",
        files: [],
        isGitRepo: false,
        gitBranch: null,
      }],
      activeWorkspaceId: "/test",
    });

    const files = [
      { name: "index.html", path: "/test/index.html", type: "file" as const },
    ];
    const store = useProjectStore.getState();
    store.updateWorkspaceFiles("/test", files);
    const ws = useProjectStore.getState().workspaces.find(w => w.id === "/test");
    expect(ws?.files).toEqual(files);
  });
});

describe("ProjectStore — tab management", () => {
  it("should open a tab and set it as active", () => {
    const store = useProjectStore.getState();
    store.openTab("/test/file.ts");
    const state = useProjectStore.getState();
    expect(state.openTabs).toContain("/test/file.ts");
    expect(state.activeTab).toBe("/test/file.ts");
  });

  it("should not duplicate tabs", () => {
    const store = useProjectStore.getState();
    store.openTab("/test/file.ts");
    store.openTab("/test/file.ts");
    expect(useProjectStore.getState().openTabs).toHaveLength(1);
  });

  it("should close a tab and switch active if needed", () => {
    const store = useProjectStore.getState();
    store.openTab("/test/a.ts");
    store.openTab("/test/b.ts");
    store.closeTab("/test/a.ts");
    const state = useProjectStore.getState();
    expect(state.openTabs).not.toContain("/test/a.ts");
    expect(state.activeTab).toBe("/test/b.ts");
  });

  it("should set active tab to null when closing the only tab", () => {
    const store = useProjectStore.getState();
    store.openTab("/test/a.ts");
    store.closeTab("/test/a.ts");
    const state = useProjectStore.getState();
    expect(state.openTabs).toHaveLength(0);
    expect(state.activeTab).toBeNull();
  });

  it("should mark and clear dirty state", () => {
    const store = useProjectStore.getState();
    store.markDirty("/test/file.ts");
    expect(useProjectStore.getState().isDirty["/test/file.ts"]).toBe(true);
    store.markClean("/test/file.ts");
    expect(useProjectStore.getState().isDirty["/test/file.ts"]).toBe(false);
  });

  it("should check if a tab is open", () => {
    const store = useProjectStore.getState();
    expect(store.isTabOpen("/test/file.ts")).toBe(false);
    store.openTab("/test/file.ts");
    expect(useProjectStore.getState().isTabOpen("/test/file.ts")).toBe(true);
  });
});

describe("ProjectStore — file content", () => {
  it("should set file content and mark dirty", () => {
    const store = useProjectStore.getState();
    store.openTab("/test/file.ts");
    store.setFileContent("/test/file.ts", "const x = 1;");
    const state = useProjectStore.getState();
    expect(state.fileContents["/test/file.ts"]).toBe("const x = 1;");
    expect(state.isDirty["/test/file.ts"]).toBe(true);
  });

  it("should clean file content and dirty state on closeTab", () => {
    const store = useProjectStore.getState();
    store.openTab("/test/file.ts");
    store.setFileContent("/test/file.ts", "content");
    store.closeTab("/test/file.ts");
    const state = useProjectStore.getState();
    expect(state.fileContents["/test/file.ts"]).toBeUndefined();
    expect(state.isDirty["/test/file.ts"]).toBeUndefined();
  });

  it("should clear status message", () => {
    const store = useProjectStore.getState();
    useProjectStore.setState({ statusMessage: "Guardado" });
    store.clearStatusMessage();
    expect(useProjectStore.getState().statusMessage).toBeNull();
  });
});

// ── Async actions (with mocks) ─────────────────────────────

describe("ProjectStore — async actions", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("should save a file via saveFile", async () => {
    (saveFileContent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useProjectStore.getState();
    store.openTab("/test/file.ts");
    store.setFileContent("/test/file.ts", "const x = 1;");
    await store.saveFile("/test/file.ts");

    const state = useProjectStore.getState();
    expect(saveFileContent).toHaveBeenCalledWith("/test/file.ts", "const x = 1;");
    expect(state.isDirty["/test/file.ts"]).toBe(false);
    expect(state.statusMessage).toBe("Guardado");
  });

  it("saveFile should set error status on failure", async () => {
    (saveFileContent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Permission denied"),
    );

    const store = useProjectStore.getState();
    store.openTab("/test/file.ts");
    store.setFileContent("/test/file.ts", "content");
    await store.saveFile("/test/file.ts");

    const state = useProjectStore.getState();
    expect(state.statusMessage).toContain("Permission denied");
  });

  it("closeTabWithSave should save dirty files before closing", async () => {
    (saveFileContent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useProjectStore.getState();
    store.openTab("/test/dirty.ts");
    store.setFileContent("/test/dirty.ts", "dirty content");
    await store.closeTabWithSave("/test/dirty.ts");

    expect(saveFileContent).toHaveBeenCalledWith("/test/dirty.ts", "dirty content");
    const state = useProjectStore.getState();
    expect(state.openTabs).not.toContain("/test/dirty.ts");
  });

  it("openProject should load files and create workspace", async () => {
    const mockFiles = [
      { name: "index.html", path: "/test/index.html", type: "file" as const },
      { name: "src", path: "/test/src", type: "directory" as const, children: [] },
    ];
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (getGitBranch as ReturnType<typeof vi.fn>).mockResolvedValue("main");

    const store = useProjectStore.getState();
    await store.openProject("/test");

    const state = useProjectStore.getState();
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0].path).toBe("/test");
    expect(state.workspaces[0].files).toEqual(mockFiles);
    expect(state.workspaces[0].isGitRepo).toBe(true);
    expect(state.workspaces[0].gitBranch).toBe("main");
    expect(state.activeWorkspaceId).toBe("/test");
    expect(state.isLoading).toBe(false);
  });

  it("openProject should handle non-git projects", async () => {
    const mockFiles = [{ name: "index.html", path: "/test/index.html", type: "file" as const }];
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const store = useProjectStore.getState();
    await store.openProject("/test");

    const state = useProjectStore.getState();
    expect(state.workspaces[0].isGitRepo).toBe(false);
    expect(state.workspaces[0].gitBranch).toBeNull();
    expect(state.workspaces[0].files).toEqual(mockFiles);
  });

  it("openProject should show error on failure", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Folder not found"),
    );

    const store = useProjectStore.getState();
    await store.openProject("/invalid");

    const state = useProjectStore.getState();
    expect(state.statusMessage).toContain("Folder not found");
    expect(state.isLoading).toBe(false);
  });

  it("openFile should read content and open tab", async () => {
    (readFileContent as ReturnType<typeof vi.fn>).mockResolvedValue("file content");

    const store = useProjectStore.getState();
    await store.openFile("/test/file.ts");

    const state = useProjectStore.getState();
    expect(readFileContent).toHaveBeenCalledWith("/test/file.ts");
    expect(state.openTabs).toContain("/test/file.ts");
    expect(state.activeTab).toBe("/test/file.ts");
    expect(state.fileContents["/test/file.ts"]).toBe("file content");
  });

  it("openFile should not re-read already open files", async () => {
    (readFileContent as ReturnType<typeof vi.fn>).mockResolvedValue("initial content");

    const store = useProjectStore.getState();
    await store.openFile("/test/file.ts");
    vi.clearAllMocks();

    // Abrir de nuevo — no debería llamar readFileContent otra vez
    await store.openFile("/test/file.ts");
    expect(readFileContent).not.toHaveBeenCalled();
  });

  it("openFile should show error on failure", async () => {
    (readFileContent as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("File not found"),
    );

    const store = useProjectStore.getState();
    await store.openFile("/test/missing.ts");

    const state = useProjectStore.getState();
    expect(state.statusMessage).toContain("File not found");
  });
});
