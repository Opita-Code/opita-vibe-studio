import type { FileNode } from "../types";
import type { FileSystemBackend } from "./types";

// ─── Type declarations for File System Access API ────────────────
// TypeScript DOM lib does not include these newer APIs.
// We use minimal interface declarations to keep type safety.

interface FSAFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FSAWritable>;
}

interface FSAWritable {
  write(content: string): Promise<void>;
  close(): Promise<void>;
}

interface FSADirHandle {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, FSAFileHandle | FSADirHandle]>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FSADirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FSAFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  queryPermission(descriptor: { mode: string }): Promise<"granted" | "denied" | "prompt">;
  requestPermission(descriptor: { mode: string }): Promise<"granted" | "denied" | "prompt">;
}

// ─── IndexedDB Constants ─────────────────────────────────────────

const DB_NAME = "vibe-studio-browserfs";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const HANDLE_KEY = "root-handle";

/**
 * BrowserFS: FileSystemBackend implementation using the File System Access API.
 *
 * Works in Chromium-based browsers that support `window.showDirectoryPicker()`.
 * Directory handles are persisted in IndexedDB for session restoration.
 * Virtual paths are resolved relative to the root directory handle.
 */
export class BrowserFS implements FileSystemBackend {
  readonly label = "browser" as const;

  private rootHandle: FSADirHandle | null = null;

  // ─── Lifecycle ─────────────────────────────────────────────

  isAvailable(): boolean {
    return typeof window !== "undefined" && 
      ("showDirectoryPicker" in window || ("storage" in navigator && "getDirectory" in navigator.storage));
  }

  async selectDirectory(): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      if ("showDirectoryPicker" in window) {
        // Modo Escritorio: File System Access API nativo
        const win = window as unknown as { showDirectoryPicker(): Promise<FSADirHandle> };
        const handle = await win.showDirectoryPicker();
        this.rootHandle = handle;
        await this.storeHandle(handle);
        return handle.name;
      } else {
        // Modo Móvil: OPFS (Origin Private File System)
        const projectName = prompt("Ingresa el nombre de tu nuevo proyecto (Nube Local):", "mi-proyecto");
        if (!projectName || !projectName.trim()) return null;
        
        const cleanName = projectName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
        
        const opfsRoot = await navigator.storage.getDirectory() as unknown as FSADirHandle;
        const projectHandle = await opfsRoot.getDirectoryHandle(cleanName, { create: true });
        
        this.rootHandle = projectHandle;
        await this.storeHandle(projectHandle);
        return cleanName;
      }
    } catch {
      // User cancelled or API error
      return null;
    }
  }

  // ─── Handle Management ─────────────────────────────────────

  /**
   * Stores the directory handle in IndexedDB for session restoration.
   * Note: FileSystemDirectoryHandle is not JSON-serializable, so we store
   * the native handle directly in IndexedDB (which supports it).
   */
  private async storeHandle(handle: FSADirHandle): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Retrieves the stored directory handle from IndexedDB.
   * Verifies permission before returning — if permission is lost,
   * attempts to re-request it. Returns null if no handle is stored
   * or permission was denied.
   */
  async getStoredHandle(): Promise<FSADirHandle | null> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);

      const handle: FSADirHandle | undefined = await new Promise(
        (resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );

      if (!handle) return null;

      // OPFS handles (Mobile) might not have or need permission checks
      if (typeof handle.queryPermission !== "function") {
        return handle;
      }

      // Verify permission for native OS handles
      const permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission === "granted") return handle;

      // Re-request if not granted
      const newPermission = await handle.requestPermission({ mode: "readwrite" });
      return newPermission === "granted" ? handle : null;
    } catch {
      return null;
    }
  }

  /**
   * Clears the stored handle from IndexedDB.
   */
  async clearHandle(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore errors on clear
    }
  }

  // ─── Internal Handle Resolution ────────────────────────────

  /**
   * Returns the root handle, attempting restoration from IndexedDB if not set.
   */
  private async getOrRestoreHandle(): Promise<FSADirHandle> {
    if (this.rootHandle) return this.rootHandle;

    const handle = await this.getStoredHandle();
    if (!handle) throw new Error("No se seleccionó ninguna carpeta. Abre una carpeta primero.");

    this.rootHandle = handle;
    return handle;
  }

  // ─── File System Operations ────────────────────────────────

  async readFile(path: string): Promise<string> {
    const handle = await this.getOrRestoreHandle();
    const fileHandle = await resolveFileHandle(handle, path);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = await this.getOrRestoreHandle();
    const relPath = getRelativePath(handle, path);
    const parts = relPath.split("/").filter(Boolean);
    const fileName = parts.pop()!;

    let current = handle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async listDirectory(path: string): Promise<FileNode[]> {
    const handle = await this.getOrRestoreHandle();
    const dirHandle = await resolveDirectoryHandle(handle, path);

    const nodes: FileNode[] = [];

    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === "file") {
        nodes.push({
          name,
          path: normalizePath(path, name),
          type: "file",
          size: 0,
          extension: name.includes(".")
            ? name.split(".").pop()?.toLowerCase()
            : undefined,
        });
      } else {
        nodes.push({
          name,
          path: normalizePath(path, name),
          type: "directory",
        });
      }
    }

    return nodes;
  }

  async createDirectory(path: string): Promise<void> {
    const handle = await this.getOrRestoreHandle();
    await resolveDirectoryHandle(handle, path, true);
  }

  async deleteEntry(path: string): Promise<void> {
    const handle = await this.getOrRestoreHandle();
    const relPath = getRelativePath(handle, path);
    const parts = relPath.split("/").filter(Boolean);
    const name = parts.pop()!;

    let current = handle;
    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    await current.removeEntry(name, { recursive: true });
  }

  async renameEntry(oldPath: string, newPath: string): Promise<void> {
    const handle = await this.getOrRestoreHandle();
    
    // Simplificación MVP: Leer, escribir nuevo, eliminar viejo.
    // Solo soportado para archivos por ahora en Web, o usar move() si está disponible.
    try {
      const oldFileHandle = await resolveFileHandle(handle, oldPath) as any;
      
      const newRelPath = getRelativePath(handle, newPath);
      const newParts = newRelPath.split("/").filter(Boolean);
      const newName = newParts.pop()!;
      let newDir = handle;
      for (const part of newParts) {
        newDir = await newDir.getDirectoryHandle(part, { create: true });
      }

      if (typeof oldFileHandle.move === 'function') {
        await oldFileHandle.move(newDir, newName);
      } else {
        // Fallback: copy and delete
        const file = await oldFileHandle.getFile();
        const content = await file.text();
        const newFileHandle = await newDir.getFileHandle(newName, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        
        await this.deleteEntry(oldPath);
      }
    } catch (e) {
      console.warn("Rename fallback failed, might be a directory or not supported", e);
      throw new Error("No se pudo renombrar en la versión Web. Intenta creando un archivo nuevo.");
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Opens (or creates) the IndexedDB database for handle storage.
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getRelativePath(root: FSADirHandle, path: string): string {
  if (path === root.name) return "";
  if (path.startsWith(root.name + "/")) {
    return path.substring(root.name.length + 1);
  }
  return path;
}

/**
 * Resolves a virtual file path to a FileSystemFileHandle,
 * walking through directory handles as needed.
 */
async function resolveFileHandle(
  root: FSADirHandle,
  path: string,
): Promise<FSAFileHandle> {
  const relPath = getRelativePath(root, path);
  const parts = relPath.split("/").filter(Boolean);
  const fileName = parts.pop()!;

  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part);
  }

  return current.getFileHandle(fileName);
}

/**
 * Resolves a virtual directory path to a FileSystemDirectoryHandle.
 * Optionally creates intermediate directories when `create` is true.
 */
async function resolveDirectoryHandle(
  root: FSADirHandle,
  path: string,
  create = false,
): Promise<FSADirHandle> {
  const relPath = getRelativePath(root, path);
  if (relPath === "/" || relPath === "") return root;

  const parts = relPath.split("/").filter(Boolean);
  let current = root;
  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }
  return current;
}

/**
 * Normalizes a path + name into a virtual path string.
 */
function normalizePath(base: string, name: string): string {
  const normalizedBase = base === "/" ? "" : base;
  return `${normalizedBase}/${name}`;
}
