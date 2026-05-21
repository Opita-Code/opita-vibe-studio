/**
 * MemoryStorageAdapter
 *
 * In-memory Map-based StorageBackend implementation.
 * Ideal for testing (Node.js) and as a no-persistence fallback.
 *
 * All values are kept in a plain JavaScript Map. No serialization
 * overhead — any value type is supported.
 */
import type { StorageBackend } from "../types";

export class MemoryStorageAdapter implements StorageBackend {
  private store: Map<string, unknown>;

  constructor() {
    this.store = new Map<string, unknown>();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = this.store.get(key);
    if (value === undefined) {
      return null;
    }
    return value as T;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async keys(prefix: string): Promise<string[]> {
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }
}
