import { describe, it, expect, beforeEach, vi } from "vitest";
import { initiateSSO, restoreSession, logout } from "../../src/auth/sso";
import { useAuthStore } from "../../src/stores/auth";

// ─── Mock fetch ─────────────────────────────────────────────────
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

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
  localStorage.clear();
  mockFetch.mockReset();
  // Clear cookies
  document.cookie.split(";").forEach(c => {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT");
  });
});

describe("initiateSSO", () => {
  it("should throw for empty email", async () => {
    // initiateSSO() with no args now throws "Email inválido"
    await expect(initiateSSO()).rejects.toThrow("Email inválido");
  });

  it("should throw for invalid email", async () => {
    await expect(initiateSSO("invalid")).rejects.toThrow("Email inválido");
  });

  it("should call API for valid email", async () => {
    mockFetch.mockResolvedValue({ ok: true });

    await initiateSSO("student@unal.edu.co", {
      postAuthUrl: "/app",
      service: "vibe-studio",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/auth/request");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.email).toBe("student@unal.edu.co");
    expect(body.service).toBe("vibe-studio");
  });

  it("should throw when API returns error", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(
      initiateSSO("test@opita.co"),
    ).rejects.toThrow("No se pudo solicitar el enlace mágico");
  });
});

describe("restoreSession", () => {
  it("should return null when no cookie exists", async () => {
    const result = await restoreSession();
    expect(result).toBeNull();
  });

  // NOTE: Full cookie-based restore tests require a valid JWT in the cookie,
  // which is complex to mock in jsdom. The core logic is verified by
  // integration/E2E tests.
});

describe("logout", () => {
  it("should call logout endpoint and reset auth store", async () => {
    // Set up authenticated state
    useAuthStore.setState({
      authMode: "authenticated",
      user: { id: "u1", email: "t@t.com", name: "T", plan: "free", verified: false },
      session: { token: "t", expiresAt: Date.now() + 3600000 },
    });

    mockFetch.mockResolvedValue({ ok: true });

    await logout();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().authMode).toBe("unauthenticated");
    expect(useAuthStore.getState().user).toBeNull();
  });
});
