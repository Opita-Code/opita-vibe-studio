import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExplorerDock } from "../../../src/components/layout/ExplorerDock";
import { useUIStore } from "../../../src/stores/ui";

beforeEach(() => {
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
});

describe("ExplorerDock", () => {
  it("should render collapsed by default with folder icon", () => {
    render(<ExplorerDock />);
    // Should have a folder icon button
    const folderButton = screen.getByRole("button", { name: /explorador/i });
    expect(folderButton).toBeDefined();
    // Should not show the expanded file tree header
    expect(screen.queryByText("Explorador")).toBeNull();
  });

  it("should expand when folder icon is clicked", () => {
    render(<ExplorerDock />);
    const toggleBtn = screen.getByRole("button", { name: /explorador/i });
    fireEvent.click(toggleBtn);
    expect(useUIStore.getState().explorerVisible).toBe(true);
  });

  it("should show 'Explorador' header when expanded", () => {
    useUIStore.getState().setExplorerVisible(true);
    render(<ExplorerDock />);
    expect(screen.getByText("Explorador")).toBeDefined();
  });

  it("should collapse when close button is clicked in expanded header", () => {
    useUIStore.getState().setExplorerVisible(true);
    render(<ExplorerDock />);
    const closeBtn = screen.getByRole("button", { name: /colapsar/i });
    fireEvent.click(closeBtn);
    expect(useUIStore.getState().explorerVisible).toBe(false);
  });

  it("should apply transition class for smooth animation", () => {
    render(<ExplorerDock />);
    const dock = screen.getByTestId("explorer-dock");
    expect(dock.className).toContain("transition-all");
  });
});
