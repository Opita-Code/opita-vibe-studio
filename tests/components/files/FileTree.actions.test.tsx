import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileTree } from "../../../src/components/files/FileTree";
import type { FileNode } from "../../../src/lib/types";

// ── Project store mock ──────────────────────────────────────────
let projectState: Record<string, unknown> = {};

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector(projectState as Record<string, unknown>),
    {
      getState: () => projectState,
      setState: (patch: Record<string, unknown>) => Object.assign(projectState, patch),
    },
  ),
}));

// ── lib/fs mock (dynamic imports) ───────────────────────────────
vi.mock("../../../src/lib/fs", () => ({
  createDir: vi.fn(async () => {}),
  createFileItem: vi.fn(async () => {}),
  renameEntry: vi.fn(async () => {}),
  deleteEntry: vi.fn(async () => {}),
}));

import * as fsModule from "../../../src/lib/fs";

const nodes: FileNode[] = [
  {
    name: "src",
    path: "/test/src",
    type: "directory",
    children: [
      { name: "app.ts", path: "/test/src/app.ts", type: "file", extension: "ts" },
    ],
  },
  { name: "index.html", path: "/test/index.html", type: "file", extension: "html" },
];

beforeEach(() => {
  vi.clearAllMocks();
  projectState = {
    openFile: vi.fn(async () => {}),
    activeTab: null,
    reloadWorkspace: vi.fn(async () => {}),
    workspaces: [{ id: "/test", path: "/test", name: "test", files: [], isGitRepo: false, gitBranch: null }],
    activeWorkspaceId: "/test",
    openTabs: [],
    fileContents: {},
    isDirty: {},
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
    statusMessage: null,
    setState: (patch: Record<string, unknown>) => { Object.assign(projectState, patch); },
  };
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FileTree (actions)", () => {
  it("should open a file when clicking it", () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.click(screen.getByText("src"));
    fireEvent.click(screen.getByText("app.ts"));
    expect(projectState.openFile).toHaveBeenCalledWith("/test/src/app.ts");
  });

  it("should open a directory on click and auto-expand its children", () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.click(screen.getByText("src"));
    expect(screen.getByText("app.ts")).toBeDefined();
    // click again to collapse
    fireEvent.click(screen.getByText("src"));
    expect(screen.queryByText("app.ts")).toBeNull();
  });

  it("should open context menu on right-click with file-only options for files", () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("index.html"));
    expect(screen.getByText("Nuevo archivo")).toBeDefined();
    expect(screen.getByText("Renombrar")).toBeDefined();
    expect(screen.getByText("Eliminar")).toBeDefined();
    // No "Nueva carpeta" for files
    expect(screen.queryByText("Nueva carpeta")).toBeNull();
  });

  it("should open context menu via the dots button", () => {
    render(<FileTree nodes={nodes} />);
    const dots = screen.getAllByLabelText("Opciones");
    fireEvent.click(dots[0]);
    expect(screen.getByText("Renombrar")).toBeDefined();
  });

  it("should close context menu when clicking outside", async () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("index.html"));
    expect(screen.getByText("Eliminar")).toBeDefined();
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Eliminar")).toBeNull();
  });

  it("should create a file via the context menu with Enter submit", async () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("src"));
    fireEvent.click(screen.getByText("Nuevo archivo"));

    const input = screen.getByPlaceholderText("archivo.ext");
    fireEvent.change(input, { target: { value: "nuevo.ts" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(fsModule.createFileItem).toHaveBeenCalledWith("/test/src/nuevo.ts");
      expect(projectState.reloadWorkspace).toHaveBeenCalledWith("/test");
    });
  });

  it("should create a directory via the context menu", async () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("src"));
    fireEvent.click(screen.getByText("Nueva carpeta"));

    const input = screen.getByPlaceholderText("nombre-carpeta");
    fireEvent.change(input, { target: { value: "componentes" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(fsModule.createDir).toHaveBeenCalledWith("/test/src/componentes");
    });
  });

  it("should cancel creation with Escape", () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("src"));
    fireEvent.click(screen.getByText("Nuevo archivo"));
    fireEvent.keyDown(screen.getByPlaceholderText("archivo.ext"), { key: "Escape" });
    expect(screen.queryByPlaceholderText("archivo.ext")).toBeNull();
  });

  it("should cancel creation with empty name on blur", async () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("src"));
    fireEvent.click(screen.getByText("Nuevo archivo"));
    fireEvent.blur(screen.getByPlaceholderText("archivo.ext"));
    await vi.waitFor(() => {
      expect(screen.queryByPlaceholderText("archivo.ext")).toBeNull();
    });
    expect(fsModule.createFileItem).not.toHaveBeenCalled();
  });

  it("should rename a file and update open tabs", async () => {
    projectState = {
      ...projectState,
      openTabs: ["/test/index.html"],
      activeTab: "/test/index.html",
      fileContents: { "/test/index.html": "<h1>hola</h1>" },
      isDirty: { "/test/index.html": false },
    };

    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("index.html"));
    const menu = screen.queryByText("Renombrar");
    console.log("menu?", !!menu);
    fireEvent.click(screen.getByText("Renombrar"));
    console.log("renamingIn?", !!screen.queryByPlaceholderText("archivo.ext"));
    console.log("BODY=", document.body.innerHTML.replace(/s+/g," ").slice(-800));

    const input = screen.getByDisplayValue("index.html");
    fireEvent.change(input, { target: { value: "home.html" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(fsModule.renameEntry).toHaveBeenCalledWith("/test/index.html", "/test/home.html");
      expect(projectState.setActiveTab).toHaveBeenCalledWith("/test/home.html");
    });
    // openTabs/fileContents updated via setState
    expect(projectState.openTabs).toEqual(["/test/home.html"]);
    expect(projectState.fileContents).toEqual({ "/test/home.html": "<h1>hola</h1>" });
  });

  it("should not rename when the name is unchanged", async () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("index.html"));
    fireEvent.click(screen.getByText("Renombrar"));
    fireEvent.keyDown(screen.getByDisplayValue("index.html"), { key: "Enter" });
    await vi.waitFor(() => {
      expect(fsModule.renameEntry).not.toHaveBeenCalled();
    });
  });

  it("should delete a file after confirm", async () => {
    projectState = {
      ...projectState,
      openTabs: ["/test/index.html"],
      closeTab: vi.fn(),
    };
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("index.html"));
    fireEvent.click(screen.getByText("Eliminar"));

    await vi.waitFor(() => {
      expect(fsModule.deleteEntry).toHaveBeenCalledWith("/test/index.html");
    });
    expect(projectState.closeTab).toHaveBeenCalledWith("/test/index.html");
  });

  it("should NOT delete when confirm is cancelled", async () => {
    (window.confirm as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    render(<FileTree nodes={nodes} />);
    fireEvent.contextMenu(screen.getByText("index.html"));
    fireEvent.click(screen.getByText("Eliminar"));
    await vi.waitFor(() => {
      expect(fsModule.deleteEntry).not.toHaveBeenCalled();
    });
  });

  it("should handle the global vibe:create-file event", async () => {
    projectState = { ...projectState, activeWorkspaceId: "/test/src" };
    render(<FileTree nodes={nodes} />);
    window.dispatchEvent(new CustomEvent("vibe:create-file"));
    expect(await screen.findByPlaceholderText("archivo.ext")).toBeDefined();
  });

  it("should auto-expand a directory when creating inside it", async () => {
    projectState = { ...projectState, activeWorkspaceId: "/test/src" };
    render(<FileTree nodes={nodes} />);
    window.dispatchEvent(new CustomEvent("vibe:create-file"));
    // directory "src" auto-expands and shows the inline create input
    expect(await screen.findByPlaceholderText("archivo.ext")).toBeDefined();
  });

  it("should create a file via hover action button on a directory", async () => {
    render(<FileTree nodes={nodes} />);
    fireEvent.click(screen.getByText("src")); // expand
    const newFileBtn = screen.getAllByTitle("Nuevo Archivo");
    fireEvent.click(newFileBtn[0]);

    const input = screen.getByPlaceholderText("archivo.ext");
    fireEvent.change(input, { target: { value: "hover.ts" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(fsModule.createFileItem).toHaveBeenCalledWith("/test/src/hover.ts");
    });
  });
});
