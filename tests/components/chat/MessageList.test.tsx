import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageList } from "../../../src/components/chat/MessageList";
import { useAuthStore } from "../../../src/stores/auth";
import { useGamificationStore } from "../../../src/stores/gamification";
import { useChatStore } from "../../../src/stores/chat";
import type { Message } from "../../../src/lib/types";

function makeMsg(overrides: Partial<Message> & { role: Message["role"] }): Message {
  return {
    id: "m-" + Math.random().toString(36).slice(2),
    content: "",
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeMany(n: number, role: Message["role"] = "user"): Message[] {
  return Array.from({ length: n }, (_, i) =>
    makeMsg({ role, content: `mensaje ${i}` }),
  );
}

beforeEach(() => {
  useAuthStore.setState({ authMode: "guest" } as never);
  useGamificationStore.setState({
    missions: [],
    missionPanelOpen: false,
    setMissionPanelOpen: vi.fn(),
  } as never);
  useChatStore.setState({ researchStatus: null } as never);
});

describe("MessageList", () => {
  it("should show empty state with starter prompts when there are no messages", () => {
    render(<MessageList messages={[]} isStreaming={false} />);
    expect(screen.getByText(/Hola, soy/)).toBeDefined();
    expect(screen.getByText("Explora la estructura de mi proyecto")).toBeDefined();
    expect(screen.getByText("Crea un componente con TypeScript y tests")).toBeDefined();
    expect(screen.getByText("Lee mi package.json y explícame las dependencias")).toBeDefined();
  });

  it("should trigger onSuggestionClick when a starter prompt is clicked", () => {
    const onSuggestionClick = vi.fn();
    render(
      <MessageList
        messages={[]}
        isStreaming={false}
        onSuggestionClick={onSuggestionClick}
      />,
    );
    fireEvent.click(screen.getByText("Explora la estructura de mi proyecto"));
    expect(onSuggestionClick).toHaveBeenCalledWith("Explora la estructura de mi proyecto");
  });

  it("should show active mission card for authenticated users", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({
      missions: [
        {
          id: "m1",
          type: "construir",
          title: "Crea tu primera app",
          description: "desc",
          xpReward: 100,
          quotaReward: 5000,
          difficulty: "novato",
          completed: false,
          progress: 40,
        },
      ],
      setMissionPanelOpen: vi.fn(),
    } as never);

    render(<MessageList messages={[]} isStreaming={false} />);
    const card = screen.getByTestId("active-mission-card");
    expect(card).toBeDefined();
    expect(screen.getByText("Crea tu primera app")).toBeDefined();
    expect(screen.getByText("Misión activa")).toBeDefined();
  });

  it("should open mission panel when active mission card is clicked", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    const setMissionPanelOpen = vi.fn();
    useGamificationStore.setState({
      missions: [
        {
          id: "m1",
          type: "aprender",
          title: "Aprende React",
          description: "desc",
          xpReward: 50,
          quotaReward: 2000,
          difficulty: "novato",
          completed: false,
        },
      ],
      setMissionPanelOpen,
    } as never);

    render(<MessageList messages={[]} isStreaming={false} />);
    fireEvent.click(screen.getByTestId("active-mission-card"));
    expect(setMissionPanelOpen).toHaveBeenCalledWith(true);
  });

  it("should NOT show mission card when there are no active missions", () => {
    useAuthStore.setState({ authMode: "authenticated" } as never);
    useGamificationStore.setState({ missions: [] } as never);
    render(<MessageList messages={[]} isStreaming={false} />);
    expect(screen.queryByTestId("active-mission-card")).toBeNull();
  });

  it("should render message bubbles for each message", () => {
    const messages = [
      makeMsg({ role: "user", content: "Hola Aura" }),
      makeMsg({ role: "assistant", content: "¿Qué necesitas?" }),
    ];
    render(<MessageList messages={messages} isStreaming={false} />);
    expect(screen.getByText("Hola Aura")).toBeDefined();
    expect(screen.getByText("¿Qué necesitas?")).toBeDefined();
  });

  it("should mark the last empty assistant message as thinking while streaming", () => {
    const messages = [
      makeMsg({ role: "user", content: "código" }),
      makeMsg({ role: "assistant", content: "" }),
    ];
    render(<MessageList messages={messages} isStreaming={true} />);
    // ThinkingContent shows one of the rotating phrases
    expect(screen.getByText(/Afinando el aura|Inyectando flow|Destilando|Calculando|Calibrando|Conectando|Compilando|Diseñando|Sincronizando|Preparando|Invocando|Haciendo|Consultando|Alineando|Optimizando/)).toBeDefined();
  });

  it("should forward onCancelMessage and onEditMessage to message bubbles", () => {
    const onCancel = vi.fn();
    const onEdit = vi.fn();
    const messages = [
      makeMsg({
        role: "user",
        content: "tarea pendiente",
        deliveryStatus: "pending" as const,
      }),
    ];
    render(
      <MessageList
        messages={messages}
        isStreaming={false}
        onCancelMessage={onCancel}
        onEditMessage={onEdit}
      />,
    );
    fireEvent.click(screen.getByLabelText("Cancelar mensaje"));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Editar mensaje"));
    expect(onEdit).toHaveBeenCalled();
  });

  it("should show context count header when messages exist", () => {
    render(<MessageList messages={makeMany(3)} isStreaming={false} />);
    expect(screen.getByText(/3\/500 mensajes/)).toBeDefined();
  });

  it("should show amber warning and Nuevo Chat button at high context usage", () => {
    const onNewChat = vi.fn();
    render(
      <MessageList
        messages={makeMany(400, "user")}
        isStreaming={false}
        onNewChat={onNewChat}
      />,
    );
    const newChatBtn = screen.getByLabelText("Iniciar nuevo chat");
    expect(newChatBtn).toBeDefined();
    fireEvent.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalled();
  });

  it("should show red banner at max context", () => {
    render(<MessageList messages={makeMany(500, "user")} isStreaming={false} />);
    expect(screen.getByText(/500\/500 mensajes/)).toBeDefined();
  });

  it("should show research status chip when researchStatus is set", () => {
    useChatStore.setState({ researchStatus: "searching" } as never);
    const messages = [makeMsg({ role: "assistant", content: "buscando..." })];
    render(<MessageList messages={messages} isStreaming={false} />);
    expect(screen.getByTestId("research-status-chip")).toBeDefined();
    expect(screen.getByText("Buscando documentación...")).toBeDefined();
  });

  it("should NOT show research status chip when researchStatus is null", () => {
    const messages = [makeMsg({ role: "assistant", content: "hola" })];
    render(<MessageList messages={messages} isStreaming={false} />);
    expect(screen.queryByTestId("research-status-chip")).toBeNull();
  });
});
