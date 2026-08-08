import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatHistoryPanel } from "../../../src/components/chat/ChatHistoryPanel";
import { useChatStore } from "../../../src/stores/chat";
import { useUIStore } from "../../../src/stores/ui";
import { ExecutionRoadmap } from "../../../src/components/chat/ExecutionRoadmap";
import type { RoadmapGoal } from "../../../src/agent/types";

describe("ChatHistoryPanel", () => {
  beforeEach(() => {
    useChatStore.setState({
      sessions: {},
      createNewSession: vi.fn(),
      switchSession: vi.fn(),
      deleteSession: vi.fn(),
    } as never);
    useUIStore.setState({ toggleChatHistory: vi.fn() } as never);
  });

  it("should render empty state when there are no sessions", () => {
    render(<ChatHistoryPanel />);
    expect(screen.getByText("No hay sesiones guardadas.")).toBeDefined();
    expect(screen.getByText("Historial")).toBeDefined();
  });

  it("should list sessions sorted by updatedAt desc", () => {
    useChatStore.setState({
      sessions: {
        a: { id: "a", title: "Chat viejo", messages: [], createdAt: 1, updatedAt: 100 },
        b: { id: "b", title: "Chat nuevo", messages: [], createdAt: 2, updatedAt: 200 },
      },
    } as never);
    render(<ChatHistoryPanel />);
    // both session titles present
    expect(screen.getByText("Chat nuevo")).toBeDefined();
    expect(screen.getByText("Chat viejo")).toBeDefined();
    // first rendered session is the newest
    const first = screen.getByText("Chat nuevo").closest("div")!.parentElement!.innerHTML;
    expect(first).toContain("Chat nuevo");
  });

  it("should switch session when a session row is clicked", () => {
    const switchSession = vi.fn();
    useChatStore.setState({
      sessions: {
        a: { id: "a", title: "Chat A", messages: [], createdAt: 1, updatedAt: 100 },
      },
      switchSession,
    } as never);
    render(<ChatHistoryPanel />);
    fireEvent.click(screen.getByText("Chat A"));
    expect(switchSession).toHaveBeenCalledWith("a");
  });

  it("should switch session on Enter key", () => {
    const switchSession = vi.fn();
    useChatStore.setState({
      sessions: {
        a: { id: "a", title: "Chat A", messages: [], createdAt: 1, updatedAt: 100 },
      },
      switchSession,
    } as never);
    render(<ChatHistoryPanel />);
    fireEvent.keyDown(screen.getByText("Chat A"), { key: "Enter" });
    expect(switchSession).toHaveBeenCalledWith("a");
  });

  it("should delete a session", () => {
    const deleteSession = vi.fn();
    useChatStore.setState({
      sessions: {
        a: { id: "a", title: "Chat A", messages: [], createdAt: 1, updatedAt: 100 },
      },
      deleteSession,
    } as never);
    render(<ChatHistoryPanel />);
    fireEvent.click(screen.getByLabelText("Eliminar chat: Chat A"));
    expect(deleteSession).toHaveBeenCalledWith("a");
  });

  it("should create a new session", () => {
    const createNewSession = vi.fn();
    useChatStore.setState({ createNewSession } as never);
    render(<ChatHistoryPanel />);
    fireEvent.click(screen.getByLabelText("Crear nuevo chat"));
    expect(createNewSession).toHaveBeenCalled();
  });

  it("should toggle chat history", () => {
    const toggleChatHistory = vi.fn();
    useUIStore.setState({ toggleChatHistory } as never);
    render(<ChatHistoryPanel />);
    fireEvent.click(screen.getByLabelText("Ocultar historial de chats"));
    expect(toggleChatHistory).toHaveBeenCalled();
  });
});

function makeGoal(overrides: Partial<RoadmapGoal> & { id: string }): RoadmapGoal {
  return { label: "meta", status: "pending", ...overrides };
}

describe("ExecutionRoadmap", () => {
  it("should return null when there are no goals", () => {
    const { container } = render(<ExecutionRoadmap goals={[]} progress={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("should render goals with progress", () => {
    const goals = [
      makeGoal({ id: "1", label: "Analizar", status: "done" }),
      makeGoal({ id: "2", label: "Construir", status: "active", progress: 40 }),
      makeGoal({ id: "3", label: "Verificar", status: "pending" }),
      makeGoal({ id: "4", label: "Fallido", status: "error" }),
    ];
    render(<ExecutionRoadmap goals={goals} progress={35} />);
    expect(screen.getByText("Progreso")).toBeDefined();
    expect(screen.getByText("35%")).toBeDefined();
    expect(screen.getByText("Analizar")).toBeDefined();
    expect(screen.getByText("Construir")).toBeDefined();
    expect(screen.getByText("Verificar")).toBeDefined();
    expect(screen.getByText("Fallido")).toBeDefined();
    // active phase label shows the active goal
    expect(screen.getByText("Construir...")).toBeDefined();
  });

  it("should render sub-progress bar for the active goal", () => {
    const goals = [makeGoal({ id: "1", label: "Build", status: "active", progress: 55 })];
    const { container } = render(<ExecutionRoadmap goals={goals} progress={55} />);
    expect(container.querySelectorAll("[style*='width: 55%']").length).toBeGreaterThan(0);
  });
});
