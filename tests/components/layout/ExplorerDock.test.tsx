import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExplorerDock } from "../../../src/components/layout/ExplorerDock";
import { useUIStore } from "../../../src/stores/ui";
import { useProjectStore } from "../../../src/stores/project";

// Mock FileTree to avoid deep component rendering
vi.mock("../../../src/components/files/FileTree", () => ({
  FileTree: ({ nodes }: { nodes: unknown[] }) => (
    <div data-testid="file-tree">{nodes.length} files</div>
  ),
}));

// Mock fs-backend
vi.mock("../../../src/lib/fs-backend", () => ({
  getFileSystemBackend: () => ({
    isAvailable: () => false,
    selectDirectory: vi.fn(),
  }),
}));

beforeEach(() => {
  useUIStore.setState({
    activeSidebar: null,
    setActiveSidebar: (val: string | null) => useUIStore.setState({ activeSidebar: val }),
  });
  useProjectStore.setState({
    workspaces: [],
    activeWorkspaceId: null,
    isLoading: false,
    openTabs: [],
    activeTab: null,
  });
});

describe("ExplorerDock", () => {
  it("should render nothing when activeSidebar is not 'explorer'", () => {
    const { container } = render(<ExplorerDock />);
    expect(container.querySelector('[data-testid="explorer-dock"]')).toBeNull();
  });

  it("should render dock when activeSidebar is 'explorer'", () => {
    useUIStore.setState({ activeSidebar: "explorer" });
    render(<ExplorerDock />);
    expect(screen.getByTestId("explorer-dock")).toBeDefined();
    expect(screen.getByText("Explorador")).toBeDefined();
  });

  it("should show empty state with 'Añadir Proyecto' when no workspaces", () => {
    useUIStore.setState({ activeSidebar: "explorer" });
    render(<ExplorerDock />);
    expect(screen.getByText("Explorador de Archivos")).toBeDefined();
    expect(screen.getByText("Añadir Proyecto")).toBeDefined();
  });

  it("should close when collapse button is clicked", () => {
    useUIStore.setState({ activeSidebar: "explorer" });
    render(<ExplorerDock />);
    const closeBtn = screen.getByRole("button", { name: /colapsar/i });
    fireEvent.click(closeBtn);
    expect(useUIStore.getState().activeSidebar).toBeNull();
  });

  it("should apply transition class for smooth animation", () => {
    useUIStore.setState({ activeSidebar: "explorer" });
    render(<ExplorerDock />);
    const dock = screen.getByTestId("explorer-dock");
    expect(dock.className).toContain("transition-all");
  });
});
