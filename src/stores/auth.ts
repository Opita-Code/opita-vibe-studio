import { create } from "zustand";
import type { UserProfile, Session, TokenUsage, UserPlan } from "@/lib/types";
import { CORE_API_URL } from "@/lib/api-config";
import { isSessionPlaceholder } from "@/lib/auth-fetch";

// ─── Types ─────────────────────────────────────────────────────

export type AuthMode = "unauthenticated" | "authenticated";

// ─── State ─────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  plan: UserPlan;
  tokenUsage: TokenUsage;
  authMode: AuthMode;
  sessionDetected: boolean;
  isLoading: boolean;
  /** Stored guest email for migration detection */
  guestEmail: string | null;
  /** Whether a pending migration from guest to cloud exists */
  needsMigration: boolean;
  hasCompletedOnboarding: boolean;
  loginModalOpen: boolean;
}

// ─── Actions ───────────────────────────────────────────────────

interface AuthActions {
  setUser: (user: UserProfile | null) => void;
  setSession: (session: Session | null) => void;
  setPlan: (plan: UserPlan) => void;
  setTokenUsage: (usage: TokenUsage) => void;
  setLoading: (loading: boolean) => void;
  login: (user: UserProfile, session: Session) => void;
  logout: () => void;
  fetchTokenUsage: () => Promise<void>;
  detectSession: () => Promise<void>;
  /**
   * Checks if the OAuth user's email matches the guest's stored email.
   * If so, sets needsMigration = true so the sync engine (PR 4) can
   * migrate local guest data to the cloud.
   *
   * @param email - The authenticated user's email from OAuth
   * @returns true if migration is needed, false otherwise
   */
  migrateFromGuest: (email: string) => boolean;
  completeOnboarding: () => void;
  setLoginModalOpen: (open: boolean) => void;
}

// ─── Defaults ──────────────────────────────────────────────────

const defaultTokenUsage: TokenUsage = {
  tokensUsedToday: 0,
  tokensLimitDaily: 150_000,
  tokensUsedThisHour: 0,
  tokensLimitHourly: 30_000,
  plan: "free",
  resetDailyAt: new Date().toISOString(),
  resetHourlyAt: new Date().toISOString(),
};

// ─── Store ─────────────────────────────────────────────────────

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  plan: "free",
  tokenUsage: defaultTokenUsage,
  authMode: "unauthenticated",
  sessionDetected: false,
  isLoading: false,
  guestEmail: null,
  needsMigration: false,
  hasCompletedOnboarding: (() => { try { return localStorage.getItem("vibe-onboarding-done") === "true"; } catch { return false; } })(),
  loginModalOpen: false,

  setLoginModalOpen: (open) => set({ loginModalOpen: open }),

  setUser: (user) => set({ user }),

  setSession: (session) => set({ session }),

  setPlan: (plan) => set({ plan }),

  setTokenUsage: (usage) => set({ tokenUsage: usage }),

  setLoading: (loading) => set({ isLoading: loading }),

  completeOnboarding: () => {
    localStorage.setItem("vibe-onboarding-done", "true");
    set({ hasCompletedOnboarding: true });
  },

  login: (user, session) =>
    set({
      user,
      session,
      plan: user.plan,
      authMode: "authenticated",
      isLoading: false,
    }),

  logout: () => {
    // Cerrar sesión de dark-memory (fire-and-forget, degradación elegante).
    void import("@/lib/dark-memory").then(({ closeDarkMemorySession }) =>
      closeDarkMemorySession(),
    );
    set({
      user: null,
      session: null,
      plan: "free",
      authMode: "unauthenticated",
      tokenUsage: defaultTokenUsage,
      guestEmail: null,
      needsMigration: false,
    });
  },

  fetchTokenUsage: async () => {
    try {
      const token = useAuthStore.getState().session?.token;
      const API_URL = CORE_API_URL;
      const response = await fetch(API_URL + "/usage", {
        credentials: "include",
        headers: {
          ...(!isSessionPlaceholder(token) ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        set({ tokenUsage: data });
      }
    } catch {
      // Silently fail — usage display is non-critical
    }
  },

  detectSession: async () => {
    const { restoreSession } = await import("@/auth/sso");
    try {
      const result = await restoreSession();
      if (result) {
        set({
          user: result.user,
          session: result.session,
          plan: result.user.plan,
          authMode: "authenticated",
        });
        // Fetch token usage after successful session restoration
        const store = useAuthStore.getState();
        store.fetchTokenUsage();
        // Init dark-memory bridge + sesión (post-login; degradación
        // elegante si dark-memory no está disponible).
        const { initDarkMemory, startDarkMemorySession } = await import("@/lib/dark-memory");
        await initDarkMemory();
        await startDarkMemorySession();
      }
    } catch {
      // No session or error — stay in guest mode (already default)
    } finally {
      set({ sessionDetected: true });
    }
  },

  migrateFromGuest: (email: string): boolean => {
    if (!email) return false;

    // Read the guest email that was stored during guest mode usage
    const storedGuestEmail = (() => {
      try {
        return localStorage.getItem("vibe-guest-email");
      } catch {
        return null;
      }
    })();

    if (!storedGuestEmail) return false;

    const emailMatch =
      storedGuestEmail.toLowerCase() === email.toLowerCase();

    if (emailMatch) {
      set({
        guestEmail: storedGuestEmail,
        needsMigration: true,
      });
      return true;
    }

    return false;
  },
}));
