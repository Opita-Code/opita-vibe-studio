import JSZip from "jszip";
import type { FileNode } from "./types";
import type { FileSystemBackend } from "./fs-backend/types";

// ─── Exclusions ───────────────────────────────────────────────────

/** Directory names that are always excluded from export. */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "target",
]);

// ─── Types ────────────────────────────────────────────────────────

export interface ExportProgress {
  current: number;
  total: number;
}

// ─── Internal Helpers ─────────────────────────────────────────────

function isExcluded(name: string): boolean {
  return EXCLUDED_DIRS.has(name);
}

/**
 * Recursively collects all file entries from a FileNode tree,
 * skipping excluded directories and their contents.
 * Returns flat array of { path, relativePath } pairs.
 */
function collectFiles(
  nodes: FileNode[],
  prefix: string = "",
): { path: string; relativePath: string }[] {
  const result: { path: string; relativePath: string }[] = [];

  for (const node of nodes) {
    // Skip excluded directories entirely
    if (isExcluded(node.name)) continue;

    if (node.type === "file") {
      result.push({ path: node.path, relativePath: prefix + node.name });
    } else if (node.type === "directory" && node.children) {
      result.push(...collectFiles(node.children, prefix + node.name + "/"));
    }
  }

  return result;
}

// ─── Main Export Function ─────────────────────────────────────────

/**
 * Creates a ZIP archive of the project files.
 *
 * @param files - The recursive FileNode tree (from projectStore.files).
 * @param rootPath - The root directory path (used for display, not for I/O).
 * @param backend - The active FileSystemBackend to read file contents.
 * @param onProgress - Optional callback invoked per file with current/total.
 * @returns A Blob containing the ZIP archive with MIME type application/zip.
 */
export async function exportProjectAsZip(
  files: FileNode[],
  _rootPath: string,
  backend: FileSystemBackend,
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const zip = new JSZip();
  const fileEntries = collectFiles(files);
  const total = fileEntries.length;

  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i];
    onProgress?.({ current: i + 1, total });

    try {
      const content = await backend.readFile(entry.path);
      zip.file(entry.relativePath, content);
    } catch {
      // Skip file on read error — continue with remaining files
    }
  }

  return zip.generateAsync({ type: "blob" });
}
