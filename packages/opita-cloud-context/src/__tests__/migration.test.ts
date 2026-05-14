/**
 * Tests for migration helper — migrates guest data to cloud on first OAuth login.
 *
 * Strict TDD: RED phase — tests describe behavior first, implementation follows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "../storage/memory-storage";
import { migrateGuestData } from "../sync/migration";
import type { StorageBackend } from "../types";

describe("migrateGuestData", () => {
  let storage: StorageBackend;
  let mockBridge: {
    writeContext: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    mockBridge = {
      writeContext: vi.fn(),
    };
  });

  // ──────────────────────────────────────────────
  // Successful migration
  // ──────────────────────────────────────────────

  it("should migrate user preferences to cloud", async () => {
    await storage.set("prefs:theme", "dark");
    await storage.set("prefs:sidebarWidth", 280);

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge as unknown as {
        writeContext(userId: string, key: string, value: unknown, timestamp: number): Promise<void>;
      },
    });

    expect(result.success).toBe(true);
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "theme", "dark", expect.any(Number),
    );
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "sidebarWidth", 280, expect.any(Number),
    );
  });

  it("should migrate learning data (shownTips, events) to cloud", async () => {
    const shownTips = ["tip-1", "tip-2"];
    const learningEvents = [{ type: "tip_shown", concept: "flexbox", timestamp: 1000 }];
    await storage.set("learning:shownTips", shownTips);
    await storage.set("learning:events", learningEvents);

    const result = await migrateGuestData({
      userId: "user-456",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.success).toBe(true);
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-456", "shownTips", shownTips, expect.any(Number),
    );
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-456", "events", learningEvents, expect.any(Number),
    );
  });

  it("should return count of migrated entries", async () => {
    await storage.set("prefs:theme", "dark");
    await storage.set("prefs:sidebarWidth", 280);
    await storage.set("learning:shownTips", ["tip-1"]);

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.migratedCount).toBe(3);
  });

  // ──────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────

  it("should return success with zero count when no guest data exists", async () => {
    const result = await migrateGuestData({
      userId: "user-empty",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(0);
    expect(mockBridge.writeContext).not.toHaveBeenCalled();
  });

  it("should handle partial migration failure gracefully", async () => {
    await storage.set("prefs:theme", "dark");
    mockBridge.writeContext
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(undefined);

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.success).toBe(false);
    expect(result.migratedCount).toBe(0);
    expect(result.error).toContain("Network error");
  });

  it("should skip keys that don't match known prefixes", async () => {
    // These are non-migratable keys
    await storage.set("sync:lastPull", 123);
    await storage.set("offline-queue", []);
    // These should be migrated
    await storage.set("prefs:theme", "dark");

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.migratedCount).toBe(1);
    expect(mockBridge.writeContext).toHaveBeenCalledTimes(1);
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "theme", "dark", expect.any(Number),
    );
  });

  // ──────────────────────────────────────────────
  // Migration markers
  // ──────────────────────────────────────────────

  it("should mark migration as completed after success", async () => {
    await storage.set("prefs:theme", "dark");

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.success).toBe(true);

    // Check that a migration marker was stored
    const marker = await storage.get<{ migratedAt: string; userId: string }>("migration:completed");
    expect(marker).not.toBeNull();
    expect(marker!.userId).toBe("user-123");
  });

  it("should NOT migrate if migration was already completed", async () => {
    await storage.set("migration:completed", {
      migratedAt: new Date().toISOString(),
      userId: "user-123",
    });
    await storage.set("prefs:theme", "dark");

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge as unknown as any,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(0);
    expect(result.alreadyMigrated).toBe(true);
    expect(mockBridge.writeContext).not.toHaveBeenCalled();
  });
});
