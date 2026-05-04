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
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockUIState),
}));

describe("EditorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default UI store state
    mockUIState = {
      previewRatio: 0.35,
      setPreviewRatio: vi.fn(),
    };

    // Default project store state: no active tab
    mockProjectState = {
      activeTab: null,
      openTabs: [],
      fileContents: {},
      isDirty: {},
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
    };
  });

  it("should render editor panel with placeholder when no file is open", () => {
    render(<EditorPanel />);
    expect(screen.getByText("Editor de código")).toBeDefined();
    expect(screen.getByText("Abrí un archivo del explorador para empezar")).toBeDefined();
  });

  it("should render preview area", () => {
    render(<EditorPanel />);
    expect(screen.getByText("Vista previa en vivo")).toBeDefined();
  });

  it("should render Monaco editor when a file is active", () => {
    mockProjectState = {
      activeTab: "/test/index.html",
      openTabs: ["/test/index.html"],
      fileContents: { "/test/index.html": "<h1>Hola</h1>" },
      isDirty: { "/test/index.html": false },
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
    };

    render(<EditorPanel />);
    expect(screen.getByTestId("monaco-editor")).toBeDefined();
  });

  it("should pass correct language to Monaco based on file extension", () => {
    mockProjectState = {
      activeTab: "/test/styles.css",
      openTabs: ["/test/styles.css"],
      fileContents: { "/test/styles.css": "body { color: red; }" },
      isDirty: { "/test/styles.css": false },
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
    };

    render(<EditorPanel />);
    const editor = screen.getByTestId("monaco-editor");
    expect(editor.getAttribute("data-language")).toBe("css");
  });
});
