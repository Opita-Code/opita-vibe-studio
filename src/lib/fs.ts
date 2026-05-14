import { getFileSystemBackend } from "./fs-backend";
import type { FileNode } from "./types";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".vscode",
  "out"
]);

// ─── Helpers ────────────────────────────────────────────────────

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
  const entries = await getFileSystemBackend().listDirectory(path);
  const nodes: FileNode[] = [];

  for (const node of entries) {
    if (node.type === "directory") {
      if (IGNORE_DIRS.has(node.name)) {
        node.children = [];
      } else {
        try {
          node.children = await loadProject(node.path);
        } catch {
          // Si no se puede leer un subdirectorio (ej: sin permisos),
          // lo incluimos sin hijos
          node.children = [];
        }
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
  return getFileSystemBackend().readFile(path);
}

/** Escribe contenido en un archivo. */
export async function saveFileContent(path: string, content: string): Promise<void> {
  return getFileSystemBackend().writeFile(path, content);
}

/** Crea un archivo vacío. */
export async function createFileItem(path: string): Promise<void> {
  await getFileSystemBackend().writeFile(path, "");
}

/** Crea un directorio (y padres si es necesario). */
export async function createDir(path: string): Promise<void> {
  return getFileSystemBackend().createDirectory(path);
}

/** Elimina un archivo o directorio (→ papelera de reciclaje). */
export async function deleteEntry(path: string): Promise<void> {
  return getFileSystemBackend().deleteEntry(path);
}

/** Renombra o mueve un archivo/directorio. */
export async function renameEntry(oldPath: string, newPath: string): Promise<void> {
  return getFileSystemBackend().renameEntry(oldPath, newPath);
}

// ─── Git Detection ──────────────────────────────────────────────

/** Detecta si un directorio contiene un repositorio git. */
export async function isGitRepo(path: string): Promise<boolean> {
  try {
    const entries = await getFileSystemBackend().listDirectory(path);
    return entries.some((e) => e.name === ".git" && e.type === "directory");
  } catch {
    return false;
  }
}
