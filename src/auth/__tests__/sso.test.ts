import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Helpers ────────────────────────────────────────────────────

function setTauriEnv(present: boolean) {
  if (present) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      writable: true,
      configurable: true,
    });
  } else {
    // Remove the property if it exists
    try {
      // @ts-expect-error intentional delete
      delete window.__TAURI_INTERNALS__;
    } catch {
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

// ─── Tests ──────────────────────────────────────────────────────

describe("initiateSSO — Tauri environment detection", () => {
  it("sends redirectTo: 'vibe-studio://auth' when running inside Tauri", async () => {
    setTauriEnv(true);

    const { initiateSSO } = await import("@/auth/sso");
    await initiateSSO("user@opitacode.com");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.redirectTo).toBe("vibe-studio://auth");
  });

  it("sends web postAuthUrl when NOT running inside Tauri", async () => {
    setTauriEnv(false);

    const { initiateSSO } = await import("@/auth/sso");
    await initiateSSO("user@opitacode.com", { postAuthUrl: "https://vibe.opitacode.com/app" });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.redirectTo).not.toBe("vibe-studio://auth");
    expect(body.redirectTo).toContain("/app");
  });

  it("includes service in the request body", async () => {
    setTauriEnv(false);

    const { initiateSSO } = await import("@/auth/sso");
    await initiateSSO("user@opitacode.com", { service: "vibe-studio" });

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.service).toBe("vibe-studio");
  });

  it("throws when email is invalid", async () => {
    setTauriEnv(false);
    const { initiateSSO } = await import("@/auth/sso");
    await expect(initiateSSO("notanemail")).rejects.toThrow();
  });
});
