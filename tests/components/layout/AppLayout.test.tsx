import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../../../src/App";
import { useAuthStore } from "../../../src/stores/auth";
import { useUIStore } from "../../../src/stores/ui";

beforeEach(() => {
  // Pre-set the auth store AND the app's sessionRestored state is internal.
  // We set isAuthenticated=true so when sessionRestored becomes true (after
  // restoreSession resolves), the main layout renders.
  useAuthStore.setState({
    user: {
      id: "test",
      email: "test@opita.co",
      name: "Test",
      plan: "free",
      verified: false,
    },
    session: { token: "test", expiresAt: Date.now() + 3600000 },
    plan: "free",
    isAuthenticated: true,
    isLoading: false,
    tokenUsage: {
      promptsUsed: 0,
      promptsLimit: 30,
      billingPeriodStart: new Date().toISOString(),
      billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  useUIStore.setState({
    sidebarWidth: 240,
    chatVisible: true,
    statusMessage: "Listo",
    activeModel: "deepseek-chat",
    connectedProvider: "DeepSeek",
    tokensRemaining: 0,
    previewRatio: 0.35,
    previewVisible: true,
  });
});

describe("App Layout", () => {
  it("should render the explorer sidebar", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Explorador")).toBeDefined());
  });

  it("should render the editor area", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Editor de código")).toBeDefined());
  });

  it("should render the chat panel", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Chat")).toBeDefined());
  });

  it("should render the live preview toggle button", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Vista Previa")).toBeDefined());
  });

  it("should render the status bar", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("DeepSeek")).toBeDefined();
      expect(screen.getByText("deepseek-chat")).toBeDefined();
    });
  });

  it("should render the status message 'Listo'", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Listo")).toBeDefined());
  });
});
