/**
 * File Snapshot System — undo support for agent file modifications.
 *
 * Saves a copy of file contents before each destructive operation
 * (write_file, apply_diff, delete_file) so changes can be reverted.
 */

// ─── Types ─────────────────────────────────────────────────────

interface FileSnapshot {
  path: string;
  content: string; // Original content before modification
  timestamp: number;
  operation: "write" | "diff" | "delete";
}

// ─── State ─────────────────────────────────────────────────────

const MAX_SNAPSHOTS = 20;
const snapshots: FileSnapshot[] = [];

// ─── Public API ────────────────────────────────────────────────

/**
 * Save a snapshot of a file before modifying it.
 * Call this BEFORE write_file, apply_diff, or delete_file.
 */
export function saveSnapshot(
  path: string,
  content: string,
  operation: FileSnapshot["operation"],
): void {
  snapshots.push({
    path,
    content,
    timestamp: Date.now(),
    operation,
  });

  // Enforce max limit (FIFO)
  while (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.shift();
  }
}

/**
 * Get the last snapshot for a specific file path.
 * Returns null if no snapshot exists.
 */
export function getLastSnapshot(path: string): FileSnapshot | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].path === path) {
      return snapshots[i];
    }
  }
  return null;
}

/**
 * Pop and return the most recent snapshot (regardless of path).
 * Used by the "undo" action.
 */
export function popLastSnapshot(): FileSnapshot | null {
  return snapshots.pop() || null;
}

/**
 * Get all snapshots (for debugging/UI display).
 */
export function getAllSnapshots(): ReadonlyArray<FileSnapshot> {
  return snapshots;
}

/**
 * Restore the most recent snapshot by writing the original content
 * back to the file system and updating the editor.
 * Returns the restored snapshot, or null if nothing to restore.
 */
export async function restoreLastSnapshot(): Promise<FileSnapshot | null> {
  const snapshot = popLastSnapshot();
  if (!snapshot) return null;

  try {
    const { saveFileContent } = await import("@/lib/fs");
    const { useProjectStore } = await import("@/stores/project");
    const store = useProjectStore.getState();
    const workspace = store.workspaces.find(
      (w) => w.id === store.activeWorkspaceId,
    );

    if (!workspace) return snapshot; // Return snapshot data even if can't write

    const sep = workspace.path.includes("\\") ? "\\" : "/";
    const fullPath = `${workspace.path}${sep}${snapshot.path.replace(/\//g, sep)}`;

    await saveFileContent(fullPath, snapshot.content);
    store.setFileContent(fullPath, snapshot.content);
    await store.openFile(fullPath);

    return snapshot;
  } catch {
    // If restore fails, return the snapshot anyway so the content isn't lost
    return snapshot;
  }
}

/**
 * Clear all snapshots.
 */
export function clearSnapshots(): void {
  snapshots.length = 0;
}
