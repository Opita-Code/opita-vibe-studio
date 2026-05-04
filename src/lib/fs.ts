import { readFile, writeFile, listDir, createDir, deleteEntry } from "./ipc";
import type { FileNode } from "./types";

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Convierte un FileEntry (de Tauri IPC) a un FileNode (del modelo de dominio).
 */
function fileEntryToNode(entry: import("./ipc").FileEntry): FileNode {
  return {
    name: entry.name,
    path: entry.path,
    type: entry.is_dir ? "directory" : ("file" as const),
    size: entry.size,
    modifiedAt: new Date(entry.modified_at * 1000).toISOString(),
    extension: entry.is_dir
      ? undefined
      : entry.name.includes(".")
        ? entry.name.split(".").pop()?.toLowerCase()
        : undefined,
  };
}

/**
 * Ordena nodos: directorios primero, luego archivos, alfabético dentro de cada grupo.
 */
function sortNodes(a: FileNode, b: FileNode): number {
  if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
  return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

// ─── Project Operations ─────────────────────────────────────────

/**
 * Carga recursivamente el contenido de un directorio como FileNode[].
 */
export async function loadProject(path: string): Promise<FileNode[]> {
  const entries = await listDir(path);
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const node = fileEntryToNode(entry);
    if (node.type === "directory") {
      try {
        node.children = await loadProject(entry.path);
      } catch {
        // Si no se puede leer un subdirectorio (ej: sin permisos),
        // lo incluimos sin hijos
        node.children = [];
      }
    }
    nodes.push(node);
  }

  nodes.sort(sortNodes);
  return nodes;
}

// ─── File Operations ────────────────────────────────────────────

/** Lee el contenido de un archivo como string. */
export async function readFileContent(path: string): Promise<string> {
  return readFile(path);
}

/** Escribe contenido en un archivo. */
export async function saveFileContent(path: string, content: string): Promise<void> {
  return writeFile(path, content);
}

/** Crea un archivo vacío. */
export async function createFileItem(path: string): Promise<void> {
  await writeFile(path, "");
}

/** Crea un directorio (y padres si es necesario). */
export { createDir };

/** Elimina un archivo o directorio (→ papelera de reciclaje). */
export { deleteEntry };

// ─── Git Detection ──────────────────────────────────────────────

/** Detecta si un directorio contiene un repositorio git. */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    const entries = await listDir(path);
    return entries.some((e) => e.name === ".git" && e.is_dir);
  } catch {
    return false;
  }
}
