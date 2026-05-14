/**
 * Tests for CloudBridge — reads/writes to Supabase PostgreSQL via CloudContextClient.
 *
 * Strict TDD: RED phase — tests describe behavior first, implementation follows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudBridge } from "../sync/cloud-bridge";

describe("CloudBridge", () => {
  let bridge: CloudBridge;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockFrom: any;

  /**
   * Create a mock Supabase query builder chain that returns the given response.
   */
  function mockChain(response: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: Record<string, any> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve(response)),
      single: vi.fn(() => Promise.resolve(response)),
      order: vi.fn(() => Promise.resolve(response)),
      upsert: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    return chain;
  }

  beforeEach(() => {
    mockFrom = vi.fn(() => mockChain({ data: null, error: null }));
    bridge = new CloudBridge({ from: mockFrom });
  });

  // ──────────────────────────────────────────────
  // readContext
  // ──────────────────────────────────────────────

  it("should read a context entry from Supabase", async () => {
    const mockData = {
      data: { context_key: "theme", context_value: { value: "dark", timestamp: 2000 } },
      error: null,
    };
    const chain = mockChain(mockData);
    mockFrom.mockReturnValue(chain);

    const result = await bridge.readContext("user-123", "theme");

    expect(mockFrom).toHaveBeenCalledWith("cloud_context");
    expect(chain.select).toHaveBeenCalledWith("context_key, context_value");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(chain.eq).toHaveBeenCalledWith("context_key", "theme");
    expect(result).toEqual({ value: "dark", timestamp: 2000 });
  });

  it("should return null when context entry does not exist", async () => {
    const mockData = { data: null, error: null };
    const chain = mockChain(mockData);
    mockFrom.mockReturnValue(chain);

    const result = await bridge.readContext("user-456", "nonexistent");
    expect(result).toBeNull();
  });

  it("should throw on Supabase error during read", async () => {
    const mockData = { data: null, error: new Error("DB error") };
    const chain = mockChain(mockData);
    mockFrom.mockReturnValue(chain);

    await expect(bridge.readContext("user-123", "key")).rejects.toThrow("DB error");
  });

  // ──────────────────────────────────────────────
  // writeContext
  // ──────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeUpsertChain(response: any) {
    const selectAfterUpsert = vi.fn(() => Promise.resolve(response));
    return { select: vi.fn(() => ({ single: selectAfterUpsert })) };
  }

  it("should upsert a context entry to Supabase", async () => {
    const chain = mockChain({ data: null, error: null });
    chain.upsert = vi.fn(() => makeUpsertChain({ data: null, error: null }));
    mockFrom.mockReturnValue(chain);

    await bridge.writeContext("user-123", "theme", "dark", 2000);

    expect(mockFrom).toHaveBeenCalledWith("cloud_context");
    expect(chain.upsert).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        context_key: "theme",
        context_value: { value: "dark", timestamp: 2000 },
        source: "vibe-studio",
      },
      { onConflict: "user_id, context_key" },
    );
  });

  it("should write object values correctly", async () => {
    const chain = mockChain({ data: null, error: null });
    chain.upsert = vi.fn(() => makeUpsertChain({ data: null, error: null }));
    mockFrom.mockReturnValue(chain);

    const prefs = { sidebarWidth: 300, chatPosition: "left" };
    await bridge.writeContext("user-123", "preferences", prefs, 3000);

    expect(chain.upsert).toHaveBeenCalledWith(
      {
        user_id: "user-123",
        context_key: "preferences",
        context_value: { value: prefs, timestamp: 3000 },
        source: "vibe-studio",
      },
      { onConflict: "user_id, context_key" },
    );
  });

  it("should throw on Supabase error during write", async () => {
    const chain = mockChain({ data: null, error: null });
    chain.upsert = vi.fn(() => makeUpsertChain({ data: null, error: new Error("Write failed") }));
    mockFrom.mockReturnValue(chain);

    await expect(bridge.writeContext("user-123", "key", "val", 1)).rejects.toThrow("Write failed");
  });

  // ──────────────────────────────────────────────
  // listContextKeys
  // ──────────────────────────────────────────────

  it("should list all context keys for a user", async () => {
    const mockData = {
      data: [
        { context_key: "theme" },
        { context_key: "sidebarWidth" },
        { context_key: "chatPosition" },
      ],
      error: null,
    };
    const chain = mockChain(mockData);
    chain.order = vi.fn(() => Promise.resolve(mockData)); // order returns directly
    mockFrom.mockReturnValue(chain);

    const keys = await bridge.listContextKeys("user-123");

    expect(mockFrom).toHaveBeenCalledWith("cloud_context");
    expect(chain.select).toHaveBeenCalledWith("context_key");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(chain.order).toHaveBeenCalledWith("context_key", { ascending: true });
    expect(keys).toEqual(["theme", "sidebarWidth", "chatPosition"]);
  });

  it("should return empty array when user has no context", async () => {
    const mockData = { data: [], error: null };
    const chain = mockChain(mockData);
    chain.order = vi.fn(() => Promise.resolve(mockData));
    mockFrom.mockReturnValue(chain);

    const keys = await bridge.listContextKeys("user-456");
    expect(keys).toEqual([]);
  });

  it("should throw on Supabase error during list", async () => {
    const mockData = { data: null, error: new Error("List failed") };
    const chain = mockChain(mockData);
    chain.order = vi.fn(() => Promise.resolve(mockData));
    mockFrom.mockReturnValue(chain);

    await expect(bridge.listContextKeys("user-123")).rejects.toThrow("List failed");
  });
});
