import type { FileSystemBackend } from "../../../src/lib/fs-backend/types";
import type { FileNode } from "../../../src/lib/types";

/**
 * Mock implementation of FileSystemBackend for testing fs.ts domain logic.
 * Provides a controlled in-memory file system that can be pre-populated.
 */
export class MockFileSystemBackend implements FileSystemBackend {
  readonly label = "tauri" as const;
  readonly files: Map<string, string | null> = new Map(); // path → content (null = directory)

  constructor(initial?: Record<string, string | null>) {
    if (initial) {
      for (const [path, content] of Object.entries(initial)) {
        this.files.set(path, content);
      }
    }
  }

  isAvailable(): boolean {
    return true;
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`File not found: ${path}`);
    if (content === null) throw new Error(`Is a directory: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async listDirectory(path: string): Promise<FileNode[]> {
    const prefix = path === "/" ? "" : path;
    const entries: FileNode[] = [];

    for (const filePath of this.files.keys()) {
      if (!filePath.startsWith(prefix + "/") && filePath !== prefix) continue;
      if (filePath === prefix) continue;

      const relative = filePath.slice((prefix + "/").length);
      // Only direct children, no nested
      if (relative.includes("/")) continue;

      const isDir = this.files.get(filePath) === null;
      entries.push({
        name: relative,
        path: filePath,
        type: isDir ? "directory" : "file",
        size: isDir ? undefined : (this.files.get(filePath)?.length ?? 0),
        extension: isDir
          ? undefined
          : relative.includes(".")
            ? relative.split(".").pop()?.toLowerCase()
            : undefined,
      });
    }

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
    });

    return entries;
  }

  async createDirectory(path: string): Promise<void> {
    this.files.set(path, null);
  }

  async deleteEntry(path: string): Promise<void> {
    this.files.delete(path);
    // Also delete children
    for (const key of this.files.keys()) {
      if (key.startsWith(path + "/")) {
        this.files.delete(key);
      }
    }
  }

  async selectDirectory(): Promise<string | null> {
    return "/mock/selected";
  }
}
