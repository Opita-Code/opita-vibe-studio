import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @opita/cloud-context before importing CloudAuth
vi.mock("@opita/cloud-context", () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();
  const mockGetSession = vi.fn();
  const mockInit = vi.fn();
  const mockOnAuthChange = vi.fn(() => vi.fn());

  const MockCloudContextClient = vi.fn(() => ({
    signIn: mockSignIn,
    signOut: mockSignOut,
    getSession: mockGetSession,
    init: mockInit,
    onAuthChange: mockOnAuthChange,
  }));

  return {
    CloudContextClient: MockCloudContextClient,
    mockSignIn,
    mockSignOut,
    mockGetSession,
    mockInit,
    mockOnAuthChange,
  };
});

import { CloudAuth, cloudAuth } from "../../src/auth/cloudAuth";

// Get mock references
const mockModule = await import("@opita/cloud-context");
const {
  CloudContextClient,
  mockSignIn,
  mockSignOut,
  mockGetSession,
  mockInit,
  mockOnAuthChange,
} = mockModule as unknown as {
  CloudContextClient: ReturnType<typeof vi.fn>;
  mockSignIn: ReturnType<typeof vi.fn>;
  mockSignOut: ReturnType<typeof vi.fn>;
  mockGetSession: ReturnType<typeof vi.fn>;
  mockInit: ReturnType<typeof vi.fn>;
  mockOnAuthChange: ReturnType<typeof vi.fn>;
};

describe("CloudAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("singleton", () => {
    it("should export a singleton instance", () => {
      expect(cloudAuth).toBeDefined();
      expect(cloudAuth).toBeInstanceOf(CloudAuth);
    });
  });

  describe("isReady (no env vars)", () => {
    it("should not be ready when constructed without config", () => {
      const auth = new CloudAuth();
      expect(auth.isReady()).toBe(false);
    });

    it("should not create CloudContextClient when not ready", () => {
      const auth = new CloudAuth();
      expect(auth.isReady()).toBe(false);
      expect(CloudContextClient).not.toHaveBeenCalled();
    });
  });

  describe("isReady (with config)", () => {
    it("should be ready when constructed with supabaseUrl and anonKey", () => {
      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      expect(auth.isReady()).toBe(true);
    });

    it("should create CloudContextClient with correct config", () => {
      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      expect(CloudContextClient).toHaveBeenCalledWith({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
    });

    it("should NOT be ready when only supabaseUrl is provided", () => {
      const auth = new CloudAuth({ supabaseUrl: "https://test.supabase.co" });
      expect(auth.isReady()).toBe(false);
    });

    it("should NOT be ready when only anonKey is provided", () => {
      const auth = new CloudAuth({ anonKey: "test-key" });
      expect(auth.isReady()).toBe(false);
    });
  });

  describe("getSession", () => {
    it("should return session when authenticated", async () => {
      const fakeSession = { user: { id: "uid-1" }, access_token: "tok" };
      mockGetSession.mockResolvedValue(fakeSession);

      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      const result = await auth.getSession();

      expect(mockGetSession).toHaveBeenCalled();
      expect(result).toEqual(fakeSession);
    });

    it("should return null when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      const result = await auth.getSession();

      expect(result).toBeNull();
    });

    it("should return null when not ready", async () => {
      const auth = new CloudAuth();
      const result = await auth.getSession();

      expect(result).toBeNull();
      expect(mockGetSession).not.toHaveBeenCalled();
    });
  });

  describe("signInWithGoogle", () => {
    it("should call CloudContextClient.signIn with google provider", async () => {
      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      await auth.signInWithGoogle();

      expect(mockSignIn).toHaveBeenCalledWith("google");
    });

    it("should throw when not ready", async () => {
      const auth = new CloudAuth();

      await expect(auth.signInWithGoogle()).rejects.toThrow(
        "Cloud auth is not configured",
      );
    });
  });

  describe("signOut", () => {
    it("should call CloudContextClient.signOut", async () => {
      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      await auth.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it("should do nothing when not ready", async () => {
      const auth = new CloudAuth();
      await auth.signOut();

      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  describe("init", () => {
    it("should call CloudContextClient.init", async () => {
      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      await auth.init();

      expect(mockInit).toHaveBeenCalled();
    });

    it("should do nothing when not ready", async () => {
      const auth = new CloudAuth();
      await auth.init();

      expect(mockInit).not.toHaveBeenCalled();
    });
  });

  describe("onAuthChange", () => {
    it("should subscribe to auth state changes", () => {
      const auth = new CloudAuth({
        supabaseUrl: "https://test.supabase.co",
        anonKey: "test-key",
      });
      const callback = vi.fn();
      const unsubscribe = auth.onAuthChange(callback);

      expect(mockOnAuthChange).toHaveBeenCalledWith(callback);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should return noop when not ready", () => {
      const auth = new CloudAuth();
      const callback = vi.fn();
      const unsubscribe = auth.onAuthChange(callback);

      expect(mockOnAuthChange).not.toHaveBeenCalled();
      expect(typeof unsubscribe).toBe("function");
      // Calling noop should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
