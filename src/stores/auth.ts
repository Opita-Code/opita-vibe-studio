import { create } from "zustand";
import type { UserProfile, Session, TokenUsage, UserPlan } from "@/lib/types";

// ─── State ─────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  plan: UserPlan;
  tokenUsage: TokenUsage;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  incrementPromptsUsed: () => void;
}

// ─── Defaults ──────────────────────────────────────────────────

const defaultTokenUsage: TokenUsage = {
  promptsUsed: 0,
  promptsLimit: 30,
  billingPeriodStart: new Date().toISOString(),
  billingPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// ─── Store ─────────────────────────────────────────────────────

export type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  plan: "free",
  tokenUsage: defaultTokenUsage,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user) => set({ user, isAuthenticated: user !== null }),

  setSession: (session) => set({ session }),

  setPlan: (plan) => set({ plan }),

  setTokenUsage: (usage) => set({ tokenUsage: usage }),

  setLoading: (loading) => set({ isLoading: loading }),

  login: (user, session) =>
    set({
      user,
      session,
      plan: user.plan,
      isAuthenticated: true,
      isLoading: false,
    }),

  logout: () =>
    set({
      user: null,
      session: null,
      plan: "free",
      isAuthenticated: false,
      tokenUsage: defaultTokenUsage,
    }),

  incrementPromptsUsed: () =>
    set((state) => ({
      tokenUsage: {
        ...state.tokenUsage,
        promptsUsed: state.tokenUsage.promptsUsed + 1,
      },
    })),
}));
