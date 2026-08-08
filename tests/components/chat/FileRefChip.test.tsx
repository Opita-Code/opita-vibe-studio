import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FileRefChip } from "../../../src/components/chat/FileRefChip";
import { useUIStore } from "../../../src/stores/ui";
const projectState = {
  workspaces: [{ id: "ws-1", path: "/test", name: "test", files: [], isGitRepo: false, gitBranch: null }],
  activeWorkspaceId: "ws-1",
  openFile: vi.fn(async () => {}),
};

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector(projectState as unknown as Record<string, unknown>),
    { getState: () => projectState },
  ),
}));

function spyNavigate() {
  const handler = vi.fn();
  window.addEventListener("vibe:navigate-to-line", handler as EventListener);
  const cleanup = () => window.removeEventListener("vibe:navigate-to-line", handler as EventListener);
  return { handler, cleanup };
}

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ fileRefClickMode: "hold" } as never);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FileRefChip", () => {
  it("should render the basename and line range as the label", () => {
    render(<FileRefChip filePath="src/app.ts" line={42} endLine={58} />);
    expect(screen.getByText("app.ts:42-58")).toBeDefined();
  });

  it("should render the basename with a single line", () => {
    render(<FileRefChip filePath="src/utils.ts" line={7} />);
    expect(screen.getByText("utils.ts:7")).toBeDefined();
  });

  it("should render just the basename without line numbers", () => {
    render(<FileRefChip filePath="index.html" />);
    expect(screen.getByText("index.html")).toBeDefined();
  });

  it("should navigate on double-click in hold mode", async () => {
    const { handler: _handler, cleanup } = spyNavigate();
    render(<FileRefChip filePath="src/app.ts" line={10} />);
    fireEvent.doubleClick(screen.getByText("app.ts:10"));
    await vi.waitFor(() => {
      expect(projectState.openFile).toHaveBeenCalledWith("/test/src/app.ts");
      expect(_handler).toHaveBeenCalled();
    });
    cleanup();
  });

  it("should navigate after a long hold in hold mode", () => {
    const { handler: _handler, cleanup } = spyNavigate();
    render(<FileRefChip filePath="src/app.ts" />);
    fireEvent.pointerDown(screen.getByText("app.ts"));
    act(() => { vi.advanceTimersByTime(320); });
    expect(projectState.openFile).toHaveBeenCalled();
    fireEvent.pointerUp(screen.getByText("app.ts"));
    cleanup();
  });

  it("should show a tooltip when released early in hold mode", () => {
    render(<FileRefChip filePath="src/app.ts" />);
    const chip = screen.getByText("app.ts");
    fireEvent.pointerDown(chip);
    fireEvent.pointerUp(chip);
    expect(screen.getByText("Mantén presionado o haz doble clic")).toBeDefined();
  });

  it("should navigate on a single click in click mode", async () => {
    useUIStore.setState({ fileRefClickMode: "click" } as never);
    const { handler: _handler, cleanup } = spyNavigate();
    render(<FileRefChip filePath="src/app.ts" />);
    fireEvent.click(screen.getByText("app.ts"));
    await vi.waitFor(() => {
      expect(projectState.openFile).toHaveBeenCalled();
    });
    cleanup();
  });

  it("should be non-interactive in disabled mode", () => {
    useUIStore.setState({ fileRefClickMode: "disabled" } as never);
    const { container } = render(<FileRefChip filePath="src/app.ts" />);
    const chip = screen.getByText("app.ts");
    expect(chip.getAttribute("role")).toBeNull();
    fireEvent.click(chip);
    expect(projectState.openFile).not.toHaveBeenCalled();
    expect(container.querySelector("[title]")?.getAttribute("title")).toBe("src/app.ts");
  });

  it("should dismiss the tooltip and switch to click mode via the button", () => {
    render(<FileRefChip filePath="src/app.ts" />);
    const chip = screen.getByText("app.ts");
    fireEvent.pointerDown(chip);
    fireEvent.pointerUp(chip);
    fireEvent.click(screen.getByText("No mostrar"));
    expect(useUIStore.getState().fileRefClickMode).toBe("click");
  });

  it("should clear the hold timer on pointer leave", () => {
    render(<FileRefChip filePath="src/app.ts" />);
    const chip = screen.getByText("app.ts");
    fireEvent.pointerDown(chip);
    fireEvent.pointerLeave(chip);
    act(() => { vi.advanceTimersByTime(320); });
    expect(projectState.openFile).not.toHaveBeenCalled();
  });
});
