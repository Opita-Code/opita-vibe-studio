import type { FileNode } from "../types";

/**
 * Strategy-pattern interface for file system operations.
 * Platform-agnostic: implemented by TauriFS (desktop) and BrowserFS (web).
 */
export interface FileSystemBackend {
  /** Human-readable backend identifier. */
  readonly label: "tauri" | "browser";

  /**
   * Lists the contents of a directory as FileNode[].
   * Each backend converts its native format to the domain model internally.
   */
  listDirectory(path: string): Promise<FileNode[]>;

  /** Reads a file's contents as a UTF-8 string. */
  readFile(path: string): Promise<string>;

  /** Writes content to a file, creating it if necessary. */
  writeFile(path: string, content: string): Promise<void>;

  /** Creates a directory (and parents if needed). */
  createDirectory(path: string): Promise<void>;

  /** Deletes a file or directory. */
  deleteEntry(path: string): Promise<void>;

  /** Renames a file or directory. */
  renameEntry(oldPath: string, newPath: string): Promise<void>;

  /**
   * Opens a platform-native directory picker dialog.
   * Returns the selected path, or null if the user cancels.
   */
  selectDirectory(): Promise<string | null>;

  /** Returns true if this backend is usable in the current environment. */
  isAvailable(): boolean;

  /**
   * Detects if a directory is a git repository.
   * Optional — BrowserFS may not support this.
   */
  isGitRepo?(path: string): Promise<boolean>;

  /**
   * Watches a directory for changes.
   * Optional — BrowserFS does not support file watching.
   * Returns a stop/unwatch function.
   */
  watchDir?(path: string, cb: () => void): Promise<() => void>;
}

export type { FileNode };
