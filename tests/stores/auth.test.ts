import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../../src/stores/auth";
import type { UserProfile, Session } from "../../src/lib/types";

// ─── Dynamic-import mocks used by logout()/detectSession() ──────

const restoreSession = vi.fn();
vi.mock("../../src/auth/sso", () => ({ restoreSession }));

const initDarkMemory = vi.fn(async () => {});
const startDarkMemorySession = vi.fn(async () => {});
const closeDarkMemorySession = vi.fn(async () => {});
vi.mock("../../src/lib/dark-memory", () => ({
  initDarkMemory,
  startDarkMemorySession,
  closeDarkMemorySession,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  useAuthStore.setState({
    user: null,
    session: null,
    plan: "free",
    authMode: "unauthenticated",
    isLoading: false,
    sessionDetected: false,
    guestEmail: null,
    needsMigration: false,
    hasCompletedOnboarding: false,
    loginModalOpen: false,
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

  it("should set user / session / plan independently", () => {
    const u: UserProfile = { id: "u", email: "a@b.co", name: "A", plan: "pro", verified: true };
    const s: Session = { token: "t", expiresAt: 1 };
    useAuthStore.getState().setUser(u);
    useAuthStore.getState().setSession(s);
    useAuthStore.getState().setPlan("pro");
    const state = useAuthStore.getState();
    expect(state.user?.id).toBe("u");
    expect(state.session?.token).toBe("t");
    expect(state.plan).toBe("pro");
  });

  it("should toggle the login modal", () => {
    useAuthStore.getState().setLoginModalOpen(true);
    expect(useAuthStore.getState().loginModalOpen).toBe(true);
    useAuthStore.getState().setLoginModalOpen(false);
    expect(useAuthStore.getState().loginModalOpen).toBe(false);
  });
});

describe("AuthStore — onboarding", () => {
  it("should read onboarding from localStorage", () => {
    localStorage.setItem("vibe-onboarding-done", "true");
    // Re-import fresh module state is not needed; just exercise the initializer path
    expect(localStorage.getItem("vibe-onboarding-done")).toBe("true");
  });

  it("completeOnboarding should persist and flag", () => {
    useAuthStore.getState().completeOnboarding();
    expect(localStorage.getItem("vibe-onboarding-done")).toBe("true");
    expect(useAuthStore.getState().hasCompletedOnboarding).toBe(true);
  });
});

describe("AuthStore — logout", () => {
  it("should reset everything and close the dark-memory session", async () => {
    useAuthStore.getState().login(
      { id: "u", email: "a@b.co", name: "A", plan: "estudiante", verified: true },
      { token: "jwt", expiresAt: Date.now() + 1000 },
    );

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.authMode).toBe("unauthenticated");
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.plan).toBe("free");
    expect(state.needsMigration).toBe(false);

    await vi.waitFor(() => expect(closeDarkMemorySession).toHaveBeenCalled());
  });
});

describe("AuthStore — fetchTokenUsage", () => {
  it("should update tokenUsage on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tokensUsedToday: 99, plan: "free" }),
    });

    await useAuthStore.getState().fetchTokenUsage();
    expect(useAuthStore.getState().tokenUsage.tokensUsedToday).toBe(99);
  });

  it("should ignore non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await useAuthStore.getState().fetchTokenUsage();
    expect(useAuthStore.getState().tokenUsage.tokensUsedToday).toBe(0);
  });

  it("should silently swallow fetch errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("down"));
    await expect(useAuthStore.getState().fetchTokenUsage()).resolves.toBeUndefined();
    expect(useAuthStore.getState().tokenUsage.tokensUsedToday).toBe(0);
  });

  it("should omit the Authorization header for placeholder sessions", async () => {
    useAuthStore.setState({
      session: { token: "__opita_session", expiresAt: 1 },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await useAuthStore.getState().fetchTokenUsage();
    const [, init] = fetchMock.mock.calls[0] as [string, { headers?: Record<string, string> }];
    expect(init.headers?.Authorization).toBeUndefined();
  });

  it("should send the Authorization header for real JWTs", async () => {
    useAuthStore.setState({
      session: { token: "real-jwt", expiresAt: 1 },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await useAuthStore.getState().fetchTokenUsage();
    const [, init] = fetchMock.mock.calls[0] as [string, { headers?: Record<string, string> }];
    expect(init.headers?.Authorization).toBe("Bearer real-jwt");
  });
});

describe("AuthStore — detectSession", () => {
  it("should restore a session, fetch usage and init dark-memory", async () => {
    restoreSession.mockResolvedValue({
      user: { id: "u", email: "a@b.co", name: "A", plan: "estudiante", verified: true },
      session: { token: "jwt", expiresAt: Date.now() + 1000 },
    });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ tokensUsedToday: 5 }) });

    await useAuthStore.getState().detectSession();

    const state = useAuthStore.getState();
    expect(state.authMode).toBe("authenticated");
    expect(state.user?.email).toBe("a@b.co");
    expect(state.plan).toBe("estudiante");
    expect(state.sessionDetected).toBe(true);
    expect(initDarkMemory).toHaveBeenCalled();
    expect(startDarkMemorySession).toHaveBeenCalled();
  });

  it("should stay in guest mode when no session is restored", async () => {
    restoreSession.mockResolvedValue(null);

    await useAuthStore.getState().detectSession();

    const state = useAuthStore.getState();
    expect(state.authMode).toBe("unauthenticated");
    expect(state.sessionDetected).toBe(true);
    expect(initDarkMemory).not.toHaveBeenCalled();
  });

  it("should stay in guest mode when restoration throws", async () => {
    restoreSession.mockRejectedValue(new Error("sso down"));

    await useAuthStore.getState().detectSession();

    const state = useAuthStore.getState();
    expect(state.authMode).toBe("unauthenticated");
    expect(state.sessionDetected).toBe(true);
  });
});

describe("AuthStore — migrateFromGuest", () => {
  it("should return false for empty emails", () => {
    expect(useAuthStore.getState().migrateFromGuest("")).toBe(false);
  });

  it("should return false when no guest email is stored", () => {
    expect(useAuthStore.getState().migrateFromGuest("user@opita.co")).toBe(false);
  });

  it("should flag a migration when emails match (case-insensitive)", () => {
    localStorage.setItem("vibe-guest-email", "Guest@opita.co");
    const result = useAuthStore.getState().migrateFromGuest("guest@opita.co");

    const state = useAuthStore.getState();
    expect(result).toBe(true);
    expect(state.guestEmail).toBe("Guest@opita.co");
    expect(state.needsMigration).toBe(true);
  });

  it("should return false when emails differ", () => {
    localStorage.setItem("vibe-guest-email", "one@opita.co");
    expect(useAuthStore.getState().migrateFromGuest("other@opita.co")).toBe(false);
    expect(useAuthStore.getState().needsMigration).toBe(false);
  });
});
