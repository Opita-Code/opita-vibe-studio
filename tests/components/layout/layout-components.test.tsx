import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BugReportModal } from "../../../src/components/layout/BugReportModal";
import { ResizeHandle } from "../../../src/components/layout/ResizeHandle";
import { TitleBar } from "../../../src/components/layout/TitleBar";
import { MobileNavBar } from "../../../src/components/layout/MobileNavBar";
import { useUIStore } from "../../../src/stores/ui";

vi.mock("../../../src/lib/platform", () => ({
  isTauri: vi.fn(() => false),
}));
const mockMinimize = vi.fn();
const mockToggleMaximize = vi.fn();
const mockClose = vi.fn();
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    toggleMaximize: mockToggleMaximize,
    close: mockClose,
  }),
}));

import * as platform from "../../../src/lib/platform";

beforeEach(() => {
  vi.clearAllMocks();
  (platform.isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
});

describe("BugReportModal", () => {
  beforeEach(() => {
    useUIStore.setState({ bugReportVisible: false } as never);
  });

  it("should render nothing when not visible", () => {
    render(<BugReportModal />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should render the report form when visible", () => {
    useUIStore.setState({ bugReportVisible: true } as never);
    render(<BugReportModal />);
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByPlaceholderText("Describe el problema aquí...")).toBeDefined();
  });

  it("should disable submit until text is entered", () => {
    useUIStore.setState({ bugReportVisible: true } as never);
    render(<BugReportModal />);
    const submit = screen.getByText("Enviar Reporte") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Describe el problema aquí..."), {
      target: { value: "se rompió el preview" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("should open a mailto and show success on submit", () => {
    useUIStore.setState({ bugReportVisible: true } as never);
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    render(<BugReportModal />);
    fireEvent.change(screen.getByPlaceholderText("Describe el problema aquí..."), {
      target: { value: "se rompió el preview" },
    });
    fireEvent.click(screen.getByText("Enviar Reporte"));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("mailto:soporte@opitacode.com"),
      "_blank",
    );
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/Gracias por tu feedback/)).toBeDefined();
    vi.unstubAllGlobals();
  });

  it("should close on Escape", () => {
    useUIStore.setState({ bugReportVisible: true } as never);
    render(<BugReportModal />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(useUIStore.getState().bugReportVisible).toBe(false);
  });

  it("should close via the backdrop", () => {
    useUIStore.setState({ bugReportVisible: true } as never);
    render(<BugReportModal />);
    fireEvent.click(document.querySelector("[class*='absolute inset-0']")!);
    expect(useUIStore.getState().bugReportVisible).toBe(false);
  });

  it("should close via the X button", () => {
    useUIStore.setState({ bugReportVisible: true } as never);
    render(<BugReportModal />);
    fireEvent.click(screen.getByLabelText("Cerrar reporte de bug"));
    expect(useUIStore.getState().bugReportVisible).toBe(false);
  });
});

describe("ResizeHandle", () => {
  it("should render a separator for horizontal orientation", () => {
    render(<ResizeHandle onResize={() => {}} />);
    expect(screen.getByRole("separator")).toBeDefined();
    expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe("vertical");
  });

  it("should report drag deltas on mousemove", () => {
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} />);
    fireEvent.mouseDown(screen.getByRole("separator"), { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 115 });
    expect(onResize).toHaveBeenCalledWith(15);
    fireEvent.mouseMove(window, { clientX: 125 });
    expect(onResize).toHaveBeenCalledWith(10);
    fireEvent.mouseUp(window);
  });

  it("should report deltas along the Y axis for vertical orientation", () => {
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} orientation="vertical" />);
    fireEvent.mouseDown(screen.getByRole("separator"), { clientY: 50 });
    fireEvent.mouseMove(window, { clientY: 60 });
    expect(onResize).toHaveBeenCalledWith(10);
    fireEvent.mouseUp(window);
  });

  it("should ignore mousemove when not dragging", () => {
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} />);
    fireEvent.mouseMove(window, { clientX: 200 });
    expect(onResize).not.toHaveBeenCalled();
  });
});

describe("TitleBar", () => {
  it("should render nothing outside Tauri", () => {
    (platform.isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { container } = render(<TitleBar />);
    expect(container.firstChild).toBeNull();
  });

  it("should render the menu bar and window controls in Tauri", () => {
    (platform.isTauri as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    render(<TitleBar />);
    expect(screen.getByText("Vibe Studio")).toBeDefined();
    expect(screen.getByText("Archivo")).toBeDefined();
    expect(screen.getByText("Ayuda")).toBeDefined();
    fireEvent.click(screen.getByTitle("Minimizar"));
    expect(mockMinimize).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle("Maximizar"));
    expect(mockToggleMaximize).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle("Cerrar"));
    expect(mockClose).toHaveBeenCalled();
  });
});

describe("MobileNavBar", () => {
  beforeEach(() => {
    useUIStore.setState({
      activeView: "editor",
      explorerVisible: false,
      terminalVisible: false,
    } as never);
  });

  it("should render nav buttons", () => {
    render(<MobileNavBar />);
    expect(screen.getByLabelText("Cambiar a vista Editor")).toBeDefined();
    expect(screen.getByLabelText("Cambiar a vista Preview")).toBeDefined();
  });

  it("should switch to preview view", () => {
    render(<MobileNavBar />);
    fireEvent.click(screen.getByLabelText("Cambiar a vista Preview"));
    expect(useUIStore.getState().activeView).toBe("preview");
  });

  it("should toggle the explorer", () => {
    render(<MobileNavBar />);
    const explorerBtn = screen.getByLabelText("Abrir explorador de archivos");
    fireEvent.click(explorerBtn);
    expect(useUIStore.getState().explorerVisible).toBe(true);
  });

  it("should toggle the terminal", () => {
    render(<MobileNavBar />);
    const terminalBtn = screen.getByLabelText("Abrir terminal");
    fireEvent.click(terminalBtn);
    expect(useUIStore.getState().terminalVisible).toBe(true);
  });
});
