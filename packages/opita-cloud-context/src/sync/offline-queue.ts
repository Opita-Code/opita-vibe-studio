/**
 * OfflineQueue — persistent operation queue with dedup, TTL, priority, and quota eviction.
 *
 * Queues operations for later sync when offline. Uses a StorageBackend for
 * persistence between restarts. Entries are stored as a serialized array
 * under a single key in the storage backend.
 */
import type { StorageBackend, SyncOperation, OfflineQueueEntry } from "../types";

const DEFAULT_NAMESPACE = "offline-queue";
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface OfflineQueueOptions {
  /** Storage backend for persistence */
  storage: StorageBackend;
  /** Namespace key for storage scoping */
  namespace?: string;
  /** Maximum number of queued entries before eviction (default: 100) */
  maxSize?: number;
  /** Default TTL in milliseconds for entries without explicit TTL (default: 7 days) */
  defaultTTL?: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

export class OfflineQueue {
  private storage: StorageBackend;
  private namespace: string;
  private maxSize: number;
  private defaultTTL: number;

  constructor(options: OfflineQueueOptions) {
    this.storage = options.storage;
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.defaultTTL = options.defaultTTL ?? DEFAULT_TTL_MS;
  }

  private storageKey(): string {
    return this.namespace;
  }

  private async loadEntries(): Promise<OfflineQueueEntry[]> {
    const data = await this.storage.get<OfflineQueueEntry[]>(this.storageKey());
    return data ?? [];
  }

  private async saveEntries(entries: OfflineQueueEntry[]): Promise<void> {
    await this.storage.set(this.storageKey(), entries);
  }

  /**
   * Generate a unique ID for a queue entry.
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Check if two operations are duplicates (same key, value, and operation type).
   */
  private isDuplicate(a: SyncOperation, b: SyncOperation): boolean {
    return (
      a.key === b.key &&
      a.operation === b.operation &&
      JSON.stringify(a.value) === JSON.stringify(b.value)
    );
  }

  /**
   * Add a SyncOperation to the queue.
   *
   * - Deduplicates: if an entry with the same key+value+operation exists,
   *   its timestamp is updated to the latest.
   * - Eviction: if maxSize would be exceeded, the lowest-priority entry
   *   is evicted (ties broken by oldest first).
   *
   * @param operation - The sync operation to queue
   * @param options - Optional priority and TTL overrides
   */
  async add(
    operation: SyncOperation,
    options?: { priority?: "low" | "normal" | "high"; ttl?: number },
  ): Promise<void> {
    const entries = await this.loadEntries();
    const now = operation.timestamp;

    // Check for duplicate — update timestamp if found
    const existingIndex = entries.findIndex((e) =>
      this.isDuplicate(e, operation),
    );

    if (existingIndex !== -1) {
      entries[existingIndex].timestamp = now;
      await this.saveEntries(entries);
      return;
    }

    // Evict if at capacity
    if (entries.length >= this.maxSize) {
      entries.sort((a, b) => {
        // Sort by priority ascending (lowest first), then timestamp ascending (oldest first)
        const pDiff =
          (PRIORITY_ORDER[a.priority] ?? 2) -
          (PRIORITY_ORDER[b.priority] ?? 2);
        if (pDiff !== 0) return pDiff;
        return a.timestamp - b.timestamp;
      });
      entries.shift(); // Remove the lowest-priority, oldest entry
    }

    const entry: OfflineQueueEntry = {
      id: this.generateId(),
      key: operation.key,
      value: operation.value,
      operation: operation.operation,
      timestamp: now,
      ttl: options?.ttl ?? this.defaultTTL,
      priority: options?.priority ?? "normal",
    };

    entries.push(entry);
    await this.saveEntries(entries);
  }

  /**
   * Remove and return all expired entries, returning the survivors.
   */
  private async pruneExpired(
    entries: OfflineQueueEntry[],
  ): Promise<OfflineQueueEntry[]> {
    const now = Date.now();
    const active = entries.filter((e) => now - e.timestamp < e.ttl);
    if (active.length !== entries.length) {
      await this.saveEntries(active);
    }
    return active;
  }

  /**
   * Return the next entry without removing it.
   * Expired entries are filtered out before peeking.
   */
  async peek(): Promise<OfflineQueueEntry | null> {
    let entries = await this.loadEntries();
    entries = await this.pruneExpired(entries);

    if (entries.length === 0) return null;

    // Find the highest priority, oldest entry
    let best = entries[0];
    for (let i = 1; i < entries.length; i++) {
      const e = entries[i];
      const bestP = PRIORITY_ORDER[best.priority] ?? 2;
      const eP = PRIORITY_ORDER[e.priority] ?? 2;
      if (eP > bestP || (eP === bestP && e.timestamp < best.timestamp)) {
        best = e;
      }
    }
    return best;
  }

  /**
   * Remove and return the next entry (highest priority, oldest first).
   * Expired entries are filtered out before dequeuing.
   */
  async dequeue(): Promise<OfflineQueueEntry | null> {
    let entries = await this.loadEntries();
    entries = await this.pruneExpired(entries);

    if (entries.length === 0) return null;

    // Find the best entry to dequeue
    let bestIndex = 0;
    let best = entries[0];
    for (let i = 1; i < entries.length; i++) {
      const e = entries[i];
      const bestP = PRIORITY_ORDER[best.priority] ?? 2;
      const eP = PRIORITY_ORDER[e.priority] ?? 2;
      if (eP > bestP || (eP === bestP && e.timestamp < best.timestamp)) {
        best = e;
        bestIndex = i;
      }
    }

    entries.splice(bestIndex, 1);
    await this.saveEntries(entries);
    return best;
  }

  /**
   * Return the number of pending (non-expired) operations.
   */
  async size(): Promise<number> {
    let entries = await this.loadEntries();
    entries = await this.pruneExpired(entries);
    return entries.length;
  }

  /**
   * Clear all queued operations.
   */
  async clear(): Promise<void> {
    await this.storage.remove(this.storageKey());
  }
}
