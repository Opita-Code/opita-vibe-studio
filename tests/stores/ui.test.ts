import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "../../src/stores/ui";

beforeEach(() => {
  useUIStore.setState({
    sidebarWidth: 240,
    statusMessage: "Listo",
    activeModel: "deepseek-chat",
    connectedProvider: "DeepSeek",
    tokensRemaining: 0,
    terminalVisible: false,
    terminalHeight: 200,
    activeView: "preview",
    explorerVisible: false,
    chatWidth: 320,
    chatPosition: "left",
  });
});

describe("UIStore", () => {
  it("should start with default layout values", () => {
    const state = useUIStore.getState();
    expect(state.sidebarWidth).toBe(240);
    expect(state.activeView).toBe("preview");
    expect(state.chatWidth).toBe(320);
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

  // ─── Layout Views ─────────────────────────────────────────

  it("should set active view explicitly", () => {
    useUIStore.getState().setActiveView("editor");
    expect(useUIStore.getState().activeView).toBe("editor");
    useUIStore.getState().setActiveView("preview");
    expect(useUIStore.getState().activeView).toBe("preview");
  });

  it("should toggle chat position", () => {
    expect(useUIStore.getState().chatPosition).toBe("left");
    useUIStore.getState().toggleChatPosition();
    expect(useUIStore.getState().chatPosition).toBe("right");
    useUIStore.getState().toggleChatPosition();
    expect(useUIStore.getState().chatPosition).toBe("left");
  });

  it("should set chat width within bounds", () => {
    useUIStore.getState().setChatWidth(400);
    expect(useUIStore.getState().chatWidth).toBe(400);
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
