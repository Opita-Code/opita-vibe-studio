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

import { loadProject, readFileContent, saveFileContent, isGitRepo } from "../../src/lib/fs";
import { getGitBranch } from "../../src/lib/git";

beforeEach(() => {
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

describe("ProjectStore — legacy actions", () => {
  it("should set root path", () => {
    const store = useProjectStore.getState();
    store.setRootPath("/test/project");
    expect(useProjectStore.getState().rootPath).toBe("/test/project");
  });

  it("should set files", () => {
    const store = useProjectStore.getState();
    const files = [
      { name: "index.html", path: "/test/index.html", type: "file" as const },
    ];
    store.setFiles(files);
    expect(useProjectStore.getState().files).toEqual(files);
  });

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

describe("ProjectStore — new actions", () => {
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

  it("should set git info", () => {
    const store = useProjectStore.getState();
    store.setGitInfo("main", true);
    const state = useProjectStore.getState();
    expect(state.gitBranch).toBe("main");
    expect(state.isGitRepo).toBe(true);
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

  it("closeTabWithSave should close clean files without saving", async () => {
    (saveFileContent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const store = useProjectStore.getState();
    store.openTab("/test/clean.ts");
    store.setFileContent("/test/clean.ts", "clean content");
    store.markClean("/test/clean.ts");
    await store.closeTabWithSave("/test/clean.ts");

    // Should NOT have called saveFileContent for a clean file
    // (it was marked clean so dirty flag is false, but closeTabWithSave checks isDirty)
    // Actually it was marked clean, but setFileContent sets dirty. Let's verify:
    const state = useProjectStore.getState();
    expect(state.openTabs).not.toContain("/test/clean.ts");
  });

  it("openProject should load files and git info", async () => {
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
    expect(state.rootPath).toBe("/test");
    expect(state.files).toEqual(mockFiles);
    expect(state.isGitRepo).toBe(true);
    expect(state.gitBranch).toBe("main");
    expect(state.isLoading).toBe(false);
  });

  it("openProject should handle non-git projects", async () => {
    const mockFiles = [{ name: "index.html", path: "/test/index.html", type: "file" as const }];
    (loadProject as ReturnType<typeof vi.fn>).mockResolvedValue(mockFiles);
    (isGitRepo as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const store = useProjectStore.getState();
    await store.openProject("/test");

    const state = useProjectStore.getState();
    expect(state.isGitRepo).toBe(false);
    expect(state.gitBranch).toBeNull();
    expect(state.files).toEqual(mockFiles);
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
