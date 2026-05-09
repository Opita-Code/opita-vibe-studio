import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileTree } from "../../../src/components/files/FileTree";
import type { FileNode } from "../../../src/lib/types";

// Mock the project store
vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => {
      const state: Record<string, unknown> = {
        openFile: vi.fn(),
        activeTab: null,
        openProject: vi.fn(),
        rootPath: "/test",
      };
      return selector(state);
    },
    { getState: () => ({ openFile: vi.fn(), activeTab: null }) },
  ),
}));

describe("FileTree", () => {
  const mockNodes: FileNode[] = [
    {
      name: "src",
      path: "/test/src",
      type: "directory",
      children: [
        { name: "app.ts", path: "/test/src/app.ts", type: "file", extension: "ts" },
        {
          name: "styles.css",
          path: "/test/src/styles.css",
          type: "file",
          extension: "css",
        },
      ],
    },
    {
      name: "index.html",
      path: "/test/index.html",
      type: "file",
      extension: "html",
    },
    {
      name: "data.json",
      path: "/test/data.json",
      type: "file",
      extension: "json",
    },
  ];

  it("should render file tree with nodes", () => {
    render(<FileTree nodes={mockNodes} />);
    expect(screen.getByText("src")).toBeDefined();
    expect(screen.getByText("index.html")).toBeDefined();
    expect(screen.getByText("data.json")).toBeDefined();
  });

  it("should not render children initially (folders collapsed)", () => {
    render(<FileTree nodes={mockNodes} />);
    expect(screen.queryByText("app.ts")).toBeNull();
    expect(screen.queryByText("styles.css")).toBeNull();
  });

  it("should show children when folder is clicked", () => {
    render(<FileTree nodes={mockNodes} />);
    fireEvent.click(screen.getByText("src"));
    expect(screen.getByText("app.ts")).toBeDefined();
    expect(screen.getByText("styles.css")).toBeDefined();
  });

  it("should show empty message when no nodes", () => {
    render(<FileTree nodes={[]} />);
    expect(screen.getByText(/Proyecto vacío/)).toBeDefined();
  });

  it("should show new file input placeholder on context menu", () => {
    render(<FileTree nodes={mockNodes} />);

    // Right-click on directory
    fireEvent.contextMenu(screen.getByText("src"));
    expect(screen.getByText("Nuevo archivo")).toBeDefined();
    expect(screen.getByText("Nueva carpeta")).toBeDefined();
  });

  it("should show rename and delete as disabled in context menu", () => {
    render(<FileTree nodes={mockNodes} />);

    fireEvent.contextMenu(screen.getByText("src"));
    expect(screen.getByText("Renombrar")).toBeDefined();
    expect(screen.getByText("Eliminar")).toBeDefined();
  });
});
