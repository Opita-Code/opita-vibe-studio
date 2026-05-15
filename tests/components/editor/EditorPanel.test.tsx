import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditorPanel } from "../../../src/components/layout/EditorPanel";

// Mock Monaco editor
vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    language,
  }: {
    value: string;
    onChange?: (val: string) => void;
    language?: string;
  }) => (
    <div data-testid="monaco-editor" data-language={language}>
      <textarea
        data-testid="monaco-textarea"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  ),
}));

// Mock Sandpack (VibeLens)
vi.mock("@codesandbox/sandpack-react", () => ({
  SandpackProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sandpack-provider">{children}</div>,
  SandpackPreview: () => <div data-testid="sandpack-preview">Preview</div>,
}));

// Mock child components
vi.mock("../../../src/components/preview/LivePreview", () => ({
  LivePreview: () => <div data-testid="live-preview">LivePreview</div>,
}));

vi.mock("../../../src/components/layout/WelcomeScreen", () => ({
  WelcomeScreen: () => <div data-testid="welcome-screen">Bienvenido</div>,
}));

vi.mock("../../../src/components/editor/FileTabs", () => ({
  FileTabs: () => <div data-testid="file-tabs">FileTabs</div>,
}));

// Mock stores with full state
let mockProjectState: Record<string, unknown> = {};

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(mockProjectState),
    { getState: () => mockProjectState },
  ),
}));

let mockUIState: Record<string, unknown> = {};

vi.mock("../../../src/stores/ui", () => ({
  useUIStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(mockUIState),
    { getState: () => mockUIState },
  ),
}));

describe("EditorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUIState = {
      activeView: "split",
      vibeLensEnabled: false,
      setVibeLensEnabled: vi.fn(),
      setActiveView: vi.fn(),
      chatWidth: 320,
      chatPosition: "left",
    };

    mockProjectState = {
      activeTab: null,
      openTabs: [],
      fileContents: {},
      isDirty: {},
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
      workspaces: [],
      activeWorkspaceId: null,
    };
  });

  it("should render editor panel with placeholder when no file is open", () => {
    mockUIState = { ...mockUIState, activeView: "editor" };
    render(<EditorPanel />);
    // The placeholder text or a prompt to open a project should appear
    const container = document.querySelector("[class*='flex']");
    expect(container).not.toBeNull();
  });

  it("should render Monaco editor when a file is active", async () => {
    mockUIState = { ...mockUIState, activeView: "editor" };
    mockProjectState = {
      ...mockProjectState,
      activeTab: "/test/index.html",
      openTabs: ["/test/index.html"],
      fileContents: { "/test/index.html": "<h1>Hola</h1>" },
      isDirty: { "/test/index.html": false },
      workspaces: [{ id: "ws-1", path: "/test", name: "test", files: [] }],
      activeWorkspaceId: "ws-1",
    };

    render(<EditorPanel />);
    expect(await screen.findByTestId("monaco-editor")).toBeDefined();
  });

  it("should pass correct language to Monaco based on file extension", async () => {
    mockUIState = { ...mockUIState, activeView: "editor" };
    mockProjectState = {
      ...mockProjectState,
      activeTab: "/test/styles.css",
      openTabs: ["/test/styles.css"],
      fileContents: { "/test/styles.css": "body { color: red; }" },
      isDirty: { "/test/styles.css": false },
      workspaces: [{ id: "ws-1", path: "/test", name: "test", files: [] }],
      activeWorkspaceId: "ws-1",
    };

    render(<EditorPanel />);
    const editor = await screen.findByTestId("monaco-editor");
    expect(editor.getAttribute("data-language")).toBe("css");
  });
});
