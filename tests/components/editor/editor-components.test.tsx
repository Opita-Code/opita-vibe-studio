import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileTabs } from "../../../src/components/editor/FileTabs";
import { FileWatcher } from "../../../src/components/editor/FileWatcher";
import { useProjectStore } from "../../../src/stores/project";
import { useUIStore } from "../../../src/stores/ui";
import { useChatStore } from "../../../src/stores/chat";

vi.mock("../../../src/components/editor/EditorToolbar", () => ({
  EditorToolbar: () => <div data-testid="editor-toolbar" />,
}));

vi.mock("../../../src/agent/useAgentHandler", () => ({
  useAgentHandler: () => ({ send: sendMock }),
}));
const sendMock = vi.fn();

vi.mock("../../../src/lib/file-watcher", () => ({
  startProjectWatcher: vi.fn(),
  stopProjectWatcher: vi.fn(),
}));

import * as fileWatcher from "../../../src/lib/file-watcher";

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ activeView: "editor", activeSidebar: "chat" } as never);
  useChatStore.setState({ setShareActiveFileContext: vi.fn() } as never);
  useProjectStore.setState({
    openTabs: [],
    activeTab: null,
    isDirty: {},
    setActiveTab: vi.fn(),
    closeTab: vi.fn(),
    workspaces: [],
  } as never);
});

describe("FileTabs", () => {
  it("should render nothing when there are no open tabs", () => {
    const { container } = render(<FileTabs />);
    expect(container.firstChild).toBeNull();
  });

  it("should render open tabs with names and dirty indicator", () => {
    useProjectStore.setState({
      openTabs: ["/test/src/app.ts", "/test/index.html"],
      activeTab: "/test/src/app.ts",
      isDirty: { "/test/src/app.ts": true },
    } as never);
    render(<FileTabs />);
    expect(screen.getByText("app.ts")).toBeDefined();
    expect(screen.getByText("index.html")).toBeDefined();
    expect(screen.getByRole("tab", { selected: true })).toBeDefined();
  });

  it("should activate a tab on click", () => {
    const setActiveTab = vi.fn();
    useProjectStore.setState({
      openTabs: ["/test/index.html"],
      setActiveTab,
    } as never);
    render(<FileTabs />);
    fireEvent.click(screen.getByText("index.html"));
    expect(setActiveTab).toHaveBeenCalledWith("/test/index.html");
  });

  it("should close a tab via its close button", () => {
    const closeTab = vi.fn();
    useProjectStore.setState({
      openTabs: ["/test/index.html"],
      closeTab,
    } as never);
    render(<FileTabs />);
    fireEvent.click(screen.getByLabelText("Cerrar index.html"));
    expect(closeTab).toHaveBeenCalledWith("/test/index.html");
  });

  it("should activate the VibeLens isolation for an active .tsx tab", async () => {
    useUIStore.setState({ setPreviewTarget: vi.fn(), setActiveView: vi.fn() } as never);
    useProjectStore.setState({
      openTabs: ["/test/App.tsx"],
      activeTab: "/test/App.tsx",
    } as never);
    render(<FileTabs />);
    const lensBtn = screen.getByTitle("Aislar Componente (VibeLens)");
    fireEvent.click(lensBtn);
    await vi.waitFor(() => {
      expect(useUIStore.getState().setPreviewTarget).toHaveBeenCalledWith("/test/App.tsx");
      expect(useUIStore.getState().setActiveView).toHaveBeenCalledWith("split");
    });
  });

  it("should NOT show the VibeLens button for non-component files", () => {
    useProjectStore.setState({
      openTabs: ["/test/index.html"],
      activeTab: "/test/index.html",
    } as never);
    render(<FileTabs />);
    expect(screen.queryByTitle("Aislar Componente (VibeLens)")).toBeNull();
  });
});

describe("FileWatcher", () => {
  it("should start the watcher when a workspace exists", () => {
    useProjectStore.setState({
      workspaces: [{ id: "ws", name: "x", path: "/p", files: [], isGitRepo: false, gitBranch: null }],
    } as never);
    render(<FileWatcher />);
    expect(fileWatcher.startProjectWatcher).toHaveBeenCalled();
  });

  it("should stop the watcher without workspaces", () => {
    useProjectStore.setState({ workspaces: [] } as never);
    render(<FileWatcher />);
    expect(fileWatcher.stopProjectWatcher).toHaveBeenCalled();
  });

  it("should stop the watcher on unmount", () => {
    useProjectStore.setState({
      workspaces: [{ id: "ws", name: "x", path: "/p", files: [], isGitRepo: false, gitBranch: null }],
    } as never);
    const { unmount } = render(<FileWatcher />);
    unmount();
    expect(fileWatcher.stopProjectWatcher).toHaveBeenCalled();
  });
});
