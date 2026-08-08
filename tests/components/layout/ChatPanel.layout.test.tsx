import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPanel } from "../../../src/components/layout/ChatPanel";
import { useChatStore } from "../../../src/stores/chat";
import { useAuthStore } from "../../../src/stores/auth";
import { useUIStore } from "../../../src/stores/ui";
import { useProjectStore } from "../../../src/stores/project";

// ── Mock agent hooks and children ───────────────────────────────
const agentMock = vi.hoisted(() => ({
  send: vi.fn(),
  cancel: vi.fn(),
  editPending: vi.fn(),
  setRestoreInputCallback: vi.fn(),
}));

vi.mock("../../../src/agent", () => ({
  useAgentHandler: () => agentMock,
}));

vi.mock("../../../src/hooks/useAgentSync", () => ({
  useAgentSync: () => {},
}));

vi.mock("../../../src/components/chat/MessageList", () => ({
  MessageList: ({ messages, isStreaming }: { messages: unknown[]; isStreaming: boolean }) => (
    <div data-testid="message-list">{messages.length} mensajes {isStreaming ? "streaming" : ""}</div>
  ),
}));

vi.mock("../../../src/components/chat/ChatInput", () => ({
  ChatInput: ({ onSend, disabled }: { onSend: (t: string) => void; disabled: boolean }) => (
    <button onClick={() => onSend("hola")} disabled={disabled} aria-label="enviar mock">
      ChatInput {disabled ? "deshabilitado" : "activo"}
    </button>
  ),
}));

vi.mock("../../../src/components/chat/AuraNudgeBar", () => ({
  AuraNudgeBar: () => <div data-testid="nudge-bar" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ authMode: "authenticated" } as never);
  useChatStore.setState({
    activeSessionId: "s1",
    sessions: {
      s1: { id: "s1", title: "t", messages: [], createdAt: 0, updatedAt: 0 },
    },
    isStreaming: false,
    pipelinePhase: null,
    shareActiveFileContext: true,
    setShareActiveFileContext: vi.fn(),
    createNewSession: vi.fn(),
    editMessage: vi.fn(),
  } as never);
  useUIStore.setState({
    chatFullscreen: false,
    chatHistoryVisible: false,
    fullscreenPreviewVisible: false,
    toggleChatHistory: vi.fn(),
    toggleChatFullscreen: vi.fn(),
    toggleFullscreenPreview: vi.fn(),
    toggleChatPosition: vi.fn(),
  } as never);
  useProjectStore.setState({ activeTab: "/test/app.ts", workspaces: [] } as never);
});

describe("ChatPanel (layout)", () => {
  it("should render the header with context bar", () => {
    render(<ChatPanel />);
    expect(screen.getByText("Vibe AI")).toBeDefined();
    expect(screen.getByText("app.ts")).toBeDefined();
  });

  it("should toggle chat history", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle("Mostrar/Ocultar Historial"));
    expect(useUIStore.getState().toggleChatHistory).toHaveBeenCalled();
  });

  it("should toggle the chat position", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByTitle("Cambiar de lado"));
    expect(useUIStore.getState().toggleChatPosition).toHaveBeenCalled();
  });

  it("should toggle the fullscreen preview", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("Toggle VibeLens preview"));
    expect(useUIStore.getState().toggleFullscreenPreview).toHaveBeenCalled();
  });

  it("should expand the chat to fullscreen", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("Expandir panel de chat a pantalla completa"));
    expect(useUIStore.getState().toggleChatFullscreen).toHaveBeenCalled();
  });

  it("should open and close the context popover", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("Ver archivos en contexto de la IA"));
    expect(screen.getByText("Archivo en contexto")).toBeDefined();
    fireEvent.click(screen.getByText("Quitar archivo del contexto"));
    expect(useChatStore.getState().setShareActiveFileContext).toHaveBeenCalledWith(false);
  });

  it("should show the stop button while streaming and cancel on click", () => {
    useChatStore.setState({ isStreaming: true } as never);
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("Detener generación de la respuesta"));
    expect(agentMock.cancel).toHaveBeenCalled();
  });

  it("should send messages through the chat input", () => {
    render(<ChatPanel />);
    fireEvent.click(screen.getByLabelText("enviar mock"));
    expect(agentMock.send).toHaveBeenCalledWith("hola", undefined);
  });

  it("should show the retry button for retry-tagged messages and retry", () => {
    useChatStore.setState({
      sessions: {
        s1: {
          id: "s1", title: "t",
          messages: [
            { id: "u1", role: "user", content: "prompt original", timestamp: Date.now() },
            { id: "a1", role: "assistant", content: "<!--RETRY_NETWORK-->", timestamp: Date.now() },
          ],
          createdAt: 0, updatedAt: 0,
        },
      },
      isStreaming: false,
    } as never);
    render(<ChatPanel />);
    fireEvent.click(screen.getByText(/Reintentar Envío/));
    expect(agentMock.send).toHaveBeenCalledWith("prompt original", undefined, true);
  });

  it("should show the login CTA for unauthenticated users", () => {
    useAuthStore.setState({ authMode: "unauthenticated" } as never);
    render(<ChatPanel />);
    expect(screen.getByText(/Despierta a Vibe AI/)).toBeDefined();
    expect(screen.getByText("Iniciar Sesión")).toBeDefined();
  });

  it("should render message count from the session", () => {
    useChatStore.setState({
      sessions: {
        s1: {
          id: "s1", title: "t",
          messages: [
            { id: "m1", role: "user", content: "a", timestamp: 0 },
            { id: "m2", role: "assistant", content: "b", timestamp: 1 },
          ],
          createdAt: 0, updatedAt: 0,
        },
      },
    } as never);
    render(<ChatPanel />);
    expect(screen.getByTestId("message-list").textContent).toContain("2 mensajes");
  });
});
