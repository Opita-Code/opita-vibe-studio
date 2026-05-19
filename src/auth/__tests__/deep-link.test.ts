import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────

const mockOnOpenUrl = vi.fn();
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  onOpenUrl: mockOnOpenUrl,
}));

const mockLogin = vi.fn();
const mockGetState = vi.fn(() => ({ login: mockLogin }));
vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: mockGetState },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Import after mocks ──────────────────────────────────────────

let initDeepLinkListener: () => Promise<void>;

beforeEach(async () => {
  vi.clearAllMocks();
  // Re-import to get fresh module
  const mod = await import("@/auth/deep-link");
  initDeepLinkListener = mod.initDeepLinkListener;
});

// ─── Tests ──────────────────────────────────────────────────────

describe("initDeepLinkListener", () => {
  it("registers a listener via onOpenUrl", async () => {
    mockOnOpenUrl.mockResolvedValue(undefined);
    await initDeepLinkListener();
    expect(mockOnOpenUrl).toHaveBeenCalledOnce();
  });

  it("calls /auth/me with Bearer token on valid deep link", async () => {
    let capturedCallback: ((urls: string[]) => Promise<void>) | undefined;
    mockOnOpenUrl.mockImplementation((cb) => {
      capturedCallback = cb;
      return Promise.resolve();
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email: "test@opitacode.com", plan: "free" },
      }),
    });

    await initDeepLinkListener();
    await capturedCallback!(["vibe-studio://auth?session_token=abc123"]);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer abc123",
        }),
      })
    );
  });

  it("calls login() on the auth store with correct user shape", async () => {
    let capturedCallback: ((urls: string[]) => Promise<void>) | undefined;
    mockOnOpenUrl.mockImplementation((cb) => {
      capturedCallback = cb;
      return Promise.resolve();
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { email: "test@opitacode.com", plan: "pro" },
      }),
    });

    await initDeepLinkListener();
    await capturedCallback!(["vibe-studio://auth?session_token=tok123"]);

    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@opitacode.com",
        plan: "pro",
        verified: true,
      }),
      expect.objectContaining({
        token: "tok123",
      })
    );
  });

  it("does NOT call login() when session_token is missing from URL", async () => {
    let capturedCallback: ((urls: string[]) => Promise<void>) | undefined;
    mockOnOpenUrl.mockImplementation((cb) => {
      capturedCallback = cb;
      return Promise.resolve();
    });

    await initDeepLinkListener();
    await capturedCallback!(["vibe-studio://auth"]);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("does NOT call login() when /auth/me returns non-ok", async () => {
    let capturedCallback: ((urls: string[]) => Promise<void>) | undefined;
    mockOnOpenUrl.mockImplementation((cb) => {
      capturedCallback = cb;
      return Promise.resolve();
    });

    mockFetch.mockResolvedValue({ ok: false });

    await initDeepLinkListener();
    await capturedCallback!(["vibe-studio://auth?session_token=badtoken"]);

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("does NOT crash when fetch throws", async () => {
    let capturedCallback: ((urls: string[]) => Promise<void>) | undefined;
    mockOnOpenUrl.mockImplementation((cb) => {
      capturedCallback = cb;
      return Promise.resolve();
    });

    mockFetch.mockRejectedValue(new Error("Network error"));

    await initDeepLinkListener();
    // Should not throw
    await expect(
      capturedCallback!(["vibe-studio://auth?session_token=tok"])
    ).resolves.not.toThrow();
  });
});
