import { describe, it, expect, beforeEach } from "vitest";
import { initiateSSO, restoreSession, logout } from "../../src/auth/sso";
import { useAuthStore } from "../../src/stores/auth";

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-jwt-token"),
  })),
}));

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
  localStorage.clear();
});

describe("initiateSSO", () => {
  it("should return null for empty email", async () => {
    const result = await initiateSSO();
    expect(result).toBeNull();
  });

  it("should throw for invalid email", async () => {
    await expect(initiateSSO("invalid")).rejects.toThrow("Email inválido");
  });

  it("should return user and session for valid email", async () => {
    const result = await initiateSSO("student@unal.edu.co");
    expect(result).not.toBeNull();
    expect(result!.user.email).toBe("student@unal.edu.co");
    expect(result!.session.token).toContain("mock-jwt");
    expect(result!.user.plan).toBe("estudiante"); // .edu → estudiante
    expect(result!.user.verified).toBe(true);
  });

  it("should assign free plan for non-edu email", async () => {
    const result = await initiateSSO("user@gmail.com");
    expect(result!.user.plan).toBe("free");
    expect(result!.user.verified).toBe(false);
  });

  it("should persist session to localStorage", async () => {
    await initiateSSO("test@opita.co");
    const raw = localStorage.getItem("vibe-session");
    expect(raw).not.toBeNull();
    const session = JSON.parse(raw!);
    expect(session.token).toContain("mock-jwt");
  });
});

describe("restoreSession", () => {
  it("should return null when no session saved", async () => {
    const result = await restoreSession();
    expect(result).toBeNull();
  });

  it("should restore session when token is valid", async () => {
    await initiateSSO("test@opita.co");
    const result = await restoreSession();
    expect(result).not.toBeNull();
    expect(result!.session.token).toContain("mock-jwt");
  });
});

describe("logout", () => {
  it("should clear localStorage and reset auth store", async () => {
    await initiateSSO("test@opita.co");
    expect(localStorage.getItem("vibe-session")).not.toBeNull();

    await logout();
    expect(localStorage.getItem("vibe-session")).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});
