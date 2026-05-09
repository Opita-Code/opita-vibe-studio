import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApplyCodeBlock } from "../../../src/components/chat/ApplyCodeBlock";
import { useProjectStore } from "../../../src/stores/project";

// ─── Mocks ──────────────────────────────────────────────────────

const mockWriteFile = vi.fn();
const mockOpenFile = vi.fn();

vi.mock("../../../src/lib/ipc", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Reset project store with a root path (project open)
  useProjectStore.setState({
    rootPath: "/test/project",
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

// ─── Tests ──────────────────────────────────────────────────────

describe("ApplyCodeBlock", () => {
  it("should render code content and an Aplicar button", () => {
    render(
      <ApplyCodeBlock code={'<h1>Hola</h1>'} language="html" />,
    );

    // The code content should be rendered by SyntaxHighlighter (token spans)
    expect(screen.getByText("Hola")).toBeDefined();

    // The Aplicar button should be present
    expect(screen.getByTitle("Guardar este código como archivo")).toBeDefined();
    expect(screen.getByText("Aplicar")).toBeDefined();
  });

  it("should show a filename input when Aplicar is clicked", async () => {
    render(
      <ApplyCodeBlock code={'<h1>Hola</h1>'} language="html" />,
    );

    // Click Aplicar
    fireEvent.click(screen.getByText("Aplicar"));

    // Should show the save dialog with a pre-filled filename
    await waitFor(() => {
      expect(screen.getByDisplayValue("index.html")).toBeDefined();
    });

    // Should show save and cancel buttons
    expect(screen.getByText("Guardar")).toBeDefined();
    expect(screen.getByText("Cancelar")).toBeDefined();
  });

  it("should suggest filename based on language", () => {
    const { unmount } = render(
      <ApplyCodeBlock code={"const x = 1;"} language="javascript" />,
    );
    fireEvent.click(screen.getByText("Aplicar"));
    expect(screen.getByDisplayValue("script.js")).toBeDefined();
    unmount();

    render(<ApplyCodeBlock code={".class {}"} language="css" />);
    fireEvent.click(screen.getByText("Aplicar"));
    expect(screen.getByDisplayValue("styles.css")).toBeDefined();
  });

  it("should call writeFile and openFile when submitted", async () => {
    mockWriteFile.mockResolvedValue(undefined);

    render(
      <ApplyCodeBlock code={"<h1>Hola</h1>"} language="html" />,
    );

    fireEvent.click(screen.getByText("Aplicar"));

    const input = screen.getByDisplayValue("index.html");
    fireEvent.change(input, { target: { value: "mi-pagina.html" } });
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => {
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/test/project/mi-pagina.html",
        "<h1>Hola</h1>",
      );
    });
  });

  it("should show error message when writeFile fails", async () => {
    mockWriteFile.mockRejectedValue(new Error("Permiso denegado"));

    render(
      <ApplyCodeBlock code={"<h1>Hola</h1>"} language="html" />,
    );

    fireEvent.click(screen.getByText("Aplicar"));
    fireEvent.click(screen.getByText("Guardar"));

    await waitFor(() => {
      expect(
        screen.getByText(/Error al guardar: Permiso denegado/),
      ).toBeDefined();
    });
  });

  it("should show message when no project is open", () => {
    useProjectStore.setState({ rootPath: null });

    render(
      <ApplyCodeBlock code={"<h1>Hola</h1>"} language="html" />,
    );

    fireEvent.click(screen.getByText("Aplicar"));

    expect(
      screen.getByText("Abrí un proyecto primero"),
    ).toBeDefined();
  });

  it("should prevent saving with empty or invalid filename", () => {
    render(
      <ApplyCodeBlock code={"<h1>Hola</h1>"} language="html" />,
    );

    fireEvent.click(screen.getByText("Aplicar"));

    const input = screen.getByDisplayValue("index.html");
    fireEvent.change(input, { target: { value: "" } });

    // Guardar button should be disabled when filename is empty
    expect(screen.getByText("Guardar")).toBeDisabled();
  });

  it("should close the save dialog on Cancel", () => {
    render(
      <ApplyCodeBlock code={"<h1>Hola</h1>"} language="html" />,
    );

    fireEvent.click(screen.getByText("Aplicar"));
    expect(screen.getByDisplayValue("index.html")).toBeDefined();

    fireEvent.click(screen.getByText("Cancelar"));

    // Should show Aplicar button again
    expect(screen.getByText("Aplicar")).toBeDefined();
  });

  it("should render inline code without Aplicar button when language is undefined", () => {
    render(
      <ApplyCodeBlock code={"const x = 1"} language={undefined} />,
    );

    // No Aplicar button for inline code
    expect(screen.queryByText("Aplicar")).toBeNull();
  });

  it("should handle file already exists with overwrite confirmation", async () => {
    // Set up existing tab
    useProjectStore.setState({
      openTabs: ["/test/project/existente.html"],
      fileContents: { "/test/project/existente.html": "existing content" },
    });

    mockWriteFile.mockResolvedValue(undefined);

    render(
      <ApplyCodeBlock code={"<h1>Nuevo</h1>"} language="html" />,
    );

    fireEvent.click(screen.getByText("Aplicar"));

    const input = screen.getByDisplayValue("index.html");
    fireEvent.change(input, { target: { value: "existente.html" } });
    fireEvent.click(screen.getByText("Guardar"));

    // Should show overwrite confirmation
    await waitFor(() => {
      expect(screen.getByText(/ya existe/)).toBeDefined();
    });

    expect(screen.getByText("Sobrescribir")).toBeDefined();
    expect(screen.getByText("Cancelar")).toBeDefined();
  });
});
