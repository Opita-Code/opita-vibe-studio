import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PreviewDevice } from "@/components/preview/DeviceFrame";
import type { PersonaId } from "@/lib/types";

export type FileRefClickMode = "hold" | "click" | "disabled";

// ─── Types ─────────────────────────────────────────────────────

export type ActiveView = "preview" | "editor" | "split";
export type TerminalTab = "terminal" | "problems" | "console" | "git" | "logs";
export type ActiveSidebar = "explorer" | "chat" | "search" | null;

// ─── State ─────────────────────────────────────────────────────

interface UIState {
  /** Ancho del panel lateral izquierdo en píxeles */
  sidebarWidth: number;
  /** Mensaje de estado en la barra inferior */
  statusMessage: string;
  /** Nombre del modelo activo */
  activeModel: string;
  /** Nombre del proveedor conectado */
  connectedProvider: string;
  /** Tokens restantes en el plan actual */
  tokensRemaining: number;
  /** Visibilidad del panel de terminal */
  terminalVisible: boolean;
  /** Altura del panel de terminal en píxeles */
  terminalHeight: number;
  /** Pestaña activa en la terminal */
  activeTerminalTab: TerminalTab;
  /** Visibilidad del panel de configuración */
  settingsVisible: boolean;
  /** Visibilidad de la barra de acciones superior */
  actionBarVisible: boolean;
  // PR 2: Layout restructure fields
  /** Vista activa en el panel derecho: previsualización, editor, o dividido */
  activeView: ActiveView;
  /** Visibilidad del dock del explorador de archivos */
  explorerVisible: boolean;
  /** Ancho del panel de chat en píxeles */
  chatWidth: number;
  /** Posición del panel de chat: "left" (default) o "right" */
  chatPosition: "left" | "right";
  /** Indica si el chat ocupa toda la pantalla */
  chatFullscreen: boolean;
  /** Visibilidad del historial de chat */
  chatHistoryVisible: boolean;
  /** Componente objetivo para aislar en la vista previa (VibeLens) */
  previewTarget: string | null;
  /** Habilita o deshabilita la previsualización aislada de componentes (VibeLens) */
  vibeLensEnabled: boolean;
  /** Vista activa en el sidebar izquierdo (Activity Bar) */
  activeSidebar: ActiveSidebar;
  /** Visibilidad de la barra de actividad */
  activityBarVisible: boolean;
  /** Visibilidad del modal de reporte de bugs */
  bugReportVisible: boolean;
  /** Visibilidad del OmniBar inteligente */
  omnibarOpen: boolean;
  /** Query de búsqueda actual en el OmniBar */
  omnibarQuery: string;
  /** Dispositivo de previsualización activo (VibeLens) */
  previewDevice: PreviewDevice;
  /** Persona de comunicación activa de Aura */
  persona: PersonaId;
  /** Prompt personalizado para persona "custom" (max 500 chars) */
  customPersonaPrompt: string;
  /** Modo de activación de file refs en chat: hold (300ms), click directo, o deshabilitado */
  fileRefClickMode: FileRefClickMode;
}

// ─── Actions ───────────────────────────────────────────────────

interface UIActions {
  setSidebarWidth: (width: number) => void;
  setStatusMessage: (msg: string) => void;
  setActiveModel: (model: string) => void;
  setConnectedProvider: (provider: string) => void;
  setTokensRemaining: (tokens: number) => void;
  toggleTerminal: () => void;
  setTerminalVisible: (visible: boolean) => void;
  setTerminalHeight: (height: number) => void;
  setActiveTerminalTab: (tab: TerminalTab) => void;
  setSettingsVisible: (visible: boolean) => void;
  setActionBarVisible: (visible: boolean) => void;
  toggleActionBar: () => void;
  // PR 2: Layout actions
  setActiveView: (view: ActiveView) => void;
  setExplorerVisible: (visible: boolean) => void;
  setChatWidth: (width: number) => void;
  setChatPosition: (position: "left" | "right") => void;
  toggleChatPosition: () => void;
  setChatFullscreen: (full: boolean) => void;
  toggleChatFullscreen: () => void;
  toggleChatHistory: () => void;
  setPreviewTarget: (target: string | null) => void;
  setVibeLensEnabled: (enabled: boolean) => void;
  setActiveSidebar: (sidebar: ActiveSidebar) => void;
  setActivityBarVisible: (visible: boolean) => void;
  toggleActivityBar: () => void;
  setBugReportVisible: (visible: boolean) => void;
  setOmnibarOpen: (open: boolean) => void;
  setOmnibarQuery: (query: string) => void;
  setPreviewDevice: (device: PreviewDevice) => void;
  setPersona: (persona: PersonaId) => void;
  setCustomPersonaPrompt: (prompt: string) => void;
  setFileRefClickMode: (mode: FileRefClickMode) => void;
}

// ─── Clamp helpers ─────────────────────────────────────────────

const clampChatWidth = (w: number): number =>
  Math.max(280, Math.min(window.innerWidth * 0.5, w));


// ─── Store ─────────────────────────────────────────────────────

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
  sidebarWidth: 240,
  statusMessage: "Listo",
  activeModel: "",
  connectedProvider: "",
  tokensRemaining: 0,
  terminalVisible: false,
  terminalHeight: 200,
  activeTerminalTab: "terminal",
  settingsVisible: false,
  actionBarVisible: true,
  // PR 2: Layout defaults
  activeView: "preview",
  explorerVisible: false,
  chatWidth: 320,
  chatPosition: "right",
  chatFullscreen: false,
  chatHistoryVisible: false,
  previewTarget: null,
  vibeLensEnabled: true,
  activeSidebar: "chat",
  activityBarVisible: true,
  bugReportVisible: false,
  omnibarOpen: false,
  omnibarQuery: "",
  previewDevice: "desktop",
  persona: "creator",
  customPersonaPrompt: "",
  fileRefClickMode: "hold",

  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(400, width)) }),

  setStatusMessage: (msg) => set({ statusMessage: msg }),

  setActiveModel: (model) => set({ activeModel: model }),

  setConnectedProvider: (provider) => set({ connectedProvider: provider }),

  setTokensRemaining: (tokens) => set({ tokensRemaining: tokens }),

  toggleTerminal: () => set((state) => ({ terminalVisible: !state.terminalVisible })),

  setTerminalVisible: (visible) => set({ terminalVisible: visible }),

  setTerminalHeight: (height) =>
    set({ terminalHeight: Math.max(100, Math.min(500, height)) }),

  setActiveTerminalTab: (tab) => set({ activeTerminalTab: tab }),

  setSettingsVisible: (visible) => set({ settingsVisible: visible }),

  setActionBarVisible: (visible) => set({ actionBarVisible: visible }),

  toggleActionBar: () => set((state) => ({ actionBarVisible: !state.actionBarVisible })),

  // PR 2: Layout actions
  setActiveView: (view) => set(() => {
    if (view === "preview" || view === "split") {
      import("@/lib/vibe-events").then(({ vibeEvents }) => {
        vibeEvents.emit({ type: "preview_opened" });
      });
    }
    return { activeView: view };
  }),

  setExplorerVisible: (visible) => set({ explorerVisible: visible }),

  setChatWidth: (width) => set({ chatWidth: clampChatWidth(width) }),

  setChatPosition: (position) => set({ chatPosition: position }),

  toggleChatPosition: () =>
    set((state) => ({
      chatPosition: state.chatPosition === "left" ? "right" : "left",
    })),

  setChatFullscreen: (full) => set({ chatFullscreen: full }),
  toggleChatFullscreen: () => set((s) => ({ chatFullscreen: !s.chatFullscreen })),
  toggleChatHistory: () => set((s) => ({ chatHistoryVisible: !s.chatHistoryVisible })),

  setPreviewTarget: (target) => set({ previewTarget: target }),

  setVibeLensEnabled: (enabled) => 
    set((state) => ({
      vibeLensEnabled: enabled,
      previewTarget: enabled ? state.previewTarget : null
    })),

  setActiveSidebar: (sidebar) => set({ activeSidebar: sidebar }),
  setActivityBarVisible: (visible) => set({ activityBarVisible: visible }),
  toggleActivityBar: () => set((state) => ({ activityBarVisible: !state.activityBarVisible })),
  setBugReportVisible: (visible) => set({ bugReportVisible: visible }),
  setOmnibarOpen: (open) => set({ omnibarOpen: open }),
  setOmnibarQuery: (query) => set({ omnibarQuery: query }),
  setPreviewDevice: (device) => set({ previewDevice: device }),
  setPersona: (persona) => set({ persona }),
  setCustomPersonaPrompt: (prompt) => set({ customPersonaPrompt: prompt.slice(0, 500) }),
  setFileRefClickMode: (mode) => set({ fileRefClickMode: mode }),
}),
    {
      name: "vibe-studio-ui",
      partialize: (state) => ({
        chatWidth: state.chatWidth,
        chatPosition: state.chatPosition,
        chatFullscreen: state.chatFullscreen,
        activeView: state.activeView,
        explorerVisible: state.explorerVisible,
        terminalVisible: state.terminalVisible,
        activeTerminalTab: state.activeTerminalTab,
        actionBarVisible: state.actionBarVisible,
        vibeLensEnabled: state.vibeLensEnabled,
        activeSidebar: state.activeSidebar,
        activityBarVisible: state.activityBarVisible,
        previewDevice: state.previewDevice,
        persona: state.persona,
        customPersonaPrompt: state.customPersonaPrompt,
        fileRefClickMode: state.fileRefClickMode,
      }),
    },
  ),
);
