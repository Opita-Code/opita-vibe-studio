import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/supabase-js BEFORE importing client
vi.mock("@supabase/supabase-js", () => {
  const mockUnsubscribe = vi.fn();
  const mockOnAuthStateChange = vi.fn(() => ({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  }));
  const mockSignInWithOAuth = vi.fn();
  const mockSignOut = vi.fn();
  const mockGetSession = vi.fn();
  const mockSupabaseClient = {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  };
  const createClient = vi.fn(() => mockSupabaseClient);

  return {
    createClient,
    mockUnsubscribe,
    mockSupabaseClient,
    mockSignInWithOAuth,
    mockSignOut,
    mockGetSession,
    mockOnAuthStateChange,
  };
});

import { CloudContextClient } from "../client";

const mockModule = await import("@supabase/supabase-js");
const {
  createClient,
  mockSignInWithOAuth,
  mockSignOut,
  mockGetSession,
  mockOnAuthStateChange,
  mockUnsubscribe,
} = mockModule as unknown as {
  createClient: ReturnType<typeof vi.fn>;
  mockSignInWithOAuth: ReturnType<typeof vi.fn>;
  mockSignOut: ReturnType<typeof vi.fn>;
  mockGetSession: ReturnType<typeof vi.fn>;
  mockOnAuthStateChange: ReturnType<typeof vi.fn>;
  mockUnsubscribe: ReturnType<typeof vi.fn>;
};

describe("CloudContextClient", () => {
  const validConfig = {
    supabaseUrl: "https://test.supabase.co",
    anonKey: "test-anon-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should construct with valid config", () => {
    const client = new CloudContextClient(validConfig);
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(CloudContextClient);
  });

  it("should create Supabase client on construction", () => {
    const client = new CloudContextClient(validConfig);
    expect(client).toBeDefined();
    expect(createClient).toHaveBeenCalledWith(
      validConfig.supabaseUrl,
      validConfig.anonKey,
    );
  });

  it("should throw on empty supabaseUrl", () => {
    expect(() => {
      new CloudContextClient({ supabaseUrl: "", anonKey: "key" });
    }).toThrow();
  });

  it("should throw on empty anonKey", () => {
    expect(() => {
      new CloudContextClient({ supabaseUrl: "https://test.supabase.co", anonKey: "" });
    }).toThrow();
  });

  describe("init", () => {
    it("should call getSession on init", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const client = new CloudContextClient(validConfig);
      await client.init();

      expect(mockGetSession).toHaveBeenCalled();
    });
  });

  describe("getSession", () => {
    it("should return session when authenticated", async () => {
      const fakeSession = {
        user: { id: "user-123", email: "user@test.com" },
        access_token: "token-abc",
      };
      mockGetSession.mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      });

      const client = new CloudContextClient(validConfig);
      const session = await client.getSession();

      expect(session).toEqual(fakeSession);
    });

    it("should return null when not authenticated", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const client = new CloudContextClient(validConfig);
      const session = await client.getSession();

      expect(session).toBeNull();
    });
  });

  describe("signIn", () => {
    it("should call signInWithOAuth for google provider", async () => {
      const client = new CloudContextClient(validConfig);
      await client.signIn("google");

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: "google" });
    });
  });

  describe("signOut", () => {
    it("should call supabase signOut", async () => {
      const client = new CloudContextClient(validConfig);
      await client.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("onAuthChange", () => {
    it("should subscribe to auth state changes", () => {
      const client = new CloudContextClient(validConfig);
      const callback = vi.fn();
      const unsubscribe = client.onAuthChange(callback);

      expect(mockOnAuthStateChange).toHaveBeenCalledWith(callback);
      expect(typeof unsubscribe).toBe("function");
    });

    it("should return unsubscribe function", () => {
      const client = new CloudContextClient(validConfig);
      const callback = vi.fn();
      const unsubscribe = client.onAuthChange(callback);

      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});
