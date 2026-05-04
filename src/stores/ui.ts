import { create } from "zustand";

// ─── State ─────────────────────────────────────────────────────

interface UIState {
  /** Ancho del panel lateral izquierdo en píxeles */
  sidebarWidth: number;
  /** Visibilidad del panel de chat */
  chatVisible: boolean;
  /** Mensaje de estado en la barra inferior */
  statusMessage: string;
  /** Nombre del modelo activo */
  activeModel: string;
  /** Nombre del proveedor conectado */
  connectedProvider: string;
  /** Tokens restantes en el plan actual */
  tokensRemaining: number;
  /** Altura del panel de preview (fracción del editor, 0-1) */
  previewRatio: number;
  /** Visibilidad del panel de vista previa */
  previewVisible: boolean;
}

// ─── Actions ───────────────────────────────────────────────────

interface UIActions {
  setSidebarWidth: (width: number) => void;
  toggleChat: () => void;
  setChatVisible: (visible: boolean) => void;
  setStatusMessage: (msg: string) => void;
  setActiveModel: (model: string) => void;
  setConnectedProvider: (provider: string) => void;
  setTokensRemaining: (tokens: number) => void;
  setPreviewRatio: (ratio: number) => void;
  togglePreview: () => void;
  setPreviewVisible: (visible: boolean) => void;
}

// ─── Store ─────────────────────────────────────────────────────

export type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  sidebarWidth: 240,
  chatVisible: true,
  statusMessage: "Listo",
  activeModel: "deepseek-chat",
  connectedProvider: "DeepSeek",
  tokensRemaining: 0,
  previewRatio: 0.35,
  previewVisible: true,

  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(400, width)) }),

  toggleChat: () => set((state) => ({ chatVisible: !state.chatVisible })),

  setChatVisible: (visible) => set({ chatVisible: visible }),

  setStatusMessage: (msg) => set({ statusMessage: msg }),

  setActiveModel: (model) => set({ activeModel: model }),

  setConnectedProvider: (provider) => set({ connectedProvider: provider }),

  setTokensRemaining: (tokens) => set({ tokensRemaining: tokens }),

  setPreviewRatio: (ratio) => set({ previewRatio: Math.max(0.15, Math.min(0.6, ratio)) }),

  togglePreview: () => set((state) => ({ previewVisible: !state.previewVisible })),

  setPreviewVisible: (visible) => set({ previewVisible: visible }),
}));
