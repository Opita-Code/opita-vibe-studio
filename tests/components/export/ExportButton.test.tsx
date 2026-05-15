import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useProjectStore } from "../../../src/stores/project";
import { useUIStore } from "../../../src/stores/ui";

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

// ─── Setup stores defaults ───────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();

  useUIStore.setState({
    activeView: "preview",
    chatWidth: 320,
  });

  // Reset project store — no workspaces open
  useProjectStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    openTabs: [],
    activeTab: null,
    isDirty: {},
    fileContents: {},
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

function openProject() {
  useProjectStore.setState({
    workspaces: [{ id: "/home/user/my-project", path: "/home/user/my-project", name: "my-project", files: [], isGitRepo: false, gitBranch: null }],
    activeWorkspaceId: "/home/user/my-project",
    openTabs: [],
    activeTab: null,
    isDirty: {},
    fileContents: {},
    isLoading: false,
    statusMessage: null,
  });
}

describe("ExportButton", () => {
  it("should render a button with export icon when project is open", async () => {
    openProject();

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    expect(button).toBeDefined();
    expect(button).not.toBeDisabled();
  });

  it("should be disabled when no project is open", async () => {
    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    expect(button).toBeDisabled();
  });

  it("should call exportProjectAsZip when clicked", async () => {
    openProject();

    const { MockFileSystemBackend } = await import("../../../tests/lib/fs-backend/MockFileSystemBackend");
    const { setFileSystemBackend } = await import("../../../src/lib/fs-backend/factory");
    setFileSystemBackend(new MockFileSystemBackend());

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    await fireEvent.click(button);

    expect(mockExportZip).toHaveBeenCalledOnce();
  });

  it("should complete export without throwing when project is open", async () => {
    openProject();

    const { MockFileSystemBackend } = await import("../../../tests/lib/fs-backend/MockFileSystemBackend");
    const { setFileSystemBackend } = await import("../../../src/lib/fs-backend/factory");
    setFileSystemBackend(new MockFileSystemBackend());

    const { ExportButton } = await import("../../../src/components/export/ExportButton");
    render(<ExportButton />);

    const button = screen.getByRole("button", { name: /exportar/i });
    await fireEvent.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
