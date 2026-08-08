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

const pushToCloud = vi.fn();
const pullFromCloud = vi.fn();
vi.mock("../../src/lib/sync", () => ({
  SyncEngine: { pushToCloud, pullFromCloud },
}));

const getFileSystemBackend = vi.fn(() => ({ label: "browser" }));
vi.mock("../../src/lib/fs-backend", () => ({
  getFileSystemBackend,
  createFileSystemBackend: vi.fn(),
  setFileSystemBackend: vi.fn(),
}));

const getLastSnapshot = vi.fn();
vi.mock("../../src/tools/fileSnapshot", () => ({
  getLastSnapshot,
  saveSnapshot: vi.fn(),
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

// ── addWorkspace / removeWorkspace ──────────────────────────────

describe("ProjectStore — addWorkspace", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("should add a workspace and set it active", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await useProjectStore.getState().addWorkspace("/repo/app");

    const state = useProjectStore.getState();
    expect(state.workspaces).toHaveLength(1);
    expect(state.workspaces[0].id).toBe("/repo/app");
    expect(state.workspaces[0].name).toBe("app");
    expect(state.activeWorkspaceId).toBe("/repo/app");
    expect(state.statusMessage).toBe("Workspace añadido: app");
  });

  it("should fetch the git branch for git repos", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (getGitBranch as ReturnType<typeof vi.fn>).mockResolvedValue("develop");

    await useProjectStore.getState().addWorkspace("/repo/app");

    const ws = useProjectStore.getState().workspaces[0];
    expect(ws.isGitRepo).toBe(true);
    expect(ws.gitBranch).toBe("develop");
  });

  it("should not duplicate an existing workspace", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await useProjectStore.getState().addWorkspace("/repo/app");
    await useProjectStore.getState().addWorkspace("/repo/app");

    expect(useProjectStore.getState().workspaces).toHaveLength(1);
  });

  it("should report errors without crashing", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Access denied"),
    );

    await useProjectStore.getState().addWorkspace("/bad");

    const state = useProjectStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.statusMessage).toContain("Access denied");
  });

  it("should fall back to 'Project' as name when the path has no basename", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await useProjectStore.getState().addWorkspace("/");
    expect(useProjectStore.getState().workspaces[0].name).toBe("Project");
  });
});

describe("ProjectStore — removeWorkspace", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  const seedWorkspace = (id: string) => ({
    id,
    name: id,
    path: id,
    files: [],
    isGitRepo: false,
    gitBranch: null,
  });

  it("should close tabs belonging to the workspace and switch active", () => {
    useProjectStore.setState({
      workspaces: [seedWorkspace("/a"), seedWorkspace("/b")],
      activeWorkspaceId: "/a",
      openTabs: ["/a/x.ts", "/b/y.ts"],
      activeTab: "/a/x.ts",
    });

    useProjectStore.getState().removeWorkspace("/a");

    const state = useProjectStore.getState();
    expect(state.workspaces.map((w) => w.id)).toEqual(["/b"]);
    expect(state.openTabs).toEqual(["/b/y.ts"]);
    expect(state.activeWorkspaceId).toBe("/b");
  });

  it("should clear the active workspace when none remain", () => {
    useProjectStore.setState({
      workspaces: [seedWorkspace("/only")],
      activeWorkspaceId: "/only",
    });

    useProjectStore.getState().removeWorkspace("/only");

    const state = useProjectStore.getState();
    expect(state.workspaces).toHaveLength(0);
    expect(state.activeWorkspaceId).toBeNull();
  });

  it("should keep the active workspace when removing another", () => {
    useProjectStore.setState({
      workspaces: [seedWorkspace("/a"), seedWorkspace("/b")],
      activeWorkspaceId: "/a",
    });

    useProjectStore.getState().removeWorkspace("/b");
    expect(useProjectStore.getState().activeWorkspaceId).toBe("/a");
  });
});

describe("ProjectStore — misc sync actions", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("setActiveWorkspace should update the active workspace", () => {
    useProjectStore.getState().setActiveWorkspace("/x");
    expect(useProjectStore.getState().activeWorkspaceId).toBe("/x");
  });

  it("setAutoBackup should toggle the flag", () => {
    useProjectStore.getState().setAutoBackup(true);
    expect(useProjectStore.getState().autoBackupEnabled).toBe(true);
    useProjectStore.getState().setAutoBackup(false);
    expect(useProjectStore.getState().autoBackupEnabled).toBe(false);
  });

  it("setActiveTab should activate the owning workspace", () => {
    useProjectStore.setState({
      workspaces: [{ id: "/proj", name: "proj", path: "/proj", files: [], isGitRepo: false, gitBranch: null }],
      activeWorkspaceId: "/proj",
    });
    useProjectStore.getState().setActiveTab("/proj/src/a.ts");
    expect(useProjectStore.getState().activeTab).toBe("/proj/src/a.ts");
    expect(useProjectStore.getState().activeWorkspaceId).toBe("/proj");
  });

  it("deleteFileContent should remove file, dirty flag, tab and tree node", () => {
    useProjectStore.setState({
      workspaces: [{
        id: "/proj",
        name: "proj",
        path: "/proj",
        files: [{ name: "src", path: "/proj/src", type: "directory", children: [{ name: "a.ts", path: "/proj/src/a.ts", type: "file" }] }],
        isGitRepo: false,
        gitBranch: null,
      }],
      activeWorkspaceId: "/proj",
      openTabs: ["/proj/src/a.ts", "/proj/other.ts"],
      activeTab: "/proj/src/a.ts",
      fileContents: { "/proj/src/a.ts": "x" },
      isDirty: { "/proj/src/a.ts": true },
    });

    useProjectStore.getState().deleteFileContent("/proj/src/a.ts");

    const state = useProjectStore.getState();
    expect(state.fileContents["/proj/src/a.ts"]).toBeUndefined();
    expect(state.isDirty["/proj/src/a.ts"]).toBeUndefined();
    expect(state.openTabs).toEqual(["/proj/other.ts"]);
    expect(state.activeTab).toBe("/proj/other.ts");
    expect(state.workspaces[0].files[0].children).toHaveLength(0);
  });

  it("reloadWorkspace should refresh the workspace files", async () => {
    useProjectStore.setState({
      workspaces: [{ id: "/proj", name: "proj", path: "/proj", files: [], isGitRepo: false, gitBranch: null }],
      activeWorkspaceId: "/proj",
    });
    const files = [{ name: "a.ts", path: "/proj/a.ts", type: "file" as const }];
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue(files);

    await useProjectStore.getState().reloadWorkspace("/proj");

    expect(useProjectStore.getState().workspaces[0].files).toEqual(files);
  });

  it("reloadWorkspace should silently ignore folder-not-selected errors", async () => {
    (loadProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("No se seleccionó ninguna carpeta"),
    );
    await expect(useProjectStore.getState().reloadWorkspace("/proj")).resolves.toBeUndefined();
  });

  it("reloadWorkspace should log other errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    (loadProject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    await useProjectStore.getState().reloadWorkspace("/proj");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("saveFile on a virtual workspace should mark clean without FS access", async () => {
    useProjectStore.setState({ activeWorkspaceId: "template://todo" });
    useProjectStore.getState().openTab("template://todo/src/App.tsx");
    useProjectStore.getState().setFileContent("template://todo/src/App.tsx", "app");

    await useProjectStore.getState().saveFile("template://todo/src/App.tsx");

    const state = useProjectStore.getState();
    expect(state.isDirty["template://todo/src/App.tsx"]).toBe(false);
    expect(state.statusMessage).toBe("Guardado");
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it("saveFile should do nothing when the file has no in-memory content", async () => {
    await useProjectStore.getState().saveFile("/proj/never-opened.ts");
    expect(saveFileContent).not.toHaveBeenCalled();
  });
});

describe("ProjectStore — syncProject / restoreProject", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    useProjectStore.setState({
      workspaces: [{
        id: "/proj",
        name: "proj",
        path: "/proj",
        files: [{ name: "a.ts", path: "/proj/a.ts", type: "file" as const }],
        isGitRepo: false,
        gitBranch: null,
      }],
      activeWorkspaceId: "/proj",
    });
  });

  it("should be a no-op without an active workspace", async () => {
    useProjectStore.setState({ activeWorkspaceId: null });
    await useProjectStore.getState().syncProject();
    expect(pushToCloud).not.toHaveBeenCalled();
  });

  it("should push the workspace to the cloud", async () => {
    pushToCloud.mockResolvedValue(undefined);

    await useProjectStore.getState().syncProject();

    const state = useProjectStore.getState();
    expect(pushToCloud).toHaveBeenCalled();
    expect(getFileSystemBackend).toHaveBeenCalled();
    expect(state.isSyncing).toBe(false);
    expect(state.statusMessage).toBe("Nube sincronizada exitosamente");
    expect(state.hasUnsyncedChanges).toBe(false);
    expect(state.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("should record sync errors", async () => {
    pushToCloud.mockRejectedValue(new Error("AWS down"));

    await useProjectStore.getState().syncProject();

    const state = useProjectStore.getState();
    expect(state.isSyncing).toBe(false);
    expect(state.syncError).toBe("AWS down");
    expect(state.statusMessage).toBe("Error al sincronizar: AWS down");
  });

  it("should restore the project from the cloud", async () => {
    pullFromCloud.mockResolvedValue(undefined);
    const files = [{ name: "b.ts", path: "/proj/b.ts", type: "file" as const }];
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue(files);

    await useProjectStore.getState().restoreProject();

    const state = useProjectStore.getState();
    expect(pullFromCloud).toHaveBeenCalled();
    expect(state.statusMessage).toBe("Proyecto restaurado exitosamente");
    expect(state.lastSyncedAt).toBeInstanceOf(Date);
    expect(state.workspaces[0].files).toEqual(files);
  });

  it("should be a no-op restoring without an active workspace", async () => {
    useProjectStore.setState({ activeWorkspaceId: null });
    await useProjectStore.getState().restoreProject();
    expect(pullFromCloud).not.toHaveBeenCalled();
  });

  it("should record restore errors", async () => {
    pullFromCloud.mockRejectedValue(new Error("no backup"));

    await useProjectStore.getState().restoreProject();

    const state = useProjectStore.getState();
    expect(state.syncError).toBe("no backup");
    expect(state.statusMessage).toBe("Error al restaurar: no backup");
  });
});

describe("ProjectStore — diff mode", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    useProjectStore.setState({
      workspaces: [{
        id: "/proj",
        name: "proj",
        path: "/proj",
        files: [],
        isGitRepo: false,
        gitBranch: null,
      }],
      activeWorkspaceId: "/proj",
      fileContents: { "/proj/src/a.ts": "modified" },
    });
  });

  it("openDiffMode should enable diff with snapshot original", async () => {
    (readFileContent as ReturnType<typeof vi.fn>).mockResolvedValue("modified");
    getLastSnapshot.mockReturnValue({ path: "src/a.ts", content: "original" });

    await useProjectStore.getState().openDiffMode("src/a.ts");

    const state = useProjectStore.getState();
    expect(state.diffMode).toBe(true);
    expect(state.diffOriginalContent).toBe("original");
    expect(state.diffModifiedContent).toBe("modified");
  });

  it("openDiffMode should use an empty original for new files", async () => {
    (readFileContent as ReturnType<typeof vi.fn>).mockResolvedValue("fresh");
    getLastSnapshot.mockReturnValue(null);

    await useProjectStore.getState().openDiffMode("src/new.ts");

    expect(useProjectStore.getState().diffOriginalContent).toBe("");
  });

  it("openDiffMode should be a no-op without a workspace", async () => {
    useProjectStore.setState({ activeWorkspaceId: null });
    await useProjectStore.getState().openDiffMode("src/a.ts");
    expect(useProjectStore.getState().diffMode).toBe(false);
  });

  it("closeDiffMode should reset diff state", () => {
    useProjectStore.setState({
      diffMode: true,
      diffOriginalContent: "a",
      diffModifiedContent: "b",
    });
    useProjectStore.getState().closeDiffMode();

    const state = useProjectStore.getState();
    expect(state.diffMode).toBe(false);
    expect(state.diffOriginalContent).toBe("");
    expect(state.diffModifiedContent).toBe("");
  });
});

describe("ProjectStore — scaffoldTemplate", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  const template = {
    id: "todo-app",
    name: "App de Tareas",
    description: "x",
    category: "web" as const,
    icon: "CheckSquare",
    gradient: ["#10b981", "#06b6d4"] as [string, string],
    files: {
      "src/App.tsx": "app code",
      "src/styles.css": "css",
      "README.md": "readme",
    },
  };

  it("should scaffold a virtual workspace with a nested file tree", () => {
    useProjectStore.getState().scaffoldTemplate(template);

    const state = useProjectStore.getState();
    expect(state.activeWorkspaceId).toBe("template://todo-app");
    expect(state.workspaces).toHaveLength(1);
    expect(state.openTabs).toEqual(["template://todo-app/src/App.tsx"]);
    expect(state.activeTab).toBe("template://todo-app/src/App.tsx");
    expect(state.fileContents["template://todo-app/src/App.tsx"]).toBe("app code");

    const rootFiles = state.workspaces[0].files;
    const srcDir = rootFiles.find((n) => n.type === "directory" && n.name === "src");
    expect(srcDir).toBeDefined();
    expect(srcDir!.children).toHaveLength(2);
    const readme = rootFiles.find((n) => n.type === "file" && n.name === "README.md");
    expect(readme).toBeDefined();
  });

  it("should auto-open the first file", () => {
    useProjectStore.getState().scaffoldTemplate(template);
    expect(useProjectStore.getState().openTabs).toHaveLength(1);
  });

  it("should handle templates with only root-level files", () => {
    const flat = { ...template, files: { "index.html": "html" } };
    useProjectStore.getState().scaffoldTemplate(flat);
    const state = useProjectStore.getState();
    expect(state.openTabs).toEqual(["template://todo-app/index.html"]);
    expect(state.workspaces[0].files).toHaveLength(1);
  });
});
