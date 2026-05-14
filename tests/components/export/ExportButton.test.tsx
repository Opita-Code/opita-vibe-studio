import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useProjectStore } from "../../../src/stores/project";
import { useUIStore } from "../../../src/stores/ui";
import { MockFileSystemBackend } from "../../../tests/lib/fs-backend/MockFileSystemBackend";

// ─── Mock export module ───────────────────────────────────────────
const mockExportZip = vi.fn();

vi.mock("../../../src/lib/export", () => ({
  exportProjectAsZip: mockExportZip,
}));

// ─── Prevent Tauri import errors in jsdom ────────────────────────
vi.mock("../../../src/lib/ipc", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  listDir: vi.fn(),
  createDir: vi.fn(),
  deleteEntry: vi.fn(),
  openFolderDialog: vi.fn(),
  execShell: vi.fn(),
}));

// ─── Setup UI store defaults ─────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  useUIStore.setState({
    sidebarWidth: 240,
    statusMessage: "Listo",
    activeModel: "deepseek-chat",
    connectedProvider: "DeepSeek",
    tokensRemaining: 0,
    terminalVisible: false,
    terminalHeight: 200,
    settingsVisible: false,
    activeView: "preview",
    explorerVisible: false,
    chatWidth: 320,
    splitRatio: 0.5,
  });

  // Reset project store to default (no project open)
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

  mockExportZip.mockReset();
  mockExportZip.mockResolvedValue(new Blob(["fake-zip"], { type: "application/zip" }));
});

afterEach(async () => {
  const { setFileSystemBackend } = await import("../../../src/lib/fs-backend/factory");
  setFileSystemBackend(null);
});

describe("ExportButton", () => {
  it("should render a button with export icon when project is open", async () => {
    useProjectStore.setState({
      rootPath: "/home/user/my-project",
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

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    expect(button).toBeDefined();
    expect(button).not.toBeDisabled();
  });

  it("should be disabled when no project is open", async () => {
    // rootPath is null (default from beforeEach)
    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    expect(button).toBeDisabled();
  });

  it("should call exportProjectAsZip when clicked", async () => {
    useProjectStore.setState({
      rootPath: "/home/user/my-project",
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

    const { setFileSystemBackend } = await import("../../../src/lib/fs-backend/factory");
    setFileSystemBackend(new MockFileSystemBackend());

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    await fireEvent.click(button);

    expect(mockExportZip).toHaveBeenCalledOnce();
  });

  it("should show loading state during export", async () => {
    useProjectStore.setState({
      rootPath: "/home/user/my-project",
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

    const { setFileSystemBackend } = await import("../../../src/lib/fs-backend/factory");
    setFileSystemBackend(new MockFileSystemBackend());

    // Make export take a moment so we can see loading state
    let resolveExport: (blob: Blob) => void = () => {};
    mockExportZip.mockImplementation(() => new Promise((resolve) => {
      resolveExport = resolve;
    }));

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    fireEvent.click(button);

    // Button should be disabled while exporting
    expect(button).toBeDisabled();

    // Complete the export
    resolveExport(new Blob(["zip"], { type: "application/zip" }));
  });

  it("should complete export without throwing when project is open", async () => {
    useProjectStore.setState({
      rootPath: "/home/user/my-project",
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

    const { setFileSystemBackend } = await import("../../../src/lib/fs-backend/factory");
    setFileSystemBackend(new MockFileSystemBackend());

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    await fireEvent.click(button);

    // After click, exportProjectAsZip was called (verified in previous test).
    // The component handles the blob URL + download internally.
    // Verify button is no longer disabled after export completes
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
