import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../../src/stores/ui";

beforeEach(() => {
  useUIStore.setState({
    sidebarWidth: 240,
    chatVisible: true,
    statusMessage: "Listo",
    activeModel: "deepseek-chat",
    connectedProvider: "DeepSeek",
    tokensRemaining: 0,
    previewRatio: 0.35,
  });
});

describe("UIStore", () => {
  it("should start with default layout values", () => {
    const state = useUIStore.getState();
    expect(state.sidebarWidth).toBe(240);
    expect(state.chatVisible).toBe(true);
    expect(state.previewRatio).toBe(0.35);
  });

  it("should set sidebar width within bounds", () => {
    useUIStore.getState().setSidebarWidth(300);
    expect(useUIStore.getState().sidebarWidth).toBe(300);
  });

  it("should clamp sidebar width to minimum 180", () => {
    useUIStore.getState().setSidebarWidth(100);
    expect(useUIStore.getState().sidebarWidth).toBe(180);
  });

  it("should clamp sidebar width to maximum 400", () => {
    useUIStore.getState().setSidebarWidth(500);
    expect(useUIStore.getState().sidebarWidth).toBe(400);
  });

  it("should toggle chat visibility", () => {
    useUIStore.getState().toggleChat();
    expect(useUIStore.getState().chatVisible).toBe(false);
    useUIStore.getState().toggleChat();
    expect(useUIStore.getState().chatVisible).toBe(true);
  });

  it("should set chat visibility explicitly", () => {
    useUIStore.getState().setChatVisible(false);
    expect(useUIStore.getState().chatVisible).toBe(false);
    useUIStore.getState().setChatVisible(true);
    expect(useUIStore.getState().chatVisible).toBe(true);
  });

  it("should set status message", () => {
    useUIStore.getState().setStatusMessage("Compilando...");
    expect(useUIStore.getState().statusMessage).toBe("Compilando...");
  });

  it("should set active model and provider", () => {
    useUIStore.getState().setActiveModel("gemini-2.0-flash");
    expect(useUIStore.getState().activeModel).toBe("gemini-2.0-flash");
    useUIStore.getState().setConnectedProvider("Gemini");
    expect(useUIStore.getState().connectedProvider).toBe("Gemini");
  });

  it("should set tokens remaining", () => {
    useUIStore.getState().setTokensRemaining(15000);
    expect(useUIStore.getState().tokensRemaining).toBe(15000);
  });

  it("should set preview ratio within bounds", () => {
    useUIStore.getState().setPreviewRatio(0.5);
    expect(useUIStore.getState().previewRatio).toBe(0.5);
  });

  it("should clamp preview ratio to minimum 0.15", () => {
    useUIStore.getState().setPreviewRatio(0.05);
    expect(useUIStore.getState().previewRatio).toBe(0.15);
  });

  it("should clamp preview ratio to maximum 0.6", () => {
    useUIStore.getState().setPreviewRatio(0.8);
    expect(useUIStore.getState().previewRatio).toBe(0.6);
  });

  // ─── Preview Toggle ─────────────────────────────────────────

  it("should toggle preview visibility", () => {
    expect(useUIStore.getState().previewVisible).toBe(true);
    useUIStore.getState().togglePreview();
    expect(useUIStore.getState().previewVisible).toBe(false);
    useUIStore.getState().togglePreview();
    expect(useUIStore.getState().previewVisible).toBe(true);
  });

  it("should set preview visibility explicitly", () => {
    useUIStore.getState().setPreviewVisible(false);
    expect(useUIStore.getState().previewVisible).toBe(false);
    useUIStore.getState().setPreviewVisible(true);
    expect(useUIStore.getState().previewVisible).toBe(true);
  });

  // ─── Terminal Toggle ────────────────────────────────────────

  it("should toggle terminal visibility", () => {
    expect(useUIStore.getState().terminalVisible).toBe(false);
    useUIStore.getState().toggleTerminal();
    expect(useUIStore.getState().terminalVisible).toBe(true);
    useUIStore.getState().toggleTerminal();
    expect(useUIStore.getState().terminalVisible).toBe(false);
  });

  it("should set terminal visibility explicitly", () => {
    useUIStore.getState().setTerminalVisible(true);
    expect(useUIStore.getState().terminalVisible).toBe(true);
    useUIStore.getState().setTerminalVisible(false);
    expect(useUIStore.getState().terminalVisible).toBe(false);
  });

  it("should set terminal height within bounds", () => {
    useUIStore.getState().setTerminalHeight(300);
    expect(useUIStore.getState().terminalHeight).toBe(300);
  });

  it("should clamp terminal height to minimum 100", () => {
    useUIStore.getState().setTerminalHeight(50);
    expect(useUIStore.getState().terminalHeight).toBe(100);
  });

  it("should clamp terminal height to maximum 500", () => {
    useUIStore.getState().setTerminalHeight(600);
    expect(useUIStore.getState().terminalHeight).toBe(500);
  });
});
