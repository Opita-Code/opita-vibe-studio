/**
 * Migration helper — migrates guest/local data to the cloud on first OAuth login.
 *
 * Reads entries from the local storage backend and writes them to Supabase via
 * the CloudBridge. Only migrates entries that start with known guest data prefixes.
 * Skips internal keys (sync, queue, migration markers).
 *
 * Once migration completes, a `migration:completed` marker is stored locally
 * to prevent re-migration.
 */
import type { StorageBackend } from "../types";

export interface CloudBridgeWriter {
  writeContext(userId: string, key: string, value: unknown, timestamp: number): Promise<void>;
}

export interface MigrationOptions {
  /** Authenticated user's Supabase ID */
  userId: string;
  /** Local storage backend (guest data source) */
  storage: StorageBackend;
  /** Cloud bridge for writing to Supabase */
  cloudBridge: CloudBridgeWriter;
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  alreadyMigrated: boolean;
  error?: string;
}

const MIGRATION_MARKER_KEY = "migration:completed";

// Prefixes of keys that contain migratable guest data
const MIGRATABLE_PREFIXES = ["prefs:", "learning:"];

// Keys to always exclude from migration
const EXCLUDED_KEYS = [
  "sync:",
  "offline-queue",
  MIGRATION_MARKER_KEY,
];

/**
 * Strip the prefix from a storage key to determine the cloud context key.
 * E.g. "prefs:theme" → "theme", "learning:shownTips" → "shownTips"
 */
function toContextKey(storageKey: string): string {
  for (const prefix of MIGRATABLE_PREFIXES) {
    if (storageKey.startsWith(prefix)) {
      return storageKey.slice(prefix.length);
    }
  }
  return storageKey;
}

/**
 * Check if a storage key is eligible for migration.
 */
function isMigratable(key: string): boolean {
  for (const excluded of EXCLUDED_KEYS) {
    if (key === excluded || key.startsWith(excluded)) {
      return false;
    }
  }
  for (const prefix of MIGRATABLE_PREFIXES) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Migrate guest data from local storage to the cloud.
 *
 * Scans the storage backend for guest data entries, writes each to Supabase
 * via the cloudBridge, and marks migration as completed.
 */
export async function migrateGuestData(
  options: MigrationOptions,
): Promise<MigrationResult> {
  const { userId, storage, cloudBridge } = options;

  // ── Check if already migrated ──
  const alreadyMigrated = await storage.get<{ migratedAt: string; userId: string }>(
    MIGRATION_MARKER_KEY,
  );
  if (alreadyMigrated) {
    return {
      success: true,
      migratedCount: 0,
      alreadyMigrated: true,
    };
  }

  // ── Collect migratable entries ──
  const allKeys = await storage.keys("");
  const migratableKeys = allKeys.filter(isMigratable);

  if (migratableKeys.length === 0) {
    // No data to migrate — still mark as done
    await storage.set(MIGRATION_MARKER_KEY, {
      migratedAt: new Date().toISOString(),
      userId,
    });
    return {
      success: true,
      migratedCount: 0,
      alreadyMigrated: false,
    };
  }

  // ── Migrate each entry ──
  const timestamp = Date.now();
  let migratedCount = 0;

  for (const key of migratableKeys) {
    const value = await storage.get(key);
    if (value === null) continue;

    try {
      const contextKey = toContextKey(key);
      await cloudBridge.writeContext(userId, contextKey, value, timestamp);
      migratedCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        migratedCount: 0,
        alreadyMigrated: false,
        error: message,
      };
    }
  }

  // ── Mark as completed ──
  await storage.set(MIGRATION_MARKER_KEY, {
    migratedAt: new Date().toISOString(),
    userId,
  });

  return {
    success: true,
    migratedCount,
    alreadyMigrated: false,
  };
}
