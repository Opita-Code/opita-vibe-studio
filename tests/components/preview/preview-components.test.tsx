import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitForElementToBeRemoved } from "@testing-library/react";
import { EmptyPreviewState } from "../../../src/components/preview/EmptyPreviewState";
import { DeviceFrame, DEVICE_SPECS } from "../../../src/components/preview/DeviceFrame";
import { VibeLensToolbar } from "../../../src/components/preview/VibeLensToolbar";
import { VibeEnginePreview } from "../../../src/components/preview/VibeEnginePreview";
import { VibeSandpackOverlay } from "../../../src/components/preview/VibeSandpackOverlay";
import { useUIStore } from "../../../src/stores/ui";
import { useProjectStore } from "../../../src/stores/project";

// ── Sandpack mocks ──────────────────────────────────────────────
const sandpackState = {
  error: null,
  status: "running",
  dispatch: vi.fn(),
};
vi.mock("@codesandbox/sandpack-react", () => ({
  useSandpack: () => ({ sandpack: sandpackState }),
  SandpackProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sandpack-provider">{children}</div>,
  SandpackPreview: () => <div data-testid="sandpack-preview">Preview</div>,
}));

describe("EmptyPreviewState", () => {
  it("should render the default hero and features", () => {
    render(<EmptyPreviewState />);
    expect(screen.getByText("Vibe")).toBeDefined();
    expect(screen.getByText("Studio")).toBeDefined();
    expect(screen.getByText("Live Coding")).toBeDefined();
    expect(screen.getByText("Vibe AI")).toBeDefined();
  });

  it("should render actionButton", () => {
    render(<EmptyPreviewState actionButton={<button>Accion</button>} />);
    expect(screen.getByText("Accion")).toBeDefined();
  });

  it("should render statusText when there is no actionButton", () => {
    render(<EmptyPreviewState statusText="Cargando..." />);
    expect(screen.getByText("Cargando...")).toBeDefined();
  });

  it("should hide statusText when actionButton is present", () => {
    render(<EmptyPreviewState actionButton={<button>Accion</button>} statusText="Texto oculto" />);
    expect(screen.queryByText("Texto oculto")).toBeNull();
  });
});

describe("DeviceFrame", () => {
  it("should render children directly for desktop", () => {
    render(<DeviceFrame device="desktop"><div data-testid="inner">content</div></DeviceFrame>);
    expect(screen.getByTestId("inner")).toBeDefined();
  });

  it("should render a phone frame for iphone with device label", () => {
    render(<DeviceFrame device="iphone"><div>content</div></DeviceFrame>);
    expect(screen.getByText(/iPhone 15/)).toBeDefined();
    expect(screen.getByText("9:41")).toBeDefined();
  });

  it("should render an android frame", () => {
    render(<DeviceFrame device="android"><div>content</div></DeviceFrame>);
    expect(screen.getByText(/Pixel 8/)).toBeDefined();
  });

  it("should render a tablet frame", () => {
    render(<DeviceFrame device="tablet"><div>content</div></DeviceFrame>);
    expect(screen.getByText(/iPad Air/)).toBeDefined();
  });

  it("should expose device specs for all devices", () => {
    expect(Object.keys(DEVICE_SPECS)).toEqual(["desktop", "iphone", "android", "tablet"]);
  });
});

describe("VibeLensToolbar", () => {
  beforeEach(() => {
    useUIStore.setState({ fullscreenPreviewVisible: true } as never);
  });

  it("should render the toolbar and trigger refresh", () => {
    const onRefresh = vi.fn();
    render(<VibeLensToolbar onRefresh={onRefresh} />);
    expect(screen.getByText("VibeLens")).toBeDefined();
    fireEvent.click(screen.getByLabelText("Recargar vista previa"));
    expect(onRefresh).toHaveBeenCalled();
  });

  it("should toggle fullscreen preview via the close button", () => {
    useUIStore.setState({ fullscreenPreviewVisible: false } as never);
    render(<VibeLensToolbar onRefresh={() => {}} />);
    fireEvent.click(screen.getByLabelText("Cerrar vista previa"));
    expect(useUIStore.getState().fullscreenPreviewVisible).toBe(true);
  });
});

describe("VibeEnginePreview", () => {
  it("should render the sandpack preview behind the overlay", () => {
    render(<VibeEnginePreview />);
    expect(screen.getByTestId("sandpack-preview")).toBeDefined();
  });
});

describe("VibeSandpackOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sandpackState.error = null;
    sandpackState.status = "running";
    useProjectStore.setState({ isDirty: {} } as never);
  });

  it("should show the cover with a manual dismiss button while running", () => {
    render(<VibeSandpackOverlay />);
    expect(screen.getByText("Mostrar Vista Previa")).toBeDefined();
  });

  it("should dismiss the cover on manual button click", async () => {
    const onDismiss = vi.fn();
    render(<VibeSandpackOverlay onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("Mostrar Vista Previa"));
    expect(onDismiss).toHaveBeenCalled();
    await waitForElementToBeRemoved(() => screen.queryByText("Mostrar Vista Previa"));
  });

  it("should auto-dismiss when the project becomes dirty while running", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<VibeSandpackOverlay onDismiss={onDismiss} />);
    useProjectStore.setState({ isDirty: { "/a.ts": true } } as never);
    rerender(<VibeSandpackOverlay onDismiss={onDismiss} />);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("should show the compiling status text when initializing", () => {
    sandpackState.status = "initializing";
    render(<VibeSandpackOverlay />);
    expect(screen.getByText("Descargando entorno...")).toBeDefined();
  });

  it("should render an error card with refresh action", () => {
    sandpackState.status = "error";
    sandpackState.error = { title: "Error de Compilación", message: "sintaxis inválida" };
    render(<VibeSandpackOverlay />);
    expect(screen.getByText("Error de Compilación")).toBeDefined();
    expect(screen.getAllByText("sintaxis inválida").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Reiniciar Motor"));
    expect(sandpackState.dispatch).toHaveBeenCalledWith({ type: "refresh" });
  });

  it("should render an error card with fallback text when error lacks detail", () => {
    sandpackState.status = "error";
    sandpackState.error = {};
    render(<VibeSandpackOverlay />);
    expect(screen.getByText("Error de Compilación")).toBeDefined();
    expect(screen.getByText(/Vibe Engine no pudo compilar/)).toBeDefined();
  });
});
