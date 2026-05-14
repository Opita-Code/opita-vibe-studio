/**
 * Integration Test: OfflineQueue + Storage
 *
 * Verifies that OfflineQueue correctly persists to StorageBackend across
 * simulated page reloads (new queue instances) and that TTL eviction works
 * across sessions.
 *
 * This is an integration test, not a unit test — it exercises the PUBLIC
 * API of both OfflineQueue and StorageBackend together, verifying the
 * full lifecycle: add → persist → reload → dequeue → TTL evict.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { OfflineQueue } from "../../packages/opita-cloud-context/src/sync/offline-queue";
import { MemoryStorageAdapter } from "../../packages/opita-cloud-context/src/storage/memory-storage";

// ──────────────────────────────────────────────
// MemoryStorageAdapter + OfflineQueue integration
// ──────────────────────────────────────────────

describe("OfflineQueue + MemoryStorageAdapter integration", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it("should survive page reload (new instance, same storage)", async () => {
    const now = Date.now();
    const q1 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    await q1.add({ key: "theme", value: "dark", operation: "upsert", timestamp: now + 100 });
    await q1.add({ key: "sidebarWidth", value: 300, operation: "upsert", timestamp: now + 200 });
    await q1.add({ key: "language", value: "es", operation: "upsert", timestamp: now + 300 });

    // Verify q1 has data before "page reload"
    expect(await q1.size()).toBe(3);

    // Simulate page reload: new OfflineQueue instance, same storage
    const q2 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    expect(await q2.size()).toBe(3);

    // FIFO within same priority — oldest first
    const first = await q2.dequeue();
    expect(first?.key).toBe("theme");
    expect(first?.timestamp).toBe(now + 100);
    const second = await q2.dequeue();
    expect(second?.key).toBe("sidebarWidth");
    const third = await q2.dequeue();
    expect(third?.key).toBe("language");
    expect(await q2.dequeue()).toBeNull();
  });

  it("should apply TTL eviction across sessions", async () => {
    const farPast = Date.now() - 120000; // 2 minutes ago
    const recent = Date.now();

    const q1 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    await q1.add(
      { key: "stale-data", value: "old", operation: "upsert", timestamp: farPast },
      { ttl: 1 }, // 1ms TTL — definitely expired
    );
    await q1.add(
      { key: "fresh-data", value: "new", operation: "upsert", timestamp: recent },
    );

    // Before dequeue, size includes expired entry
    // After dequeue, expired should be removed
    const entry = await q1.dequeue();
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("fresh-data"); // Expired entry skipped

    // Verify stale entry was cleaned up
    expect(await q1.size()).toBe(0);

    // "Page reload" — expired entry should be gone
    const q2 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    expect(await q2.size()).toBe(0);
  });

  it("should survive deduplication across instances", async () => {
    const now = Date.now();
    const q1 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    await q1.add({ key: "theme", value: "dark", operation: "upsert", timestamp: now + 100 });

    expect(await q1.size()).toBe(1);

    // "Page reload" — new instance
    const q2 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    // Add the same key+value — should deduplicate
    await q2.add({ key: "theme", value: "dark", operation: "upsert", timestamp: now + 200 });

    expect(await q2.size()).toBe(1);
    const entry = await q2.dequeue();
    expect(entry?.timestamp).toBe(now + 200); // Updated to latest timestamp
  });

  it("should handle full add-dequeue-clear cycle across instances", async () => {
    const now = Date.now();
    const q1 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    await q1.add({ key: "a", value: 1, operation: "upsert", timestamp: now + 100 });
    await q1.add({ key: "b", value: 2, operation: "upsert", timestamp: now + 200 });

    expect(await q1.size()).toBe(2);

    const q2 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    expect(await q2.size()).toBe(2);
    await q2.clear();

    const q3 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    expect(await q3.size()).toBe(0);
    expect(await q3.dequeue()).toBeNull();
  });

  it("should respect priority ordering that survives reload", async () => {
    const now = Date.now();
    const q1 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    await q1.add(
      { key: "low-pri", value: 1, operation: "upsert", timestamp: now + 100 },
      { priority: "low" },
    );
    await q1.add(
      { key: "high-pri", value: 2, operation: "upsert", timestamp: now + 200 },
      { priority: "high" },
    );

    expect(await q1.size()).toBe(2);

    // "Page reload"
    const q2 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    const first = await q2.dequeue();
    expect(first?.key).toBe("high-pri");
    const second = await q2.dequeue();
    expect(second?.key).toBe("low-pri");
  });
});
