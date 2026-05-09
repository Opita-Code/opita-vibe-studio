import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TerminalPanel } from "../../src/components/terminal/TerminalPanel";
import { useProjectStore } from "../../src/stores/project";

beforeEach(() => {
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
    statusMessage: "Listo",
  });
});

describe("TerminalPanel", () => {
  it("should render the terminal header", () => {
    render(<TerminalPanel />);
    expect(screen.getByText("Terminal")).toBeDefined();
  });

  it("should render the command input placeholder", () => {
    render(<TerminalPanel />);
    expect(screen.getByPlaceholderText("Escribe un comando...")).toBeDefined();
  });

  it("should show initial empty state message", () => {
    render(<TerminalPanel />);
    expect(screen.getByText(/Escribe un comando o selecciona un preset/)).toBeDefined();
  });

  it("should render preset commands button", () => {
    render(<TerminalPanel />);
    expect(screen.getByText(/Presets/)).toBeDefined();
  });

  it("should show preset dropdown when clicking Presets", () => {
    render(<TerminalPanel />);

    const presetsBtn = screen.getByText(/Presets/);
    fireEvent.click(presetsBtn);

    // Should show preset commands
    expect(screen.getByText(/Git: estado/)).toBeDefined();
    expect(screen.getByText(/npm: instalar dependencias/)).toBeDefined();
  });

  it("should fill input when selecting a preset", () => {
    render(<TerminalPanel />);

    // Open preset dropdown
    fireEvent.click(screen.getByText(/Presets/));

    // Select "Git: estado"
    fireEvent.click(screen.getByText(/Git: estado/));

    const input = screen.getByPlaceholderText(
      "Escribe un comando...",
    ) as HTMLTextAreaElement;
    expect(input.value).toBe("git status");
  });

  it("should show clear button", () => {
    render(<TerminalPanel />);
    expect(screen.getByTitle("Limpiar terminal")).toBeDefined();
  });

  it("should show dangerous command warning when selecting dangerous preset", () => {
    render(<TerminalPanel />);

    // Open preset dropdown
    fireEvent.click(screen.getByText(/Presets/));

    // Click dangerous preset
    fireEvent.click(screen.getByText(/push forzado/));

    // Should show confirmation dialog
    expect(screen.getByText(/Comando peligroso/)).toBeDefined();
    expect(screen.getByText("git push --force")).toBeDefined();
  });

  it("should have cancel button on dangerous command dialog", () => {
    render(<TerminalPanel />);

    // Open preset dropdown and select dangerous
    fireEvent.click(screen.getByText(/Presets/));
    fireEvent.click(screen.getByText(/push forzado/));

    // Cancel
    fireEvent.click(screen.getByText("Cancelar"));

    // Dialog should close
    expect(screen.queryByText(/Comando peligroso/)).toBeNull();
  });
});
