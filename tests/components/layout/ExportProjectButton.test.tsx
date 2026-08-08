import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportProjectButton } from "../../../src/components/layout/ExportProjectButton";

const hoisted = vi.hoisted(() => ({ projectState: {} as Record<string, unknown>, vibeEmit: vi.fn() }));

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (sel?: (s: Record<string, unknown>) => unknown) => (sel ? sel(hoisted.projectState) : hoisted.projectState),
    { getState: () => hoisted.projectState },
  ),
}));

vi.mock("../../../src/lib/vibe-events", () => ({ vibeEvents: { emit: hoisted.vibeEmit } }));
vi.mock("jszip", () => ({
  default: class MockZip {
    file = vi.fn();
    async generateAsync() {
      return new Blob(["zip"]);
    }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(hoisted.projectState, {
    activeWorkspaceId: null,
    workspaces: [],
    fileContents: {},
  });
});

describe("ExportProjectButton", () => {
  it("should render nothing without an active workspace", () => {
    const { container } = render(<ExportProjectButton />);
    expect(container.firstChild).toBeNull();
  });

  it("should export the project as a zip and emit an event", async () => {
    Object.assign(hoisted.projectState, {
      activeWorkspaceId: "ws-1",
      workspaces: [{ id: "ws-1", name: "proyecto", path: "/p", files: [], isGitRepo: false, gitBranch: null }],
      fileContents: {
        "ws-1/src/index.ts": "const a = 1;",
        "template://react-landing/src/App.tsx": "x",
      },
    });
    render(<ExportProjectButton />);
    fireEvent.click(screen.getByLabelText("Exportar proyecto"));
    await vi.waitFor(() => expect(hoisted.vibeEmit).toHaveBeenCalled());
    expect(hoisted.vibeEmit).toHaveBeenCalledWith({ type: "project_exported", format: "zip" });
  });
});
