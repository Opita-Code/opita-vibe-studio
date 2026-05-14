import { isTauri, getPlatform } from "../platform";
import type { FileSystemBackend } from "./types";
import { TauriFS } from "./tauri";
import { BrowserFS } from "./browser";

// ─── Singleton Backend ──────────────────────────────────────────

let _backend: FileSystemBackend | null = null;

/**
 * Creates the appropriate FileSystemBackend based on the current platform.
 * Returns a TauriFS when running inside Tauri, or BrowserFS in web mode.
 * BrowserFS will have its root handle set when the user picks a folder.
 */
export function createFileSystemBackend(): FileSystemBackend | null {
  if (isTauri()) {
    return new TauriFS();
  }
  if (getPlatform() === "browser") {
    return new BrowserFS();
  }
  return null;
}

/**
 * Sets the active file system backend (singleton).
 * Used during app initialization.
 */
export function setFileSystemBackend(backend: FileSystemBackend | null): void {
  _backend = backend;
}

/**
 * Returns the active file system backend (singleton).
 * Must be called after initialization.
 */
export function getFileSystemBackend(): FileSystemBackend {
  if (!_backend) {
    throw new Error(
      "FileSystemBackend not initialized. Call createFileSystemBackend() or setFileSystemBackend() during app startup.",
    );
  }
  return _backend;
}
