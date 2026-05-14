/**
 * Integration Test: SyncEngine + CloudBridge
 *
 * Verifies the full pull/push/sync cycle between SyncEngine and CloudBridge
 * using a mock Supabase client that simulates the real wire protocol.
 *
 * Tests that the combined system correctly:
 * 1. Pulls cloud data and merges into local storage (LWW)
 * 2. Pushes local entries to the cloud via CloudBridge
 * 3. Performs bidirectional sync correctly
 * 4. Handles conflict resolution
 * 5. Respects push watermark to avoid re-pushing
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncEngine } from "../../packages/opita-cloud-context/src/sync/sync-engine";
import { CloudBridge } from "../../packages/opita-cloud-context/src/sync/cloud-bridge";
import { MemoryStorageAdapter } from "../../packages/opita-cloud-context/src/storage/memory-storage";
import type { StorageBackend } from "../../packages/opita-cloud-context/src/types";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Create a mock Supabase query builder that returns the given response.
 */
function mockChain(response: unknown) {
  const chain: Record<string, unknown> = {
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

/**
 * Create an upsert chain that supports .select().single() chaining.
 */
function makeUpsertChain(response: unknown) {
  const selectAfterUpsert = vi.fn(() => Promise.resolve(response));
  return { select: vi.fn(() => ({ single: selectAfterUpsert })) };
}

// ──────────────────────────────────────────────
// SyncEngine + CloudBridge Integration Tests
// ──────────────────────────────────────────────

describe("SyncEngine + CloudBridge integration", () => {
  let storage: StorageBackend;
  let mockFrom: ReturnType<typeof vi.fn>;
  let bridge: CloudBridge;
  let engine: SyncEngine;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    mockFrom = vi.fn(() => mockChain({ data: null, error: null }));
    bridge = new CloudBridge({ from: mockFrom });
    engine = new SyncEngine({ storage, cloudBridge: bridge });
  });

  // ──────────────────────────────────────────
  // Pull integration
  // ──────────────────────────────────────────

  it("should pull cloud data and store it locally via CloudBridge", async () => {
    const mockData = {
      data: [{ context_key: "theme" }, { context_key: "sidebarWidth" }],
      error: null,
    };
    const listChain = mockChain(mockData);
    listChain.order = vi.fn(() => Promise.resolve(mockData));
    mockFrom.mockReturnValueOnce(listChain);

    const themeData = {
      data: { context_key: "theme", context_value: { value: "dark", timestamp: 2000 } },
      error: null,
    };
    const sidebarData = {
      data: { context_key: "sidebarWidth", context_value: { value: 300, timestamp: 3000 } },
      error: null,
    };

    mockFrom
      .mockReturnValueOnce(mockChain(themeData))
      .mockReturnValueOnce(mockChain(sidebarData));

    await engine.pull("user-123");

    const themeRaw = await storage.get<string>("sync:theme");
    expect(JSON.parse(themeRaw!).value).toBe("dark");

    const sidebarRaw = await storage.get<string>("sync:sidebarWidth");
    expect(JSON.parse(sidebarRaw!).value).toBe(300);

    const lastPull = await storage.get<number>("sync:lastPull");
    expect(lastPull).not.toBeNull();
    expect(lastPull!).toBeGreaterThan(0);
  });

  it("should do nothing when cloud has no data for user", async () => {
    const mockData = { data: [], error: null };
    const chain = mockChain(mockData);
    chain.order = vi.fn(() => Promise.resolve(mockData));
    mockFrom.mockReturnValue(chain);

    await engine.pull("user-456");

    const keys = await storage.keys("sync:");
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe("sync:lastPull");
  });

  it("should apply LWW — cloud wins when cloud timestamp is newer", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "light", timestamp: 1000 }));

    const mockData = { data: [{ context_key: "theme" }], error: null };
    const listChain = mockChain(mockData);
    listChain.order = vi.fn(() => Promise.resolve(mockData));
    const readData = {
      data: { context_key: "theme", context_value: { value: "dark", timestamp: 5000 } },
      error: null,
    };
    mockFrom
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(mockChain(readData));

    await engine.pull("user-123");

    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("dark");
  });

  it("should apply LWW — local wins when local timestamp is newer", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "light", timestamp: 5000 }));

    const mockData = { data: [{ context_key: "theme" }], error: null };
    const listChain = mockChain(mockData);
    listChain.order = vi.fn(() => Promise.resolve(mockData));
    const readData = {
      data: { context_key: "theme", context_value: { value: "dark", timestamp: 1000 } },
      error: null,
    };
    mockFrom
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(mockChain(readData));

    await engine.pull("user-123");

    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("light");
  });

  it("should throw when CloudBridge encounters a Supabase error during pull", async () => {
    const listData = { data: null, error: new Error("Supabase connection failed") };
    const chain = mockChain(listData);
    chain.order = vi.fn(() => Promise.resolve(listData));
    mockFrom.mockReturnValue(chain);

    await expect(engine.pull("user-123")).rejects.toThrow("Supabase connection failed");
  });

  // ──────────────────────────────────────────
  // Push integration
  // ──────────────────────────────────────────

  it("should push local entries to cloud via CloudBridge writeContext", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "dark", timestamp: 1000 }));
    await storage.set("sync:sidebarWidth", JSON.stringify({ value: 300, timestamp: 2000 }));

    const upsertResponse = { data: null, error: null };
    const upsertChain = mockChain(upsertResponse);
    upsertChain.upsert = vi.fn(() => makeUpsertChain(upsertResponse));
    mockFrom.mockReturnValue(upsertChain);

    await engine.push("user-123");

    expect(upsertChain.upsert).toHaveBeenCalledTimes(2);
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-123", context_key: "theme" }),
      { onConflict: "user_id, context_key" },
    );
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-123", context_key: "sidebarWidth" }),
      { onConflict: "user_id, context_key" },
    );
  });

  it("should skip entries that were already pushed (watermark)", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "dark", timestamp: 1000 }));

    const upsertResponse = { data: null, error: null };
    const upsertChain1 = mockChain(upsertResponse);
    upsertChain1.upsert = vi.fn(() => makeUpsertChain(upsertResponse));
    mockFrom.mockReturnValue(upsertChain1);

    await engine.push("user-123");
    expect(upsertChain1.upsert).toHaveBeenCalledTimes(1);

    const upsertChain2 = mockChain(upsertResponse);
    upsertChain2.upsert = vi.fn(() => makeUpsertChain(upsertResponse));
    mockFrom.mockReturnValue(upsertChain2);

    await engine.push("user-123");
    expect(upsertChain2.upsert).not.toHaveBeenCalled();
  });

  it("should push nothing when there are no local sync entries", async () => {
    const upsertResponse = { data: null, error: null };
    const upsertChain = mockChain(upsertResponse);
    upsertChain.upsert = vi.fn(() => makeUpsertChain(upsertResponse));
    mockFrom.mockReturnValue(upsertChain);

    await engine.push("user-123");
    expect(upsertChain.upsert).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────
  // Full sync (pull + push)
  // ──────────────────────────────────────────

  it("should perform full bidirectional sync: pull cloud data, push local changes", async () => {
    await storage.set("sync:localPref", JSON.stringify({ value: "local-value", timestamp: 5000 }));

    const listData = { data: [{ context_key: "cloudPref" }], error: null };
    const listChain = mockChain(listData);
    listChain.order = vi.fn(() => Promise.resolve(listData));
    const readData = {
      data: { context_key: "cloudPref", context_value: { value: "cloud-value", timestamp: 3000 } },
      error: null,
    };

    const upsertResponse = { data: null, error: null };
    const upsertChain = mockChain(upsertResponse);
    upsertChain.upsert = vi.fn(() => makeUpsertChain(upsertResponse));

    mockFrom
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(mockChain(readData))
      .mockReturnValueOnce(upsertChain);

    await engine.sync("user-123");

    const cloudLocal = await storage.get<string>("sync:cloudPref");
    expect(JSON.parse(cloudLocal!).value).toBe("cloud-value");

    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ context_key: "localPref" }),
      { onConflict: "user_id, context_key" },
    );
  });

  it("should update push watermark after full sync", async () => {
    await storage.set("sync:pref", JSON.stringify({ value: "val", timestamp: 1000 }));

    const listData = { data: [], error: null };
    const listChain = mockChain(listData);
    listChain.order = vi.fn(() => Promise.resolve(listData));

    const upsertResponse = { data: null, error: null };
    const upsertChain = mockChain(upsertResponse);
    upsertChain.upsert = vi.fn(() => makeUpsertChain(upsertResponse));

    mockFrom
      .mockReturnValueOnce(listChain)
      .mockReturnValueOnce(upsertChain);

    await engine.sync("user-123");

    const watermark = await storage.get<number>("sync:pushWatermark");
    expect(watermark).toBe(1000);
  });
});
