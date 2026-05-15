import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViewTabs } from "../../../src/components/layout/ViewTabs";
import { useUIStore } from "../../../src/stores/ui";

beforeEach(() => {
  useUIStore.setState({
    activeView: "preview",
  });
});

describe("ViewTabs", () => {
  it("should render tab buttons: Vista Previa, Editor", () => {
    render(<ViewTabs />);
    expect(screen.getByText("Vista Previa")).toBeDefined();
    expect(screen.getByText("Editor")).toBeDefined();
  });

  it("should highlight the active tab with aria-selected", () => {
    render(<ViewTabs />);
    const previewTab = screen.getByRole("tab", { name: /vista previa/i });
    expect(previewTab.getAttribute("aria-selected")).toBe("true");
  });

  it("should switch to editor view when Editor tab is clicked", () => {
    render(<ViewTabs />);
    fireEvent.click(screen.getByText("Editor"));
    expect(useUIStore.getState().activeView).toBe("editor");
  });

  it("should show keyboard shortcut hints", () => {
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
    const editorTab = screen.getByRole("tab", { name: /editor/i });
    expect(editorTab.getAttribute("title")).toBe("Ctrl+2");
  });
});
