import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, fireEvent } from "@testing-library/react";
import { useKeybindings } from "@/lib/useKeybindings";
import { useChatStore } from "@/stores/chat";
import { useUIStore } from "@/stores/ui";

const { setLocation } = vi.hoisted(() => ({ setLocation: vi.fn() }));
vi.mock("wouter", () => ({
  useLocation: () => ["/", setLocation],
}));

function resetStores() {
  useChatStore.setState({
    sessions: {
      default: { id: "default", title: "Test", messages: [], updatedAt: Date.now() },
    },
    activeSessionId: "default",
  });
  useUIStore.setState({
    terminalVisible: false,
    settingsVisible: false,
    explorerVisible: false,
    actionBarVisible: true,
    chatFullscreen: false,
    activeView: "preview",
  });
}

beforeEach(() => {
  resetStores();
  setLocation.mockClear();
});

afterEach(() => {
  // renderHook cleanup removes the window listener
});

describe("useKeybindings", () => {
  it("should register and clean up the window listener", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useKeybindings());
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("Ctrl+N should create a new chat and navigate", () => {
    renderHook(() => useKeybindings());
    const before = Object.keys(useChatStore.getState().sessions).length;

    fireEvent.keyDown(window, { key: "n", ctrlKey: true });

    expect(Object.keys(useChatStore.getState().sessions)).toHaveLength(before + 1);
    expect(setLocation).toHaveBeenCalledWith("/chat");
  });

  it("Ctrl+J should toggle the terminal", () => {
    renderHook(() => useKeybindings());
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(useUIStore.getState().terminalVisible).toBe(true);
    fireEvent.keyDown(window, { key: "j", ctrlKey: true });
    expect(useUIStore.getState().terminalVisible).toBe(false);
  });

  it("Ctrl+H should toggle the action bar", () => {
    renderHook(() => useKeybindings());
    expect(useUIStore.getState().actionBarVisible).toBe(true);
    fireEvent.keyDown(window, { key: "h", ctrlKey: true });
    expect(useUIStore.getState().actionBarVisible).toBe(false);
  });

  it("Ctrl+L should toggle chat fullscreen", () => {
    renderHook(() => useKeybindings());
    fireEvent.keyDown(window, { key: "l", ctrlKey: true });
    expect(useUIStore.getState().chatFullscreen).toBe(true);
  });

  it("Ctrl+1 and Ctrl+2 should switch views", () => {
    renderHook(() => useKeybindings());
    fireEvent.keyDown(window, { key: "2", ctrlKey: true });
    expect(useUIStore.getState().activeView).toBe("editor");
    fireEvent.keyDown(window, { key: "1", ctrlKey: true });
    expect(useUIStore.getState().activeView).toBe("preview");
  });

  it("Ctrl+B should toggle the explorer", () => {
    renderHook(() => useKeybindings());
    expect(useUIStore.getState().explorerVisible).toBe(false);
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(useUIStore.getState().explorerVisible).toBe(true);
    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(useUIStore.getState().explorerVisible).toBe(false);
  });

  it("Ctrl+, should toggle settings", () => {
    renderHook(() => useKeybindings());
    expect(useUIStore.getState().settingsVisible).toBe(false);
    fireEvent.keyDown(window, { key: ",", ctrlKey: true });
    expect(useUIStore.getState().settingsVisible).toBe(true);
  });

  it("should ignore keydowns inside inputs and textareas", () => {
    renderHook(() => useKeybindings());
    const input = document.createElement("input");
    const before = Object.keys(useChatStore.getState().sessions).length;

    fireEvent.keyDown(input, { key: "n", ctrlKey: true });
    expect(Object.keys(useChatStore.getState().sessions)).toHaveLength(before);
  });

  it("should ignore keydowns on editable elements", () => {
    renderHook(() => useKeybindings());
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    const before = Object.keys(useChatStore.getState().sessions).length;

    fireEvent.keyDown(editable, { key: "n", ctrlKey: true });
    expect(Object.keys(useChatStore.getState().sessions)).toHaveLength(before);
  });

  it("should ignore keydowns without Ctrl", () => {
    renderHook(() => useKeybindings());
    const before = Object.keys(useChatStore.getState().sessions).length;

    fireEvent.keyDown(window, { key: "n", ctrlKey: false });
    expect(Object.keys(useChatStore.getState().sessions)).toHaveLength(before);
  });

  it("should ignore unknown keys", () => {
    renderHook(() => useKeybindings());
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(useUIStore.getState().terminalVisible).toBe(false);
    expect(useUIStore.getState().activeView).toBe("preview");
  });
});
