import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../../src/stores/project";

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
