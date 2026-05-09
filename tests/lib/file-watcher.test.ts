import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useProjectStore } from "../../src/stores/project";

// ─── Mock @tauri-apps/plugin-fs ────────────────────────────────

const mockStopWatcher = vi.fn().mockName("stopWatcher");
const mockWatch = vi.fn().mockResolvedValue(mockStopWatcher);

vi.mock("@tauri-apps/plugin-fs", () => ({
  watch: (...args: unknown[]) => mockWatch(...args),
}));

// ─── Mock fs.ts ────────────────────────────────────────────────

const mockLoadProject = vi.fn();
vi.mock("../../src/lib/fs", () => ({
  loadProject: (...args: unknown[]) => mockLoadProject(...args),
}));

// ─── Helpers ───────────────────────────────────────────────────

function resetStore() {
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
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

afterEach(async () => {
  // Clean up any running watcher between tests
  const mod = await import("../../src/lib/file-watcher");
  mod.stopProjectWatcher();
});

// ─── Tests ─────────────────────────────────────────────────────

describe("startProjectWatcher", () => {
  it("should start watching when project is open", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();

    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockWatch).toHaveBeenCalledWith(
      ["/test/project"],
      expect.any(Function),
      { recursive: true },
    );
  });

  it("should not start watching when rootPath is null", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");

    await startProjectWatcher();

    expect(mockWatch).not.toHaveBeenCalled();
  });

  it("should stop previous watcher before starting a new one", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");

    useProjectStore.setState({ rootPath: "/test/project-1" });
    await startProjectWatcher();
    expect(mockWatch).toHaveBeenCalledTimes(1);

    useProjectStore.setState({ rootPath: "/test/project-2" });
    await startProjectWatcher();
    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockStopWatcher).toHaveBeenCalledTimes(1);
  });

  it("should stop watching when stopProjectWatcher is called", async () => {
    const { startProjectWatcher, stopProjectWatcher } = await import(
      "../../src/lib/file-watcher"
    );

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();
    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockStopWatcher).not.toHaveBeenCalled();

    stopProjectWatcher();
    expect(mockStopWatcher).toHaveBeenCalledTimes(1);
  });

  it("should reload file tree on external change", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");

    // Override mock to capture the watch callback
    let watchCallback: (() => void) | null = null;
    mockWatch.mockImplementation(
      (_paths: string[], callback: () => void) => {
        watchCallback = callback;
        return Promise.resolve(mockStopWatcher);
      },
    );

    mockLoadProject.mockResolvedValue([
      { name: "index.html", path: "/test/project/index.html", type: "file" },
    ]);

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();

    // Simulate an external file change
    expect(watchCallback).not.toBeNull();
    if (watchCallback) watchCallback();

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 400));

    expect(mockLoadProject).toHaveBeenCalledWith("/test/project");
    expect(useProjectStore.getState().files).toHaveLength(1);
  });

  it("should debounce rapid file changes", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");

    let watchCallback: (() => void) | null = null;
    mockWatch.mockImplementation(
      (_paths: string[], callback: () => void) => {
        watchCallback = callback;
        return Promise.resolve(mockStopWatcher);
      },
    );

    mockLoadProject.mockResolvedValue([]);

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();

    // Fire multiple rapid events
    if (watchCallback) {
      watchCallback();
      watchCallback();
      watchCallback();
    }

    // Should NOT have been called yet (debounce)
    expect(mockLoadProject).not.toHaveBeenCalled();

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 400));

    // Should have been called exactly once
    expect(mockLoadProject).toHaveBeenCalledTimes(1);
  });

  it("should suppress self-triggered watch events", async () => {
    const { startProjectWatcher, markWriting } = await import(
      "../../src/lib/file-watcher"
    );

    let watchCallback: (() => void) | null = null;
    mockWatch.mockImplementation(
      (_paths: string[], callback: () => void) => {
        watchCallback = callback;
        return Promise.resolve(mockStopWatcher);
      },
    );

    mockLoadProject.mockResolvedValue([]);

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();

    // Simulate: app writes a file — mark as writing
    markWriting();
    if (watchCallback) watchCallback(); // This event is from our own write

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 400));

    // loadProject should NOT have been called (suppressed)
    expect(mockLoadProject).not.toHaveBeenCalled();
  });

  it("should handle watcher failure gracefully", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Make watch() throw
    mockWatch.mockRejectedValue(new Error("Permission denied"));

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Watcher] Error al iniciar watcher:",
      expect.any(Error),
    );
  });

  it("should handle new files created externally", async () => {
    const { startProjectWatcher } = await import("../../src/lib/file-watcher");

    let watchCallback: (() => void) | null = null;
    mockWatch.mockImplementation(
      (_paths: string[], callback: () => void) => {
        watchCallback = callback;
        return Promise.resolve(mockStopWatcher);
      },
    );

    mockLoadProject.mockResolvedValue([
      { name: "nuevo.html", path: "/test/project/nuevo.html", type: "file" },
    ]);

    useProjectStore.setState({ rootPath: "/test/project" });
    await startProjectWatcher();

    // Simulate external file creation
    if (watchCallback) watchCallback();

    await new Promise((r) => setTimeout(r, 400));

    expect(mockLoadProject).toHaveBeenCalledWith("/test/project");
    const files = useProjectStore.getState().files;
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("nuevo.html");
  });
});
