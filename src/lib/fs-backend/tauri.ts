import { readFile, writeFile, listDir, createDir, deleteEntry, openFolderDialog } from "../ipc";
import type { FileEntry } from "../ipc";
import type { FileNode } from "../types";
import type { FileSystemBackend } from "./types";

/**
 * TauriFS: FileSystemBackend implementation for Tauri desktop.
 *
 * Delegates all I/O to Tauri IPC calls and converts IPC types to domain types.
 */
export class TauriFS implements FileSystemBackend {
  readonly label = "tauri" as const;

  isAvailable(): boolean {
    return true;
  }

  async readFile(path: string): Promise<string> {
    return readFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    return writeFile(path, content);
  }

  async listDirectory(path: string): Promise<FileNode[]> {
    const entries: FileEntry[] = await listDir(path);
    return entries.map(fileEntryToNode);
  }

  async createDirectory(path: string): Promise<void> {
    return createDir(path);
  }

  async deleteEntry(path: string): Promise<void> {
    return deleteEntry(path);
  }

  async renameEntry(oldPath: string, newPath: string): Promise<void> {
    const { renameEntry } = await import("../ipc");
    return renameEntry(oldPath, newPath);
  }

  async selectDirectory(): Promise<string | null> {
    return openFolderDialog();
  }
}

// ─── Conversion ─────────────────────────────────────────────────

/**
 * Converts a FileEntry (from Tauri IPC) to a FileNode (domain model).
 */
function fileEntryToNode(entry: FileEntry): FileNode {
  return {
    name: entry.name,
    path: entry.path,
    type: entry.is_dir ? "directory" : "file",
    size: entry.size,
    modifiedAt: new Date(entry.modified_at * 1000).toISOString(),
    extension: entry.is_dir
      ? undefined
      : entry.name.includes(".")
        ? entry.name.split(".").pop()?.toLowerCase()
        : undefined,
  };
}
