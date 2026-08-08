import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as chatgptAuth from "../../src/lib/chatgpt-auth";
import type { DeviceCodePending } from "../../src/lib/chatgpt-auth";

// ─── Module mocks ────────────────────────────────────────────────

const emitMock = vi.fn(async () => {});
const openMock = vi.fn(async () => {});
const listenMock = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  emit: emitMock,
  listen: listenMock,
}));
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: openMock,
}));

const getProviderKeyMock = vi.fn();
const saveProviderKeyMock = vi.fn();
vi.mock("../../src/lib/byok-store", () => ({
  getProviderKey: getProviderKeyMock,
  saveProviderKey: saveProviderKeyMock,
}));

const registerProviderMock = vi.fn();
vi.mock("../../src/providers/registry", () => ({
  registerProvider: registerProviderMock,
}));

const createChatGPTWebProviderMock = vi.fn(() => ({ id: "chatgpt-web" }));
vi.mock("../../src/providers/chatgpt-web", () => ({
  createChatGPTWebProvider: createChatGPTWebProviderMock,
}));

const tauriHttpFetchMock = vi.fn();
vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: tauriHttpFetchMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Deterministic PKCE helpers (avoid real crypto in jsdom)
const digestMock = vi.fn();
vi.stubGlobal("crypto", {
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = 1;
    return arr;
  },
  subtle: {
    digest: digestMock,
  },
});

function okJson(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload, text: async () => "" };
}

function errJson(payload: unknown, status = 400) {
  return { ok: false, status, json: async () => payload, text: async () => "bad" };
}

const pending: DeviceCodePending = {
  deviceCode: "dev-1",
  userCode: "USER-1",
  verificationUri: "https://auth.openai.com/codex/device",
  expiresIn: 60,
  interval: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  digestMock.mockResolvedValue(new Uint8Array(32).buffer);
  delete (window as unknown as Record<string, unknown>).__TAURI__;
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI__;
});

// ─── requestDeviceCode ───────────────────────────────────────────

describe("requestDeviceCode", () => {
  it("should return a DeviceCodePending with provider defaults", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ device_code: "dc", user_code: "UC" }),
    );

    const result = await chatgptAuth.requestDeviceCode();

    expect(result).toEqual({
      deviceCode: "dc",
      userCode: "UC",
      verificationUri: "https://auth.openai.com/codex/device",
      expiresIn: 600,
      interval: 5,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.openai.com/oauth/device/code",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should include explicit verificationUri/expiresIn/interval from the API", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({
        device_code: "dc",
        user_code: "UC",
        verification_uri: "https://custom/verify",
        expires_in: 120,
        interval: 3,
      }),
    );

    const result = await chatgptAuth.requestDeviceCode();
    expect(result.verificationUri).toBe("https://custom/verify");
    expect(result.expiresIn).toBe(120);
    expect(result.interval).toBe(3);
  });

  it("should throw on non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce(errJson({}, 500));
    await expect(chatgptAuth.requestDeviceCode()).rejects.toThrow(
      /Device code request failed/,
    );
  });
});

// ─── pollForDeviceToken ──────────────────────────────────────────

describe("pollForDeviceToken", () => {
  it("should return tokens when the user completes auth", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
    );

    const tokens = await chatgptAuth.pollForDeviceToken(pending);
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.expiresAt).toBeDefined();
  });

  it("should keep polling while authorization is pending", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ error: "authorization_pending" }))
      .mockResolvedValueOnce(okJson({ error: "authorization_pending" }))
      .mockResolvedValueOnce(okJson({ access_token: "at2" }));

    const tokens = await chatgptAuth.pollForDeviceToken(pending);
    expect(tokens.accessToken).toBe("at2");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("should increase the interval on slow_down", async () => {
    vi.useFakeTimers();
    try {
      fetchMock
        .mockResolvedValueOnce(okJson({ error: "slow_down" }))
        .mockResolvedValueOnce(okJson({ access_token: "at3" }));

      const promise = chatgptAuth.pollForDeviceToken(pending);
      // First iteration: 0ms wait + slow_down (interval grows by 5000)
      await vi.advanceTimersByTimeAsync(0);
      // Second iteration: 5000ms wait
      await vi.advanceTimersByTimeAsync(5000);
      const tokens = await promise;
      expect(tokens.accessToken).toBe("at3");
    } finally {
      vi.useRealTimers();
    }
  });

  it("should throw on fatal errors", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ error: "expired_token", error_description: "Token vencido" }),
    );
    await expect(chatgptAuth.pollForDeviceToken(pending)).rejects.toThrow(
      "Token vencido",
    );
  });

  it("should throw when the signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      chatgptAuth.pollForDeviceToken(pending, controller.signal),
    ).rejects.toThrow(/cancelada/);
  });

  it("should throw when the device code expires", async () => {
    await expect(
      chatgptAuth.pollForDeviceToken({ ...pending, expiresIn: 0 }),
    ).rejects.toThrow(/expiró/);
  });
});

// ─── refreshAccessToken ──────────────────────────────────────────

describe("refreshAccessToken", () => {
  it("should refresh and return new tokens", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ access_token: "new-at", refresh_token: "rotated-rt", expires_in: 7200 }),
    );

    const tokens = await chatgptAuth.refreshAccessToken("old-rt");
    expect(tokens.accessToken).toBe("new-at");
    expect(tokens.refreshToken).toBe("rotated-rt");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.openai.com/oauth/token",
      expect.objectContaining({
        body: expect.stringContaining('"grant_type":"refresh_token"'),
      }),
    );
  });

  it("should keep the original refresh token when none is rotated", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ access_token: "new-at" }));
    const tokens = await chatgptAuth.refreshAccessToken("keep-me");
    expect(tokens.refreshToken).toBe("keep-me");
  });

  it("should throw when no access_token is returned", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ error: "invalid_grant" }));
    await expect(chatgptAuth.refreshAccessToken("bad")).rejects.toThrow(
      /No se pudo renovar/,
    );
  });
});

// ─── getValidToken ───────────────────────────────────────────────

describe("getValidToken", () => {
  it("should throw when no token is stored", async () => {
    getProviderKeyMock.mockResolvedValueOnce(null);
    await expect(chatgptAuth.getValidToken()).rejects.toThrow(/Conecta tu cuenta/);
  });

  it("should return the key directly for legacy entries without expiry", async () => {
    getProviderKeyMock.mockResolvedValueOnce({ key: "legacy-key" });
    await expect(chatgptAuth.getValidToken()).resolves.toBe("legacy-key");
  });

  it("should return the key when it is not close to expiry", async () => {
    getProviderKeyMock.mockResolvedValueOnce({
      key: "still-valid",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    await expect(chatgptAuth.getValidToken()).resolves.toBe("still-valid");
  });

  it("should throw when the token is expired and has no refresh token", async () => {
    getProviderKeyMock.mockResolvedValueOnce({
      key: "expired",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await expect(chatgptAuth.getValidToken()).rejects.toThrow(
      /sin refresh_token/,
    );
  });

  it("should refresh, persist and register the provider when expired", async () => {
    getProviderKeyMock.mockResolvedValueOnce({
      key: "expired",
      refreshToken: "rt",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    fetchMock.mockResolvedValueOnce(
      okJson({ access_token: "fresh-at", refresh_token: "fresh-rt", expires_in: 3600 }),
    );

    const token = await chatgptAuth.getValidToken();

    expect(token).toBe("fresh-at");
    expect(saveProviderKeyMock).toHaveBeenCalledWith(
      "chatgpt-web",
      "fresh-at",
      undefined,
      expect.objectContaining({ refreshToken: "fresh-rt" }),
    );
    expect(registerProviderMock).toHaveBeenCalledWith({ id: "chatgpt-web" });
    expect(createChatGPTWebProviderMock).toHaveBeenCalledWith("fresh-at");
  });
});

// ─── startPKCEFlow ───────────────────────────────────────────────

/** Flushes macrotasks until `predicate` returns truthy. */
async function waitFor<T>(predicate: () => T | undefined | null, max = 100): Promise<T> {
  for (let i = 0; i < max; i++) {
    const value = predicate();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error("waitFor: condition never satisfied");
}

describe("startPKCEFlow", () => {
  it("should build the auth URL, open the browser and exchange the code", async () => {
    let handler: ((e: { payload: string }) => void) | undefined;
    listenMock.mockImplementation(
      (_event: string, cb: (e: { payload: string }) => void) => {
        handler = cb;
      },
    );

    fetchMock.mockResolvedValueOnce(
      okJson({ access_token: "pkce-at", refresh_token: "pkce-rt", expires_in: 3600 }),
    );

    const promise = chatgptAuth.startPKCEFlow();
    await waitFor(() => handler);
    handler!({ payload: "authorization-code-123" });
    const tokens = await promise;

    expect(tokens.accessToken).toBe("pkce-at");
    expect(emitMock).toHaveBeenCalledWith("oauth_set_state", expect.any(String));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining("https://auth.openai.com/oauth/authorize?"),
    );
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining("code_challenge="),
    );
  });
});

// ─── startAuth ───────────────────────────────────────────────────

describe("startAuth", () => {
  it("should use the device code flow on web", async () => {
    fetchMock.mockResolvedValueOnce(
      okJson({ device_code: "dc", user_code: "UC" }),
    );

    const result = await chatgptAuth.startAuth();
    expect(result.type).toBe("device_code");
    if (result.type === "device_code") {
      expect(result.pending.deviceCode).toBe("dc");
    }
  });

  it("should use the PKCE flow on Tauri", async () => {
    (window as unknown as Record<string, unknown>).__TAURI__ = true;
    listenMock.mockImplementation(
      (_event: string, cb: (e: { payload: string }) => void) => {
        cb({ payload: "code-from-tauri" });
      },
    );
    tauriHttpFetchMock.mockResolvedValueOnce(
      okJson({ access_token: "tauri-at", refresh_token: "tauri-rt", expires_in: 3600 }),
    );

    const result = await chatgptAuth.startAuth();

    expect(result.type).toBe("tokens");
    if (result.type === "tokens") {
      expect(result.tokens.accessToken).toBe("tauri-at");
    }
    expect(tauriHttpFetchMock).toHaveBeenCalled();
  });
});
