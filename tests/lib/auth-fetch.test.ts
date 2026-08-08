import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSessionPlaceholder,
  getSessionToken,
  buildAuthHeaders,
  fetchWithAuth,
} from "../../src/lib/auth-fetch";
import { useAuthStore } from "../../src/stores/auth";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function okResponse() {
  return { ok: true, status: 200 };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(okResponse());
  useAuthStore.setState({
    session: null,
    authMode: "unauthenticated",
  });
});

describe("isSessionPlaceholder", () => {
  it("should treat empty tokens as placeholders", () => {
    expect(isSessionPlaceholder(undefined)).toBe(true);
    expect(isSessionPlaceholder(null)).toBe(true);
    expect(isSessionPlaceholder("")).toBe(true);
  });

  it("should treat OCAIS/cookie placeholders as placeholders", () => {
    expect(isSessionPlaceholder("__opita_session")).toBe(true);
    expect(isSessionPlaceholder("opita_session")).toBe(true);
  });

  it("should treat real JWTs as non-placeholders", () => {
    expect(isSessionPlaceholder("eyJhbGciOiJSUzI1NiJ9.token")).toBe(false);
  });
});

describe("getSessionToken", () => {
  it("should return the current session token", async () => {
    useAuthStore.setState({ session: { token: "jwt", expiresAt: 1 } });
    await expect(getSessionToken()).resolves.toBe("jwt");
  });

  it("should return null without a session", async () => {
    await expect(getSessionToken()).resolves.toBeNull();
  });
});

describe("buildAuthHeaders", () => {
  it("should return the Bearer header for real JWTs", () => {
    expect(buildAuthHeaders("real-jwt")).toEqual({ Authorization: "Bearer real-jwt" });
  });

  it("should return an empty object for placeholders", () => {
    expect(buildAuthHeaders("__opita_session")).toEqual({});
    expect(buildAuthHeaders(null)).toEqual({});
  });
});

describe("fetchWithAuth", () => {
  it("should attach the Bearer header and include credentials", async () => {
    useAuthStore.setState({ session: { token: "real-jwt", expiresAt: 1 } });

    await fetchWithAuth("https://api.example.com/x", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/x",
      expect.objectContaining({
        credentials: "include",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Authorization")).toBe("Bearer real-jwt");
  });

  it("should not attach the Bearer header for placeholder sessions", async () => {
    useAuthStore.setState({ session: { token: "__opita_session", expiresAt: 1 } });

    await fetchWithAuth("https://api.example.com/x");

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Authorization")).toBeNull();
    expect(init.credentials).toBe("include");
  });

  it("should preserve caller headers", async () => {
    useAuthStore.setState({ session: { token: "jwt", expiresAt: 1 } });

    await fetchWithAuth("https://api.example.com/x", {
      headers: { "Content-Type": "application/json" },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(init.headers.get("Authorization")).toBe("Bearer jwt");
  });

  it("should forward the response", async () => {
    useAuthStore.setState({ session: { token: "jwt", expiresAt: 1 } });
    const res = await fetchWithAuth("https://api.example.com/x");
    expect(res).toEqual(okResponse());
  });
});
