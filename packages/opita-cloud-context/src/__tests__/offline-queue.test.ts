/**
 * Tests for OfflineQueue — offline operation queue with dedup, TTL, priority, and quota eviction.
 *
 * Strict TDD: RED phase — tests describe behavior first, implementation follows.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "../storage/memory-storage";
import { OfflineQueue } from "../sync/offline-queue";
import type { SyncOperation, OfflineQueueEntry } from "../types";

describe("OfflineQueue", () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    const storage = new MemoryStorageAdapter();
    queue = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
  });

  // ──────────────────────────────────────────────
  // Basic operations
  // ──────────────────────────────────────────────

  it("should start empty", async () => {
    expect(await queue.size()).toBe(0);
  });

  it("should enqueue an operation and increase size", async () => {
    const op: SyncOperation = {
      key: "theme",
      value: "dark",
      operation: "upsert",
      timestamp: Date.now(),
    };
    await queue.add(op);
    expect(await queue.size()).toBe(1);
  });

  it("should dequeue a previously enqueued operation", async () => {
    const op: SyncOperation = {
      key: "sidebarWidth",
      value: 300,
      operation: "upsert",
      timestamp: Date.now(),
    };
    await queue.add(op);
    const entry = await queue.dequeue();
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("sidebarWidth");
    expect(entry!.value).toBe(300);
    expect(entry!.operation).toBe("upsert");
    expect(await queue.size()).toBe(0);
  });

  it("should peek at the next operation without removing it", async () => {
    const op: SyncOperation = {
      key: "theme",
      value: "light",
      operation: "upsert",
      timestamp: Date.now(),
    };
    await queue.add(op);
    const entry = await queue.peek();
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("theme");
    // Size should remain unchanged after peek
    expect(await queue.size()).toBe(1);
  });

  it("should return null when dequeuing from an empty queue", async () => {
    const entry = await queue.dequeue();
    expect(entry).toBeNull();
  });

  it("should return null when peeking into an empty queue", async () => {
    const entry = await queue.peek();
    expect(entry).toBeNull();
  });

  it("should clear all operations", async () => {
    const now = Date.now();
    await queue.add({ key: "a", value: 1, operation: "upsert", timestamp: now + 1 });
    await queue.add({ key: "b", value: 2, operation: "upsert", timestamp: now + 2 });
    expect(await queue.size()).toBe(2);
    await queue.clear();
    expect(await queue.size()).toBe(0);
    expect(await queue.dequeue()).toBeNull();
  });

  // ──────────────────────────────────────────────
  // Deduplication
  // ──────────────────────────────────────────────

  it("should deduplicate same-key same-value writes", async () => {
    const now = Date.now();
    const op: SyncOperation = {
      key: "theme",
      value: "dark",
      operation: "upsert",
      timestamp: now + 1000,
    };
    await queue.add(op);
    await queue.add({ ...op, timestamp: now + 2000 });
    expect(await queue.size()).toBe(1);
    // The latest timestamp should be preserved
    const entry = await queue.peek();
    expect(entry!.timestamp).toBe(now + 2000);
  });

  it("should NOT deduplicate same-key different-value writes", async () => {
    const now = Date.now();
    await queue.add({
      key: "theme",
      value: "dark",
      operation: "upsert",
      timestamp: now + 1000,
    });
    await queue.add({
      key: "theme",
      value: "light",
      operation: "upsert",
      timestamp: now + 2000,
    });
    // Different value = different entry
    expect(await queue.size()).toBe(2);
  });

  it("should NOT deduplicate same-key same-value with different operation type", async () => {
    const now = Date.now();
    await queue.add({
      key: "temp",
      value: "data",
      operation: "upsert",
      timestamp: now + 1000,
    });
    await queue.add({
      key: "temp",
      value: "data",
      operation: "delete",
      timestamp: now + 2000,
    });
    expect(await queue.size()).toBe(2);
  });

  // ──────────────────────────────────────────────
  // TTL (Time-to-Live)
  // ──────────────────────────────────────────────

  it("should skip expired entries on dequeue", async () => {
    const past = Date.now() - 120000; // 2 minutes ago
    await queue.add(
      {
        key: "stale",
        value: "old",
        operation: "upsert",
        timestamp: past,
      },
      { ttl: 500 }, // 500ms TTL — definitely expired
    );
    // Add a fresh entry
    await queue.add({
      key: "fresh",
      value: "new",
      operation: "upsert",
      timestamp: Date.now(),
    });
    // Dequeue should skip the expired entry and return the fresh one
    const entry = await queue.dequeue();
    expect(entry).not.toBeNull();
    expect(entry!.key).toBe("fresh");
    // Expired should be cleaned up
    expect(await queue.size()).toBe(0);
  });

  it("should update size after expired entries are cleaned", async () => {
    await queue.add(
      {
        key: "expired",
        value: "gone",
        operation: "upsert",
        timestamp: Date.now() - 100000,
      },
      { ttl: 1 },
    );
    // Size should still count it until dequeue/peek
    // After dequeue, expired entry is removed
    await queue.dequeue();
    expect(await queue.size()).toBe(0);
  });

  // ──────────────────────────────────────────────
  // Priority ordering
  // ──────────────────────────────────────────────

  it("should dequeue high priority before normal priority", async () => {
    const now = Date.now();
    await queue.add(
      { key: "normal", value: 1, operation: "upsert", timestamp: now + 100 },
      { priority: "normal" },
    );
    await queue.add(
      { key: "high", value: 2, operation: "upsert", timestamp: now + 200 },
      { priority: "high" },
    );
    const first = await queue.dequeue();
    expect(first!.key).toBe("high");
  });

  it("should dequeue normal priority before low priority", async () => {
    const now = Date.now();
    await queue.add(
      { key: "low", value: 1, operation: "upsert", timestamp: now + 100 },
      { priority: "low" },
    );
    await queue.add(
      { key: "normal", value: 2, operation: "upsert", timestamp: now + 200 },
      { priority: "normal" },
    );
    const first = await queue.dequeue();
    expect(first!.key).toBe("normal");
  });

  it("should respect FIFO within the same priority", async () => {
    const now = Date.now();
    await queue.add(
      { key: "first", value: 1, operation: "upsert", timestamp: now + 100 },
      { priority: "normal" },
    );
    await queue.add(
      { key: "second", value: 2, operation: "upsert", timestamp: now + 200 },
      { priority: "normal" },
    );
    const first = await queue.dequeue();
    expect(first!.key).toBe("first");
    const second = await queue.dequeue();
    expect(second!.key).toBe("second");
  });

  // ──────────────────────────────────────────────
  // Quota eviction
  // ──────────────────────────────────────────────

  it("should evict oldest entry when maxSize is reached", async () => {
    const now = Date.now();
    // Use a small queue
    const smallQueue = new OfflineQueue({
      storage: new MemoryStorageAdapter(),
      maxSize: 3,
      defaultTTL: 60000,
    });

    await smallQueue.add({
      key: "a", value: 1, operation: "upsert", timestamp: now + 100,
    });
    await smallQueue.add({
      key: "b", value: 2, operation: "upsert", timestamp: now + 200,
    });
    await smallQueue.add({
      key: "c", value: 3, operation: "upsert", timestamp: now + 300,
    });
    // Adding a 4th should evict the oldest (a)
    await smallQueue.add({
      key: "d", value: 4, operation: "upsert", timestamp: now + 400,
    });
    expect(await smallQueue.size()).toBe(3);
    // The first dequeue should NOT return 'a' since it was evicted
    const first = await smallQueue.dequeue();
    expect(first!.key).not.toBe("a");
  });

  it("should evict lowest priority when maxSize is reached with mixed priorities", async () => {
    const now = Date.now();
    const smallQueue = new OfflineQueue({
      storage: new MemoryStorageAdapter(),
      maxSize: 3,
      defaultTTL: 60000,
    });

    await smallQueue.add(
      { key: "high1", value: 1, operation: "upsert", timestamp: now + 100 },
      { priority: "high" },
    );
    await smallQueue.add(
      { key: "low1", value: 2, operation: "upsert", timestamp: now + 200 },
      { priority: "low" },
    );
    await smallQueue.add(
      { key: "high2", value: 3, operation: "upsert", timestamp: now + 300 },
      { priority: "high" },
    );
    // Adding a 4th should evict the lowest priority (low1)
    await smallQueue.add(
      { key: "normal1", value: 4, operation: "upsert", timestamp: now + 400 },
      { priority: "normal" },
    );
    expect(await smallQueue.size()).toBe(3);
    // low1 should be gone
    const entries: OfflineQueueEntry[] = [];
    for (let i = 0; i < 3; i++) {
      const e = await smallQueue.dequeue();
      if (e) entries.push(e);
    }
    const keys = entries.map((e) => e.key);
    expect(keys).not.toContain("low1");
  });

  // ──────────────────────────────────────────────
  // Persistence across instances
  // ──────────────────────────────────────────────

  it("should persist operations across queue instances sharing the same storage", async () => {
    const storage = new MemoryStorageAdapter();
    const q1 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    await q1.add({
      key: "persist", value: "yes", operation: "upsert", timestamp: Date.now(),
    });
    expect(await q1.size()).toBe(1);

    // New instance, same storage — should see the persisted data
    const q2 = new OfflineQueue({ storage, maxSize: 10, defaultTTL: 60000 });
    expect(await q2.size()).toBe(1);
    const entry = await q2.dequeue();
    expect(entry!.key).toBe("persist");
  });

  // ──────────────────────────────────────────────
  // Error cases
  // ──────────────────────────────────────────────

  it("should handle dequeue after clear gracefully", async () => {
    await queue.add({
      key: "temp", value: 1, operation: "upsert", timestamp: Date.now(),
    });
    await queue.clear();
    expect(await queue.dequeue()).toBeNull();
  });

  it("should handle multiple clears gracefully", async () => {
    await queue.clear();
    await queue.clear();
    expect(await queue.size()).toBe(0);
  });

  // ──────────────────────────────────────────────
  // Default values
  // ──────────────────────────────────────────────

  it("should use default priority and TTL when not specified", async () => {
    await queue.add({
      key: "defaults", value: "test", operation: "upsert", timestamp: Date.now(),
    });
    const entry = await queue.peek();
    expect(entry).not.toBeNull();
    expect(entry!.priority).toBe("normal");
    expect(entry!.ttl).toBe(60000);
  });
});
