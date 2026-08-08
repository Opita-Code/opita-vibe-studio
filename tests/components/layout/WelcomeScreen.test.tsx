import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomeScreen } from "../../../src/components/layout/WelcomeScreen";

// ── Store mocks ─────────────────────────────────────────────────

const uiActions = {
  setActiveSidebar: vi.fn(),
  setActiveView: vi.fn(),
  setVibeLensEnabled: vi.fn(),
};

vi.mock("../../../src/stores/ui", () => ({
  useUIStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({} as Record<string, unknown>),
    { getState: () => uiActions },
  ),
}));

const projectActions = {
  openProject: vi.fn(async () => {}),
  scaffoldTemplate: vi.fn(),
};

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector(projectActions as unknown as Record<string, unknown>),
    { getState: () => projectActions },
  ),
}));

const vibeEmit = vi.fn();
vi.mock("../../../src/lib/vibe-events", () => ({
  vibeEvents: { emit: vibeEmit },
}));

const fsBackend = {
  isAvailable: vi.fn(() => true),
  selectDirectory: vi.fn(async () => null),
};

vi.mock("../../../src/lib/fs-backend", () => ({
  getFileSystemBackend: () => fsBackend,
}));

// ── Helpers ─────────────────────────────────────────────────────

function spyOnPrefill() {
  const handler = vi.fn();
  window.addEventListener("vibe:prefill-chat", handler as EventListener);
  const cleanup = () => window.removeEventListener("vibe:prefill-chat", handler as EventListener);
  return { handler, cleanup };
}

describe("WelcomeScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render heading and suggestion chips", () => {
    render(<WelcomeScreen />);
    expect(screen.getByText("¿Qué quieres construir hoy?")).toBeDefined();
    expect(screen.getByText("Landing page")).toBeDefined();
    expect(screen.getByText("Portfolio")).toBeDefined();
    expect(screen.getByText("App de tareas")).toBeDefined();
    expect(screen.getByText("Dashboard")).toBeDefined();
  });

  it("should dispatch prefill event and open chat on submit with text", () => {
    const { handler, cleanup } = spyOnPrefill();
    render(<WelcomeScreen />);

    const textarea = screen.getByLabelText("Describe tu idea para que Vibe AI la construya");
    fireEvent.change(textarea, { target: { value: "  Crea un juego  " } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(uiActions.setActiveSidebar).toHaveBeenCalledWith("chat");
    expect(handler).toHaveBeenCalled();
    expect((handler.mock.calls[0][0] as CustomEvent).detail.message).toBe("Crea un juego");
    // input is cleared after sending
    expect((screen.getByLabelText("Describe tu idea para que Vibe AI la construya") as HTMLTextAreaElement).value).toBe("");
    cleanup();
  });

  it("should show send button only when there is text", () => {
    const { container } = render(<WelcomeScreen />);
    expect(screen.queryByRole("button", { name: "Enviar idea a Vibe AI" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Describe tu idea para que Vibe AI la construya"), {
      target: { value: "hola" },
    });
    expect(screen.getByRole("button", { name: "Enviar idea a Vibe AI" })).toBeDefined();
    expect(container.querySelector("button[aria-label='Enviar idea a Vibe AI']")?.textContent).toContain(
      "Construir",
    );
  });

  it("should not submit when input is empty or whitespace", () => {
    const { handler: _prefillHandler, cleanup } = spyOnPrefill();
    render(<WelcomeScreen />);
    const textarea = screen.getByLabelText("Describe tu idea para que Vibe AI la construya");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(uiActions.setActiveSidebar).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(uiActions.setActiveSidebar).not.toHaveBeenCalled();
    cleanup();
  });

  it("should allow Shift+Enter to keep typing (no submit)", () => {
    const { handler: _prefillHandler, cleanup } = spyOnPrefill();
    render(<WelcomeScreen />);
    const textarea = screen.getByLabelText("Describe tu idea para que Vibe AI la construya");
    fireEvent.change(textarea, { target: { value: "texto" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(uiActions.setActiveSidebar).not.toHaveBeenCalled();
    cleanup();
  });

  it("should load a template when a suggestion with templateId is clicked", async () => {
    const { handler: _prefillHandler, cleanup } = spyOnPrefill();
    render(<WelcomeScreen />);

    fireEvent.click(screen.getByTestId("template-chip-react-landing"));

    expect(projectActions.scaffoldTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "react-landing" }),
    );
    expect(uiActions.setActiveSidebar).toHaveBeenCalledWith("explorer");
    expect(uiActions.setActiveView).toHaveBeenCalledWith("split");
    expect(uiActions.setVibeLensEnabled).toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(vibeEmit).toHaveBeenCalled());
    cleanup();
  });

  it("should only prefill chat for suggestions without templateId", () => {
    const { handler: _prefillHandler, cleanup } = spyOnPrefill();
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByTestId("template-chip-dashboard"));

    expect(projectActions.scaffoldTemplate).not.toHaveBeenCalled();
    cleanup();
    expect(uiActions.setActiveSidebar).toHaveBeenCalledWith("chat");
  });

  it("should open a project via folder picker", async () => {
    fsBackend.isAvailable.mockReturnValue(true);
    fsBackend.selectDirectory.mockResolvedValue("/workspace/proyecto");
    projectActions.openProject.mockResolvedValue(undefined);

    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("Abrir proyecto existente"));

    await vi.waitFor(() => expect(projectActions.openProject).toHaveBeenCalledWith("/workspace/proyecto"));
    expect(uiActions.setActiveSidebar).toHaveBeenCalledWith("explorer");
    expect(uiActions.setActiveView).toHaveBeenCalledWith("editor");
  });

  it("should do nothing when folder picker is not available", async () => {
    fsBackend.isAvailable.mockReturnValue(false);
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("Abrir proyecto existente"));
    await vi.waitFor(() => expect(fsBackend.isAvailable).toHaveBeenCalled());
    expect(projectActions.openProject).not.toHaveBeenCalled();
  });

  it("should swallow errors from folder picker (user cancelled)", async () => {
    fsBackend.isAvailable.mockReturnValue(true);
    fsBackend.selectDirectory.mockRejectedValue(new Error("cancel"));
    render(<WelcomeScreen />);
    fireEvent.click(screen.getByText("Abrir proyecto existente"));
    await vi.waitFor(() => expect(fsBackend.selectDirectory).toHaveBeenCalled());
    expect(projectActions.openProject).not.toHaveBeenCalled();
  });
});
