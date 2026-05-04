import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../../src/stores/project";

beforeEach(() => {
  useProjectStore.setState({
    rootPath: null,
    files: [],
    openTabs: [],
    activeTab: null,
    isDirty: {},
  });
});

describe("ProjectStore", () => {
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
