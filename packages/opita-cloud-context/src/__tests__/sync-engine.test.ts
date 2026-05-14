/**
 * Tests for SyncEngine — orchestrates pull/merge/push between local and cloud.
 *
 * Strict TDD: RED phase — tests describe behavior first, implementation follows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "../storage/memory-storage";
import { SyncEngine } from "../sync/sync-engine";
import type { StorageBackend } from "../types";

describe("SyncEngine", () => {
  let storage: StorageBackend;
  let engine: SyncEngine;
  let mockCloudBridge: {
    readContext: ReturnType<typeof vi.fn>;
    writeContext: ReturnType<typeof vi.fn>;
    listContextKeys: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    mockCloudBridge = {
      readContext: vi.fn(),
      writeContext: vi.fn(),
      listContextKeys: vi.fn(),
    };
    engine = new SyncEngine({
      storage,
      cloudBridge: mockCloudBridge as unknown as {
        readContext(userId: string, key: string): Promise<{ value: unknown; timestamp: number } | null>;
        writeContext(userId: string, key: string, value: unknown, timestamp: number): Promise<void>;
        listContextKeys(userId: string): Promise<string[]>;
      },
    });
  });

  // ──────────────────────────────────────────────
  // Pull (cloud → local)
  // ──────────────────────────────────────────────

  it("should pull cloud data and store it locally", async () => {
    mockCloudBridge.listContextKeys.mockResolvedValue(["theme", "sidebarWidth"]);
    mockCloudBridge.readContext.mockImplementation(
      async (_userId: string, key: string) => {
        if (key === "theme") return { value: "dark", timestamp: 2000 };
        if (key === "sidebarWidth") return { value: 280, timestamp: 3000 };
        return null;
      },
    );

    await engine.pull("user-123");

    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("dark");
    const raw2 = await storage.get<string>("sync:sidebarWidth");
    expect(JSON.parse(raw2!).value).toBe(280);
  });

  it("should do nothing when cloud has no data for the user", async () => {
    mockCloudBridge.listContextKeys.mockResolvedValue([]);

    await engine.pull("user-456");

    expect(mockCloudBridge.readContext).not.toHaveBeenCalled();
  });

  it("should apply last-write-wins when local data exists", async () => {
    // Local has newer data
    await storage.set("sync:theme", JSON.stringify({ value: "light", timestamp: 5000 }));
    mockCloudBridge.listContextKeys.mockResolvedValue(["theme"]);
    mockCloudBridge.readContext.mockResolvedValue({ value: "dark", timestamp: 2000 });

    await engine.pull("user-123");

    // Local's newer value wins
    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("light");
  });

  it("should overwrite local data when cloud has newer timestamp", async () => {
    // Local has older data
    await storage.set("sync:theme", JSON.stringify({ value: "light", timestamp: 1000 }));
    mockCloudBridge.listContextKeys.mockResolvedValue(["theme"]);
    mockCloudBridge.readContext.mockResolvedValue({ value: "dark", timestamp: 5000 });

    await engine.pull("user-123");

    // Cloud's newer value wins
    const raw = await storage.get<string>("sync:theme");
    expect(JSON.parse(raw!).value).toBe("dark");
  });

  it("should handle partial cloud data (some keys null)", async () => {
    mockCloudBridge.listContextKeys.mockResolvedValue(["exists", "missing"]);
    mockCloudBridge.readContext.mockImplementation(
      async (_userId: string, key: string) => {
        if (key === "exists") return { value: "here", timestamp: 1000 };
        return null;
      },
    );

    await engine.pull("user-123");

    const exists = await storage.get<string>("sync:exists");
    expect(JSON.parse(exists!).value).toBe("here");
    const missing = await storage.get<string>("sync:missing");
    expect(missing).toBeNull();
  });

  it("should track last sync timestamp", async () => {
    mockCloudBridge.listContextKeys.mockResolvedValue([]);
    const before = Date.now();

    await engine.pull("user-123");

    const lastSync = await storage.get<number>("sync:lastPull");
    expect(lastSync).not.toBeNull();
    expect(lastSync!).toBeGreaterThanOrEqual(before);
  });

  // ──────────────────────────────────────────────
  // Push (local → cloud)
  // ──────────────────────────────────────────────

  it("should push entries to the cloud via the bridge", async () => {
    // Write local entries as synced data
    await storage.set("sync:theme", JSON.stringify({ value: "dark", timestamp: 1000 }));
    await storage.set("sync:sidebarWidth", JSON.stringify({ value: 300, timestamp: 2000 }));

    await engine.push("user-123");

    expect(mockCloudBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "theme", "dark", 1000,
    );
    expect(mockCloudBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "sidebarWidth", 300, 2000,
    );
  });

  it("should push nothing when there are no synced entries", async () => {
    await engine.push("user-123");
    expect(mockCloudBridge.writeContext).not.toHaveBeenCalled();
  });

  it("should skip entries that have already been pushed (tracked via push watermark)", async () => {
    await storage.set("sync:theme", JSON.stringify({ value: "dark", timestamp: 1000 }));

    // First push
    await engine.push("user-123");
    expect(mockCloudBridge.writeContext).toHaveBeenCalledTimes(1);

    // Reset mock
    mockCloudBridge.writeContext.mockClear();

    // Second push — nothing new
    await engine.push("user-123");
    expect(mockCloudBridge.writeContext).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // Full sync
  // ──────────────────────────────────────────────

  it("should perform pull then push in a full sync", async () => {
    mockCloudBridge.listContextKeys.mockResolvedValue(["cloudKey"]);
    mockCloudBridge.readContext.mockResolvedValue({ value: "cloud-val", timestamp: 5000 });
    await storage.set("sync:localKey", JSON.stringify({ value: "local-val", timestamp: 3000 }));

    await engine.sync("user-123");

    // Cloud data was pulled in
    const cloudVal = await storage.get<string>("sync:cloudKey");
    expect(JSON.parse(cloudVal!).value).toBe("cloud-val");

    // Local data was pushed to cloud
    expect(mockCloudBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "localKey", "local-val", 3000,
    );
  });
});
