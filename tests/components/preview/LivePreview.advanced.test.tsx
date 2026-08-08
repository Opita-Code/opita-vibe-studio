import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LivePreview, buildPreviewContent } from "../../../src/components/preview/LivePreview";
import { useUIStore } from "../../../src/stores/ui";

let previewFilesState = {
  files: {},
  template: "vanilla",
  hasPreviewableFiles: false,
  fileCount: 0,
};

vi.mock("../../../src/components/preview/usePreviewFiles", () => ({
  usePreviewFiles: () => previewFilesState,
}));

vi.mock("../../../src/components/preview/VibeEnginePreview", () => ({
  VibeEnginePreview: () => <div data-testid="vibe-engine-preview" />,
}));

vi.mock("../../../src/components/preview/EmptyPreviewState", () => ({
  EmptyPreviewState: () => <div data-testid="empty-preview-state">Vacío</div>,
}));

vi.mock("@codesandbox/sandpack-react", () => ({
  SandpackProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sandpack-provider">{children}</div>,
  useSandpack: () => ({ dispatch: vi.fn() }),
}));

beforeEach(() => {
  previewFilesState = { files: {}, template: "vanilla", hasPreviewableFiles: false, fileCount: 0 };
  useUIStore.setState({ previewDevice: "desktop" });
});

describe("LivePreview", () => {
  it("should render the empty state when there are no previewable files", () => {
    render(<LivePreview />);
    expect(screen.getByTestId("empty-preview-state")).toBeDefined();
  });

  it("should render the sandpack provider with files when previewable", () => {
    previewFilesState = {
      files: { "/App.js": { code: "console.log(1)" } },
      template: "react",
      hasPreviewableFiles: true,
      fileCount: 2,
    };
    render(<LivePreview />);
    expect(screen.getByTestId("sandpack-provider")).toBeDefined();
    expect(screen.getByTestId("vibe-engine-preview")).toBeDefined();
    expect(screen.getByText(/VibeLens · 2 archivos/)).toBeDefined();
  });

  it("should expose a refreshPreview imperative handle", () => {
    const ref = { current: null as unknown as { refreshPreview: () => void } | null };
    previewFilesState = {
      files: {},
      template: "react",
      hasPreviewableFiles: true,
      fileCount: 1,
    };
    render(<LivePreview ref={ref} />);
    expect(typeof ref.current?.refreshPreview).toBe("function");
  });

  it("should expose buildPreviewContent as a backward-compat stub", () => {
    expect(buildPreviewContent()).toEqual({ html: "", isFullDocument: false });
  });
});
