import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorToolbar } from "../../../src/components/editor/EditorToolbar";
import { useProjectStore } from "../../../src/stores/project";
import { useUIStore } from "../../../src/stores/ui";
import { useChatStore } from "../../../src/stores/chat";

vi.mock("../../../src/agent/useAgentHandler", () => ({
  useAgentHandler: () => ({ send: sendMock }),
}));
const sendMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({
    activeView: "editor",
    activeSidebar: "chat",
    setActiveView: vi.fn(),
    setActiveSidebar: vi.fn(),
  } as never);
  useChatStore.setState({ setShareActiveFileContext: vi.fn() } as never);
  useProjectStore.setState({ activeTab: null } as never);
});

describe("EditorToolbar", () => {
  it("should render view toggle buttons", () => {
    render(<EditorToolbar />);
    expect(screen.getByTitle("Solo Código")).toBeDefined();
    expect(screen.getByTitle("Dividir (Código + Previsualización)")).toBeDefined();
  });

  it("should switch to editor view", () => {
    render(<EditorToolbar />);
    fireEvent.click(screen.getByTitle("Solo Código"));
    expect(useUIStore.getState().setActiveView).toHaveBeenCalledWith("editor");
  });

  it("should switch to split view", () => {
    render(<EditorToolbar />);
    fireEvent.click(screen.getByTitle("Dividir (Código + Previsualización)"));
    expect(useUIStore.getState().setActiveView).toHaveBeenCalledWith("split");
  });

  it("should send a quick action when there is an active tab", () => {
    const setActiveSidebar = vi.fn();
    const setShareActiveFileContext = vi.fn();
    useUIStore.setState({ activeSidebar: "explorer", setActiveSidebar } as never);
    useChatStore.setState({ setShareActiveFileContext } as never);
    useProjectStore.setState({ activeTab: "/test/a.ts" } as never);

    render(<EditorToolbar />);
    fireEvent.click(screen.getByTitle("Explicar Código con IA"));
    expect(setActiveSidebar).toHaveBeenCalledWith("chat");
    expect(setShareActiveFileContext).toHaveBeenCalledWith(true);
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("Explica"));
  });

  it("should not open the chat sidebar when it is already open", () => {
    const setActiveSidebar = vi.fn();
    useUIStore.setState({ activeSidebar: "chat", setActiveSidebar } as never);
    useProjectStore.setState({ activeTab: "/test/a.ts" } as never);
    render(<EditorToolbar />);
    fireEvent.click(screen.getByTitle("Buscar y Corregir Errores"));
    expect(setActiveSidebar).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalled();
  });

  it("should not send quick actions without an active tab", () => {
    useProjectStore.setState({ activeTab: null } as never);
    render(<EditorToolbar />);
    fireEvent.click(screen.getByTitle("Optimizar Rendimiento"));
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("should send the test-generation prompt", () => {
    useProjectStore.setState({ activeTab: "/test/a.ts" } as never);
    render(<EditorToolbar />);
    fireEvent.click(screen.getByTitle("Generar Pruebas Unitarias"));
    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining("vitest"));
  });
});
