import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewTabs } from "../../../src/components/layout/ViewTabs";
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

describe("ViewTabs", () => {
  it("should render tab buttons: Vista Previa, Editor", () => {
    render(<ViewTabs />);
    expect(screen.getByText("Vista Previa")).toBeDefined();
    expect(screen.getByText("Editor + Archivos")).toBeDefined();
  });

  it("should highlight the active tab with vibe-cyan styling", () => {
    render(<ViewTabs />);
    const previewTab = screen.getByRole("tab", { name: /vista previa/i });
    // Default active is "preview" → "Vista Previa" tab should have cyan styling
    expect(previewTab.className).toContain("vibe-cyan");
    // Active tab should have aria-selected=true
    expect(previewTab.getAttribute("aria-selected")).toBe("true");
  });

  it("should switch to editor view when Editor tab is clicked", () => {
    render(<ViewTabs />);
    fireEvent.click(screen.getByText("Editor + Archivos"));
    expect(useUIStore.getState().activeView).toBe("editor");
  });



  it("should show keyboard shortcut hints for Preview and Editor tabs", () => {
    render(<ViewTabs />);
    expect(screen.getByText("Ctrl+1")).toBeDefined();
    expect(screen.getByText("Ctrl+2")).toBeDefined();
  });

  it("should set title attribute on Preview tab with shortcut", () => {
    render(<ViewTabs />);
    const previewTab = screen.getByRole("tab", { name: /vista previa/i });
    expect(previewTab.getAttribute("title")).toBe("Ctrl+1");
  });

  it("should set title attribute on Editor tab with shortcut", () => {
    render(<ViewTabs />);
    const editorTab = screen.getByRole("tab", { name: /editor \+ archivos/i });
    expect(editorTab.getAttribute("title")).toBe("Ctrl+2");
  });
});
