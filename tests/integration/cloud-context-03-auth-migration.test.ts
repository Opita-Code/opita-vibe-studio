/**
 * Integration Test: Auth + Migration
 *
 * Verifies that the auth store's `migrateFromGuest()` action correctly detects
 * matching guestâ†”OAuth emails, and that the `migrateGuestData()` SDK function
 * actually persists local guest data to the cloud via CloudBridge.
 *
 * Flow:
 *   1. Guest uses app â†’ localStorage has "vibe-guest-email" + pref data
 *   2. User logs in with Google OAuth â†’ email matches
 *   3. Auth store sets needsMigration = true
 *   4. migrateGuestData() writes all guest prefs to CloudBridge
 *   5. Migration marker prevents re-migration
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../../src/stores/auth";
import { migrateGuestData } from "../../packages/opita-cloud-context/src/sync/migration";
import { MemoryStorageAdapter } from "../../packages/opita-cloud-context/src/storage/memory-storage";
import type { StorageBackend } from "../../packages/opita-cloud-context/src/types";

describe("Auth + Migration integration", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      plan: "free",
      authMode: "unauthenticated",
      sessionDetected: false,
      isLoading: false,
      supabaseReady: false,
      guestEmail: null,
      needsMigration: false,
    });
    localStorage.clear();
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Auth store migration detection
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should detect email match and set needsMigration when guest email equals OAuth email", () => {
    localStorage.setItem("vibe-guest-email", "usuario@ejemplo.com");

    const result = useAuthStore.getState().migrateFromGuest("usuario@ejemplo.com");
    expect(result).toBe(true);
    expect(useAuthStore.getState().guestEmail).toBe("usuario@ejemplo.com");
    expect(useAuthStore.getState().needsMigration).toBe(true);
  });

  it("should NOT trigger migration when OAuth email differs from guest email", () => {
    localStorage.setItem("vibe-guest-email", "guest@example.com");

    const result = useAuthStore.getState().migrateFromGuest("different@example.com");
    expect(result).toBe(false);
    expect(useAuthStore.getState().needsMigration).toBe(false);
    expect(useAuthStore.getState().guestEmail).toBeNull();
  });

  it("should NOT trigger migration when no guest email is stored", () => {
    const result = useAuthStore.getState().migrateFromGuest("user@example.com");
    expect(result).toBe(false);
    expect(useAuthStore.getState().needsMigration).toBe(false);
  });

  it("should handle email comparison case-insensitively", () => {
    localStorage.setItem("vibe-guest-email", "User@Example.COM");

    const result = useAuthStore.getState().migrateFromGuest("user@example.com");
    expect(result).toBe(true);
    expect(useAuthStore.getState().needsMigration).toBe(true);
  });

  it("should return false when empty email is passed", () => {
    localStorage.setItem("vibe-guest-email", "user@example.com");

    const result = useAuthStore.getState().migrateFromGuest("");
    expect(result).toBe(false);
    expect(useAuthStore.getState().needsMigration).toBe(false);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // MigrateGuestData SDK integration
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  it("should migrate guest preferences from storage to cloud via CloudBridge", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = { writeContext: vi.fn() };

    await storage.set("prefs:theme", "dark");
    await storage.set("prefs:sidebarWidth", 280);

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(2);
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "theme", "dark", expect.any(Number),
    );
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "sidebarWidth", 280, expect.any(Number),
    );
  });

  it("should migrate learning data alongside preferences", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = { writeContext: vi.fn() };

    await storage.set("prefs:language", "es");
    await storage.set("learning:shownTips", ["tip-flexbox", "tip-hooks"]);
    await storage.set("learning:events", [
      { type: "tip_shown", concept: "flexbox", timestamp: 1000 },
    ]);

    const result = await migrateGuestData({
      userId: "user-456",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(3);
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-456", "language", "es", expect.any(Number),
    );
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-456", "shownTips", ["tip-flexbox", "tip-hooks"], expect.any(Number),
    );
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-456", "events", expect.any(Array), expect.any(Number),
    );
  });

  it("should NOT migrate internal/sync keys", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = { writeContext: vi.fn() };

    await storage.set("prefs:theme", "dark");
    await storage.set("sync:lastPull", 12345);
    await storage.set("offline-queue", [{ key: "stale" }]);

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.migratedCount).toBe(1);
    expect(mockBridge.writeContext).toHaveBeenCalledTimes(1);
    expect(mockBridge.writeContext).toHaveBeenCalledWith(
      "user-123", "theme", "dark", expect.any(Number),
    );
  });

  it("should return alreadyMigrated=true when migration was previously completed", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = { writeContext: vi.fn() };

    await storage.set("migration:completed", {
      migratedAt: "2026-05-01T00:00:00Z",
      userId: "user-123",
    });
    await storage.set("prefs:theme", "dark");

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.success).toBe(true);
    expect(result.alreadyMigrated).toBe(true);
    expect(result.migratedCount).toBe(0);
    expect(mockBridge.writeContext).not.toHaveBeenCalled();
  });

  it("should write migration marker after successful migration", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = { writeContext: vi.fn() };

    await storage.set("prefs:theme", "dark");

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.success).toBe(true);

    const marker = await storage.get<{ migratedAt: string; userId: string }>("migration:completed");
    expect(marker).not.toBeNull();
    expect(marker!.userId).toBe("user-123");
  });

  it("should handle CloudBridge failure and return error", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = {
      writeContext: vi.fn().mockRejectedValue(new Error("Network timeout")),
    };

    await storage.set("prefs:theme", "dark");

    const result = await migrateGuestData({
      userId: "user-123",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.success).toBe(false);
    expect(result.migratedCount).toBe(0);
    expect(result.error).toContain("Network timeout");
  });

  it("should complete migration with zero count when no guest data exists", async () => {
    const storage: StorageBackend = new MemoryStorageAdapter();
    const mockBridge = { writeContext: vi.fn() };

    const result = await migrateGuestData({
      userId: "user-empty",
      storage,
      cloudBridge: mockBridge,
    });

    expect(result.success).toBe(true);
    expect(result.migratedCount).toBe(0);
    expect(mockBridge.writeContext).not.toHaveBeenCalled();

    const marker = await storage.get("migration:completed");
    expect(marker).not.toBeNull();
  });
});

