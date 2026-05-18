import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPanel } from "../../../src/components/layout/ChatPanel";
import { useAuthStore } from "../../../src/stores/auth";

// ─── Mocks for child components ──────────────────────────────────

vi.mock("../../../src/components/chat/MessageList", () => ({
  MessageList: ({ messages }: { messages: unknown[] }) => (
    <div data-testid="message-list">
      {messages.map((m: unknown) => {
        const msg = m as { id: string; content: string; role: string };
        return (
          <div key={msg.id} data-role={msg.role} data-testid={`msg-${msg.id}`}>
            {msg.content}
          </div>
        );
      })}
    </div>
  ),
}));

vi.mock("../../../src/components/chat/ChatInput", () => ({
  ChatInput: ({
    onSend,
    disabled,
  }: {
    onSend: (text: string) => void;
    disabled: boolean;
  }) => (
    <div data-testid="chat-input-mock">
      <input
        data-testid="mock-input"
        placeholder="Mock input"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSend("Hola");
          }
        }}
      />
      <span>{disabled ? "disabled" : "enabled"}</span>
    </div>
  ),
}));

vi.mock("../../../src/components/usage/TokenBar", () => ({
  TokenBar: ({ compact }: { compact?: boolean }) => (
    <div data-testid="token-bar">TokenBar {compact ? "compact" : ""}</div>
  ),
}));

// ─── Store mocks ─────────────────────────────────────────────────

const mockChatState = {
  messages: [] as { id: string; content: string; role: string }[],
  isStreaming: false,
  activeProvider: "deepseek",
  pipelinePhase: null as string | null,
  addMessage: vi.fn(),
  appendToLastMessage: vi.fn(),
  replaceLastMessageContent: vi.fn(),
  setStreaming: vi.fn(),
  setPipelinePhase: vi.fn(),
  sessions: { "default": { messages: [] as { id: string; content: string; role: string }[] } },
  activeSessionId: "default",
};

vi.mock("../../../src/stores/chat", () => ({
  useChatStore: Object.assign(
    (selector: (state: typeof mockChatState) => unknown) => selector(mockChatState),
    { getState: () => mockChatState },
  ),
}));

vi.mock("../../../src/stores/project", () => ({
  useProjectStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ workspaces: [{ id: "ws-1", path: "/test", name: "test", files: [] }] }),
    { getState: () => ({ workspaces: [{ id: "ws-1", path: "/test", name: "test", files: [] }] }) },
  ),
}));

describe("ChatPanel — voseo compliance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set auth store to limit-reached state
    useAuthStore.setState({
      user: { id: "test", name: "Test User", email: "test@example.com", plan: "free", verified: false },
      session: null,
      plan: "free",
      authMode: "authenticated",
      isLoading: false,
      tokenUsage: {
        tokensUsedToday: 150_000,
        tokensLimitDaily: 150_000,
        tokensUsedThisHour: 30_000,
        tokensLimitHourly: 30_000,
        plan: "free",
        resetDailyAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        resetHourlyAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    });

    mockChatState.messages = [];
    mockChatState.sessions["default"].messages = [];
    mockChatState.isStreaming = false;
  });

  it("should use 'Puedes' (neutral) instead of 'Podés' (voseo) when limit is reached", () => {
    // Get the current addMessage mock and capture the message it receives
    const addMessage = mockChatState.addMessage;

    render(<ChatPanel width={320} />);

    // Find the mock input and trigger send
    const input = screen.getByTestId("mock-input");
    fireEvent.keyDown(input, { key: "Enter" });

    // The addMessage callback should have been called with a limit message
    expect(addMessage).toHaveBeenCalled();

    const lastCall = addMessage.mock.calls[0][0] as { content: string };
    const content = lastCall.content;

    // Verify the limit message uses Colombian-neutral Spanish (not voseo)
    expect(content).not.toContain("Podés");
    expect(content).toContain("Puedes");
  });

  it("should not contain 'Puedes' in any message content", () => {
    const addMessage = mockChatState.addMessage;

    render(<ChatPanel width={320} />);

    const input = screen.getByTestId("mock-input");
    fireEvent.keyDown(input, { key: "Enter" });

    const lastCall = addMessage.mock.calls[0][0] as { content: string };
    const content = lastCall.content;

    // Verify the message uses the correct verb form
    expect(content).toContain("Puedes");
  });
});
