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
import { SyncEngine, CloudBridge, MemoryStorageAdapter } from "@opita/memory-sdk";
import type { StorageBackend } from "@opita/memory-sdk";

// ──────────────────────────────────────────────
// SyncEngine + CloudBridge Integration Tests
// ──────────────────────────────────────────────

describe("SyncEngine + CloudBridge integration", () => {
  let storage: StorageBackend;
  let fetchMock: ReturnType<typeof vi.fn>;
  let bridge: CloudBridge;
  let engine: SyncEngine;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    bridge = new CloudBridge({
      apiBaseUrl: "https://api.opitacode.local",
      getAuthToken: async () => "mock-token",
      serviceName: "vibe-studio",
    });
    engine = new SyncEngine({ storage, cloudBridge: bridge });
  });

  // ──────────────────────────────────────────
  // Pull integration
  // ──────────────────────────────────────────

  it("should pull cloud data and store it locally via CloudBridge", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/trabajos/context?service=vibe-studio&key=theme")) {
        return {
          ok: true,
          json: async () => ({ value: "dark", timestamp: 2000 }),
        };
      }
      if (url.includes("/trabajos/context?service=vibe-studio&key=sidebarWidth")) {
        return {
          ok: true,
          json: async () => ({ value: 300, timestamp: 3000 }),
        };
      }
      if (url.includes("/trabajos/context?service=vibe-studio")) {
        return {
          ok: true,
          json: async () => ({
            context: {
              theme: { value: "dark", timestamp: 2000 },
              sidebarWidth: { value: 300, timestamp: 3000 },
            },
          }),
        };
      }
      return { ok: false, status: 404 };
    });

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
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ context: {} }),
    });

    await engine.pull("user-456");

    const keys = await storage.keys("sync:");
    expect(keys.length).toBe(1);
    expect(keys[0]).toBe("sync:lastPull");
  });

  it("should apply LWW — cloud wins when cloud timestamp is newer", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "light", timestamp: 1000 }));

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("key=theme")) {
        return {
          ok: true,
          json: async () => ({ value: "dark", timestamp: 5000 }),
        };
      }
      return {
        ok: true,
        json: async () => ({ context: { theme: { value: "dark", timestamp: 5000 } } }),
      };
    });

    await engine.pull("user-123");

    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("dark");
  });

  it("should apply LWW — local wins when local timestamp is newer", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "light", timestamp: 5000 }));

    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("key=theme")) {
        return {
          ok: true,
          json: async () => ({ value: "dark", timestamp: 1000 }),
        };
      }
      return {
        ok: true,
        json: async () => ({ context: { theme: { value: "dark", timestamp: 1000 } } }),
      };
    });

    await engine.pull("user-123");

    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("light");
  });

  it("should handle API gateway error during pull gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("Network timeout"));
    await expect(engine.pull("user-123")).resolves.not.toThrow();
  });

  // ──────────────────────────────────────────
  // Push integration
  // ──────────────────────────────────────────

  it("should push local entries to cloud via CloudBridge writeContext", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "dark", timestamp: 1000 }));
    await storage.set("sync:sidebarWidth", JSON.stringify({ value: 300, timestamp: 2000 }));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await engine.push("user-123");

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const calls = fetchMock.mock.calls;
    const body1 = JSON.parse(calls[0][1].body);
    const body2 = JSON.parse(calls[1][1].body);

    expect(calls[0][0]).toContain("/trabajos/context");
    expect(calls[0][1].method).toBe("POST");
    expect(calls[1][0]).toContain("/trabajos/context");
    expect(calls[1][1].method).toBe("POST");

    const sentKeys = [body1.key, body2.key].sort();
    expect(sentKeys).toEqual(["sidebarWidth", "theme"]);
  });

  it("should skip entries that were already pushed (watermark)", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "dark", timestamp: 1000 }));

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await engine.push("user-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();

    await engine.push("user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should push nothing when there are no local sync entries", async () => {
    await engine.push("user-123");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────
  // Full sync (pull + push)
  // ──────────────────────────────────────────

  it("should perform full bidirectional sync: pull cloud data, push local changes", async () => {
    await storage.set("sync:localPref", JSON.stringify({ value: "local-value", timestamp: 5000 }));

    fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      if (url.includes("key=cloudPref")) {
        return {
          ok: true,
          json: async () => ({ value: "cloud-value", timestamp: 3000 }),
        };
      }
      return {
        ok: true,
        json: async () => ({ context: { cloudPref: { value: "cloud-value", timestamp: 3000 } } }),
      };
    });

    await engine.sync("user-123");

    const cloudLocal = await storage.get<string>("sync:cloudPref");
    expect(JSON.parse(cloudLocal!).value).toBe("cloud-value");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/trabajos/context"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"key":"localPref"'),
      }),
    );
  });

  it("should update push watermark after full sync", async () => {
    await storage.set("sync:pref", JSON.stringify({ value: "val", timestamp: 1000 }));

    fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ context: {} }),
      };
    });

    await engine.sync("user-123");

    const watermark = await storage.get<number>("sync:pushWatermark");
    expect(watermark).toBe(1000);
  });
});
