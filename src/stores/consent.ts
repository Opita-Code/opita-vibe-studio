import { create } from "zustand";

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = "vibe-consent";

// ─── State ─────────────────────────────────────────────────────

interface ConsentState {
  /** Basic context (language, theme, skill level) — always captured */
  basicConsent: boolean;
  /** Rich context (learning events, project names, analytics) — requires opt-in */
  richConsent: boolean;
  /** Whether the user has requested a data export */
  dataExportRequested: boolean;
  /** Whether the user has requested data deletion */
  dataDeletionRequested: boolean;
  /** Whether the user is in the deletion confirmation step */
  deletionConfirmStep: boolean;
}

// ─── Actions ───────────────────────────────────────────────────

interface ConsentActions {
  toggleRichConsent: () => void;
  requestDataExport: () => void;
  resetExportRequest: () => void;
  requestDataDeletion: () => void;
  cancelDataDeletion: () => void;
  confirmDataDeletion: () => void;
  /**
   * Load stored consent from localStorage.
   * @returns true if data was found and restored
   */
  loadFromStorage: () => boolean;
}

// ─── Persistence helpers ───────────────────────────────────────

function persistState(state: Partial<ConsentState>): void {
  try {
    const existing = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    })();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...existing, ...state, timestamp: Date.now() }),
    );
  } catch {
    // localStorage unavailable — silently continue
  }
}

function loadState(): Partial<ConsentState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      richConsent: parsed.richConsent === true,
    };
  } catch {
    return null;
  }
}

// ─── Store ─────────────────────────────────────────────────────

export type ConsentStore = ConsentState & ConsentActions;

export const useConsentStore = create<ConsentStore>((set, get) => ({
  basicConsent: true,
  richConsent: false,
  dataExportRequested: false,
  dataDeletionRequested: false,
  deletionConfirmStep: false,

  toggleRichConsent: () => {
    const next = !get().richConsent;
    set({ richConsent: next });
    persistState({ richConsent: next });
  },

  requestDataExport: () => set({ dataExportRequested: true }),

  resetExportRequest: () => set({ dataExportRequested: false }),

  requestDataDeletion: () =>
    set({ dataDeletionRequested: true, deletionConfirmStep: true }),

  cancelDataDeletion: () =>
    set({ dataDeletionRequested: false, deletionConfirmStep: false }),

  confirmDataDeletion: () =>
    set({ deletionConfirmStep: false }),

  loadFromStorage: () => {
    const stored = loadState();
    if (!stored) return false;
    if (stored.richConsent !== undefined) {
      set({ richConsent: stored.richConsent });
    }
    return true;
  },
}));
