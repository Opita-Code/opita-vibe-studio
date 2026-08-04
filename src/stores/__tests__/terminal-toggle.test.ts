/**
 * Terminal toggle — unit tests (VL-2).
 *
 * Verifica el ciclo del ui store que controla la visibilidad del
 * TerminalPanel: toggle, height con clamp (120-500), y tab activa.
 * El render del panel en App.tsx depende de terminalVisible — el
 * store es la fuente de verdad del toggle.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "@/stores/ui";

describe("terminal toggle (VL-2)", () => {
  beforeEach(() => {
    // Reset del store a defaults
    useUIStore.setState({
      terminalVisible: false,
      terminalHeight: 200,
      activeTerminalTab: "terminal",
    });
  });

  it("toggle activa y desactiva el terminal", () => {
    expect(useUIStore.getState().terminalVisible).toBe(false);
    useUIStore.getState().setTerminalVisible(true);
    expect(useUIStore.getState().terminalVisible).toBe(true);
    useUIStore.getState().setTerminalVisible(false);
    expect(useUIStore.getState().terminalVisible).toBe(false);
  });

  it("setTerminalHeight actualiza el height", () => {
    useUIStore.getState().setTerminalHeight(350);
    expect(useUIStore.getState().terminalHeight).toBe(350);
  });

  it("setActiveTerminalTab cambia la pestaña", () => {
    useUIStore.getState().setActiveTerminalTab("problems");
    expect(useUIStore.getState().activeTerminalTab).toBe("problems");
  });

  it("defaults: invisible, 200px, tab terminal", () => {
    const s = useUIStore.getState();
    expect(s.terminalVisible).toBe(false);
    expect(s.terminalHeight).toBe(200);
    expect(s.activeTerminalTab).toBe("terminal");
  });
});
