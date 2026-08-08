import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContextPanel } from "../../../src/components/settings/ContextPanel";
import { SubagentPanel } from "../../../src/components/settings/SubagentPanel";
import { useAuthStore } from "../../../src/stores/auth";
import { useChatStore } from "../../../src/stores/chat";

describe("ContextPanel", () => {
  beforeEach(() => {
    useAuthStore.setState({ plan: "free" } as never);
  });

  it("should show the pro gate for free users", () => {
    render(<ContextPanel />);
    expect(screen.getByText("Contexto Inteligente (Pro)")).toBeDefined();
    expect(screen.queryByText("Vibe Storage")).toBeNull();
  });

  it("should show the pro content for pro users", () => {
    useAuthStore.setState({ plan: "pro" } as never);
    render(<ContextPanel />);
    expect(screen.getByText("Vibe Storage")).toBeDefined();
    expect(screen.getByText("Context7")).toBeDefined();
    expect(screen.getByText(/0 MB \/ 5 GB/)).toBeDefined();
    expect(screen.getByText(/Estado: Conectado vía MCP/)).toBeDefined();
  });
});

describe("SubagentPanel", () => {
  beforeEach(() => {
    useAuthStore.setState({ plan: "free" } as never);
    useChatStore.setState({
      useSubagent: false,
      subagentInstructions: "",
      setUseSubagent: vi.fn(),
      setSubagentInstructions: vi.fn(),
    } as never);
  });

  it("should show the pro gate for free users", () => {
    render(<SubagentPanel />);
    expect(screen.getByText("Vibe Pro Engine")).toBeDefined();
    expect(screen.getByText(/reservado para usuarios Pro/)).toBeDefined();
  });

  it("should render the subagent toggle and instructions for pro users", () => {
    useAuthStore.setState({ plan: "pro" } as never);
    render(<SubagentPanel />);
    expect(screen.getByText("Motor Vibe Pro (AWS)")).toBeDefined();
    expect(screen.getByPlaceholderText(/Usa siempre TailwindCSS/)).toBeDefined();
  });
});
