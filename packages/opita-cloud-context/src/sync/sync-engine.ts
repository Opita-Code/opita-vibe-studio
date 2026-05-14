/**
 * SyncEngine — orchestrates bidirectional sync between local storage and Supabase cloud.
 *
 * Uses last-write-wins (LWW) merge strategy: when local and cloud data for the
 * same key conflict, the entry with the newer timestamp wins.
 *
 * Flow:
 *   pull(userId)  → fetch cloud keys → LWW merge → store locally
 *   push(userId)  → read local entries → write new/updated to cloud
 *   sync(userId)  → pull then push
 */
import type { StorageBackend } from "../types";

const PREFIX = "sync:";
const LAST_PULL_KEY = "sync:lastPull";
const PUSH_WATERMARK_KEY = "sync:pushWatermark";

export interface CloudBridgeClient {
  readContext(userId: string, key: string): Promise<{ value: unknown; timestamp: number } | null>;
  writeContext(userId: string, key: string, value: unknown, timestamp: number): Promise<void>;
  listContextKeys(userId: string): Promise<string[]>;
}

export interface SyncEngineOptions {
  storage: StorageBackend;
  cloudBridge: CloudBridgeClient;
}

export class SyncEngine {
  private storage: StorageBackend;
  private cloudBridge: CloudBridgeClient;

  constructor(options: SyncEngineOptions) {
    this.storage = options.storage;
    this.cloudBridge = options.cloudBridge;
  }

  /**
   * Pull cloud context for a user and merge into local storage.
   * Last-write-wins: for each key, the entry with the later timestamp wins.
   */
  async pull(userId: string): Promise<void> {
    const cloudKeys = await this.cloudBridge.listContextKeys(userId);

    for (const key of cloudKeys) {
      const cloudEntry = await this.cloudBridge.readContext(userId, key);
      if (!cloudEntry) continue;

      const storageKey = `${PREFIX}${key}`;
      const localRaw = await this.storage.get<string>(storageKey);
      const localEntry = localRaw ? (JSON.parse(localRaw) as { value: unknown; timestamp: number }) : null;

      // LWW: only store if cloud is newer or local doesn't exist
      if (!localEntry || cloudEntry.timestamp >= localEntry.timestamp) {
        await this.storage.set(
          storageKey,
          JSON.stringify({ value: cloudEntry.value, timestamp: cloudEntry.timestamp }),
        );
      }
    }

    await this.storage.set(LAST_PULL_KEY, Date.now());
  }

  /**
   * Push local unsynced entries to the cloud.
   * Only pushes entries whose timestamp is newer than the push watermark.
   */
  async push(userId: string): Promise<void> {
    const watermark = await this.storage.get<number>(PUSH_WATERMARK_KEY);
    const lastPush = watermark ?? 0;

    // Collect all local sync entries
    const allKeys = await this.storage.keys(PREFIX);
    let maxTimestamp = lastPush;

    for (const key of allKeys) {
      if (key === LAST_PULL_KEY || key === PUSH_WATERMARK_KEY) continue;

      const raw = await this.storage.get<string>(key);
      if (!raw) continue;

      const entry = JSON.parse(raw) as { value: unknown; timestamp: number };
      if (entry.timestamp > lastPush) {
        const contextKey = key.slice(PREFIX.length);
        await this.cloudBridge.writeContext(userId, contextKey, entry.value, entry.timestamp);
        if (entry.timestamp > maxTimestamp) {
          maxTimestamp = entry.timestamp;
        }
      }
    }

    await this.storage.set(PUSH_WATERMARK_KEY, maxTimestamp);
  }

  /**
   * Perform a full bidirectional sync: pull from cloud, then push local changes.
   */
  async sync(userId: string): Promise<void> {
    await this.pull(userId);
    await this.push(userId);
  }
}
