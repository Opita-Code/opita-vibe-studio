/**
 * OPFS Persistence — Silent auto-save using Origin Private File System.
 *
 * Persists workspace file contents to OPFS (browser-native storage) without
 * requiring ANY user permission prompts. This is the primary persistence
 * layer for browser mode — data survives tab close, browser restart, and
 * cache clearing.
 *
 * Architecture:
 * - Zustand fileContents → serialized JSON → OPFS file
 * - Auto-saves every PERSIST_INTERVAL_MS (5 min)
 * - Saves on `beforeunload` event (tab close)
 * - Restores automatically on app startup
 *
 * OPFS is available in all modern browsers (Chrome 86+, Firefox 111+, Safari 15.2+).
 * Falls back silently to no-op if OPFS is unavailable.
 */

// ─── Constants ──────────────────────────────────────────────────

const PERSIST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const OPFS_DIR = "vibe-workspaces";

// ─── Types ──────────────────────────────────────────────────────

interface PersistedWorkspace {
  /** Workspace ID (path or template:// URI) */
  id: string;
  /** Display name */
  name: string;
  /** File contents map: full path → content string */
  files: Record<string, string>;
  /** Open tabs */
  openTabs: string[];
  /** Active tab */
  activeTab: string | null;
  /** Timestamp of last persist */
  savedAt: number;
}

// ─── OPFS Helpers ───────────────────────────────────────────────

/** Check if OPFS is available in this browser. */
function isOPFSAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    "getDirectory" in navigator.storage
  );
}

/** Get or create the vibe-workspaces directory in OPFS. */
async function getVibeDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

/** Sanitize workspace ID to a safe filename. */
function toFileName(workspaceId: string): string {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Persists a workspace's file contents to OPFS.
 * Completely silent — no prompts, no errors surfaced to user.
 */
export async function persistToOPFS(
  workspaceId: string,
  workspaceName: string,
  fileContents: Record<string, string>,
  openTabs: string[],
  activeTab: string | null,
): Promise<void> {
  if (!isOPFSAvailable()) return;

  try {
    const dir = await getVibeDir();
    const fileName = toFileName(workspaceId);
    const fileHandle = await dir.getFileHandle(fileName, { create: true });

    const data: PersistedWorkspace = {
      id: workspaceId,
      name: workspaceName,
      files: fileContents,
      openTabs,
      activeTab,
      savedAt: Date.now(),
    };

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data));
    await writable.close();
  } catch (err: unknown) {
    // P0 fix: surface critical persistence errors instead of swallowing them.
    // QuotaExceededError means the user's work won't survive tab close.
    console.error("[OPFS Persistence] Failed to persist workspace:", err);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("vibe:persist-error", {
          detail: {
            workspaceId,
            error: err instanceof Error ? err.message : "Unknown error",
            isQuotaError: err instanceof DOMException && err.name === "QuotaExceededError",
          },
        }),
      );
    }
  }
}

/**
 * Restores a workspace from OPFS by workspace ID.
 * Returns null if not found or OPFS unavailable.
 */
export async function restoreFromOPFS(
  workspaceId: string,
): Promise<PersistedWorkspace | null> {
  if (!isOPFSAvailable()) return null;

  try {
    const dir = await getVibeDir();
    const fileName = toFileName(workspaceId);
    const fileHandle = await dir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as PersistedWorkspace;
  } catch {
    return null;
  }
}

/**
 * Lists all persisted workspaces in OPFS (for restore menu).
 * Returns basic metadata without full file contents.
 */
export async function listPersistedWorkspaces(): Promise<
  Array<{ id: string; name: string; savedAt: number }>
> {
  if (!isOPFSAvailable()) return [];

  try {
    const dir = await getVibeDir();
    const results: Array<{ id: string; name: string; savedAt: number }> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [, handle] of (dir as any).entries()) {
      if (handle.kind !== "file") continue;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        // P1 fix: only read first 1KB to extract metadata fields (id, name, savedAt)
        // instead of reading entire multi-MB workspace files into memory.
        const slice = file.slice(0, 1024);
        const text = await slice.text();
        // Extract just the metadata fields from the JSON prefix
        const idMatch = text.match(/"id"\s*:\s*"([^"]*)"/);
        const nameMatch = text.match(/"name"\s*:\s*"([^"]*)"/);
        const savedAtMatch = text.match(/"savedAt"\s*:\s*(\d+)/);
        if (idMatch && nameMatch && savedAtMatch) {
          results.push({
            id: idMatch[1],
            name: nameMatch[1],
            savedAt: Number(savedAtMatch[1]),
          });
        }
      } catch {
        // Skip corrupted entries
      }
    }

    return results.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/**
 * Deletes a persisted workspace from OPFS.
 */
export async function deleteFromOPFS(workspaceId: string): Promise<void> {
  if (!isOPFSAvailable()) return;

  try {
    const dir = await getVibeDir();
    const fileName = toFileName(workspaceId);
    await dir.removeEntry(fileName);
  } catch {
    // Silent failure
  }
}

// ─── Auto-Persist Timer ─────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;
// P1 fix: store callback reference so stopAutoPersist always cleans up
let _onTick: (() => void) | null = null;

/**
 * Starts the auto-persist timer. Should be called once at app startup.
 * The callback is invoked every PERSIST_INTERVAL_MS to trigger a save.
 */
export function startAutoPersist(onTick: () => void): void {
  stopAutoPersist();
  _onTick = onTick;
  _timer = setInterval(onTick, PERSIST_INTERVAL_MS);

  // Also persist on tab close
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", onTick);
  }
}

/**
 * Stops the auto-persist timer and removes the beforeunload listener.
 */
export function stopAutoPersist(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  if (_onTick && typeof window !== "undefined") {
    window.removeEventListener("beforeunload", _onTick);
  }
  _onTick = null;
}
