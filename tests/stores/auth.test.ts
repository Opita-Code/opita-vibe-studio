import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../../src/stores/auth";
import type { UserProfile, Session } from "../../src/lib/types";

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    isAuthenticated: false,
    isLoading: false,
    tokenUsage: {
      promptsUsed: 0,
      promptsLimit: 30,
      billingPeriodStart: expect.any(String) as unknown as string,
      billingPeriodEnd: expect.any(String) as unknown as string,
    },
  });
});

describe("AuthStore", () => {
  const user: UserProfile = {
    id: "user-1",
    email: "test@opita.co",
    name: "Test User",
    plan: "estudiante",
    verified: true,
  };

  const session: Session = {
    token: "jwt-token",
    expiresAt: Date.now() + 3600000,
  };

  it("should start unauthenticated", () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("should login and set user + session", () => {
    useAuthStore.getState().login(user, session);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.name).toBe("Test User");
    expect(state.session?.token).toBe("jwt-token");
    expect(state.plan).toBe("estudiante");
  });

  it("should logout and reset state", () => {
    useAuthStore.getState().login(user, session);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.plan).toBe("free");
  });

  it("should increment prompts used", () => {
    expect(useAuthStore.getState().tokenUsage.promptsUsed).toBe(0);
    useAuthStore.getState().incrementPromptsUsed();
    expect(useAuthStore.getState().tokenUsage.promptsUsed).toBe(1);
  });

  it("should set loading state", () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });
});
