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
      activeView: "split",
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
    mockUIState = { activeView: "editor" };
    render(<EditorPanel />);
    expect(screen.getByText("Comenzar un Proyecto")).toBeDefined();
    expect(screen.getByText("Selecciona una carpeta local de tu computadora para empezar a escribir código de manera segura.")).toBeDefined();
  });

  it("should render preview toggle button", () => {
    render(<EditorPanel />);
    expect(screen.getByText("Vista Previa")).toBeDefined();
  });

  it("should render preview iframe when preview is visible", () => {
    render(<EditorPanel />);
    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
  });

  it("should render Monaco editor when a file is active", () => {
    mockUIState = { activeView: "editor" };
    mockProjectState = {
      activeTab: "/test/index.html",
      openTabs: ["/test/index.html"],
      fileContents: { "/test/index.html": "<h1>Hola</h1>" },
      isDirty: { "/test/index.html": false },
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
      rootPath: "/test",
    };

    render(<EditorPanel />);
    expect(screen.getByTestId("monaco-editor")).toBeDefined();
  });

  it("should pass correct language to Monaco based on file extension", () => {
    mockUIState = { activeView: "editor" };
    mockProjectState = {
      activeTab: "/test/styles.css",
      openTabs: ["/test/styles.css"],
      fileContents: { "/test/styles.css": "body { color: red; }" },
      isDirty: { "/test/styles.css": false },
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
      rootPath: "/test",
    };

    render(<EditorPanel />);
    const editor = screen.getByTestId("monaco-editor");
    expect(editor.getAttribute("data-language")).toBe("css");
  });

  it("should hide preview container when activeView is editor", () => {
    mockUIState = { activeView: "editor" };

    const { container } = render(<EditorPanel />);
    // The preview section is wrapped in a div that gets "hidden" when activeView is editor
    // because isPreview (activeView === "preview") is false and we check for "hidden" in the class
    const previewContainer = container.querySelector(".hidden.transition-opacity");
    expect(previewContainer).not.toBeNull();
  });

  it("should wrap CSS content in style tags for preview", () => {
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
    const iframe = document.querySelector("iframe");
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("<style>");
    expect(srcdoc).toContain("body { color: red; }");
  });

  it("should wrap JS content in script tags for preview", () => {
    mockProjectState = {
      activeTab: "/test/script.js",
      openTabs: ["/test/script.js"],
      fileContents: { "/test/script.js": "console.log('hello');" },
      isDirty: { "/test/script.js": false },
      setFileContent: vi.fn(),
      saveFile: vi.fn(),
      statusMessage: null,
      clearStatusMessage: vi.fn(),
    };

    render(<EditorPanel />);
    const iframe = document.querySelector("iframe");
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toContain("<script>");
    expect(srcdoc).toContain("console.log('hello');");
  });
});
