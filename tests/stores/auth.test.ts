import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../../src/stores/auth";
import type { UserProfile, Session } from "../../src/lib/types";

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "unauthenticated",
    isLoading: false,
    tokenUsage: {
      tokensUsedToday: 0,
      tokensLimitDaily: 150_000,
      tokensUsedThisHour: 0,
      tokensLimitHourly: 30_000,
      plan: "free",
      resetDailyAt: new Date().toISOString(),
      resetHourlyAt: new Date().toISOString(),
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
    expect(useAuthStore.getState().authMode).toBe("unauthenticated");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("should login and set user + session", () => {
    useAuthStore.getState().login(user, session);
    const state = useAuthStore.getState();
    expect(state.authMode).toBe("authenticated");
    expect(state.user?.name).toBe("Test User");
    expect(state.session?.token).toBe("jwt-token");
    expect(state.plan).toBe("estudiante");
  });

  it("should logout and reset state", () => {
    useAuthStore.getState().login(user, session);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.authMode).toBe("unauthenticated");
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.plan).toBe("free");
  });

  it("should update token usage via setTokenUsage", () => {
    const newUsage = {
      tokensUsedToday: 50_000,
      tokensLimitDaily: 250_000,
      tokensUsedThisHour: 10_000,
      tokensLimitHourly: 60_000,
      plan: "estudiante" as const,
      resetDailyAt: new Date().toISOString(),
      resetHourlyAt: new Date().toISOString(),
    };
    useAuthStore.getState().setTokenUsage(newUsage);
    expect(useAuthStore.getState().tokenUsage.tokensUsedToday).toBe(50_000);
    expect(useAuthStore.getState().tokenUsage.tokensLimitDaily).toBe(250_000);
  });

  it("should set loading state", () => {
    useAuthStore.getState().setLoading(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });
});
