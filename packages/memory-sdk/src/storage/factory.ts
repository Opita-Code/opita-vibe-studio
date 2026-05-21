/**
 * Storage Factory
 *
 * Returns the appropriate StorageBackend implementation based on the
 * current platform (Tauri, Browser, or Node.js).
 *
 * Platform mappings:
 * - "tauri"   → WebStorageAdapter (Tauri runs on WebView2 with IndexedDB)
 * - "browser" → WebStorageAdapter (IndexedDB-primary, localStorage fallback)
 * - "node"    → MemoryStorageAdapter (in-memory Map, for testing/CLI)
 */
import type { StorageBackend } from "../types";
import type { Platform } from "./platform";
import { WebStorageAdapter } from "./web-storage";
import { MemoryStorageAdapter } from "./memory-storage";

/**
 * Create a storage backend appropriate for the given platform.
 *
 * @param platform - The detected platform type
 * @param namespace - Optional namespace for scoped storage (used by WebStorageAdapter)
 */
export function createStorageBackend(
  platform: Platform,
  namespace?: string,
): StorageBackend {
  switch (platform) {
    case "tauri":
    case "browser":
      return new WebStorageAdapter(namespace ?? "opita-cloud");
    case "node":
      return new MemoryStorageAdapter();
    default: {
      // TypeScript exhaustiveness check — all cases handled above
      const _exhaustive: never = platform;
      throw new Error(`Unknown platform: ${_exhaustive}`);
    }
  }
}
