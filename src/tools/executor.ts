/**
 * Ejecutor de herramientas del agente de código.
 *
 * Recibe un ToolCall del parser, lo ejecuta contra el filesystem
 * real del proyecto, y retorna el resultado.
 *
 * Abstracción de filesystem:
 * - Web: usa lib/fs.ts → getFileSystemBackend() (OPFS / File System Access API)
 * - Desktop: usa lib/fs.ts que internamente delega a Tauri IPC
 */

import type { ToolCall, ToolResult } from "./definitions";
import type { FileNode } from "@/lib/types";
import { saveSnapshot } from "./fileSnapshot";
import { saveMemory, searchMemories } from "@/lib/memory";
import {
  readFileContent,
  saveFileContent,
  loadProject,
  deleteEntry,
} from "@/lib/fs";
import { useProjectStore } from "@/stores/project";

// ─── Virtual Workspace Detection ───────────────────────────────

/**
 * Returns true if the workspace ID is a virtual (in-memory) workspace.
 * Virtual workspaces use `template://` protocol and store files in Zustand,
 * NOT on the filesystem.
 */
export function isVirtualWorkspace(workspaceId: string | null): boolean {
  return typeof workspaceId === "string" && workspaceId.startsWith("template://");
}

/**
 * Sanitizes a path for use in the project:
 * 1. Strips template:// prefix if present
 * 2. Strips leading slashes
 * 3. Validates against path traversal attacks
 *
 * Returns a clean relative path like "src/App.tsx".
 */
export function sanitizePath(rawPath: string): string {
  let cleaned = rawPath;

  // Strip template:// protocol and template ID
  const templateMatch = cleaned.match(/^template:\/\/[^/]+\/(.+)$/);
  if (templateMatch) {
    cleaned = templateMatch[1];
  }

  // Strip leading slashes
  cleaned = cleaned.replace(/^[/\\]+/, "");

  // Validate — no traversal, no absolute paths, no nulls
  const forbidden = [
    "..",           // Path traversal
    "~",            // Home directory expansion
    "\0",           // Null byte injection
    "%2e%2e",       // URL-encoded ..
    "%2f",          // URL-encoded /
    "%5c",          // URL-encoded \
  ];

  const lower = cleaned.toLowerCase();
  if (forbidden.some((p) => lower.includes(p))) {
    throw new Error(
      "Ruta inválida: no se permiten rutas con caracteres de escape o traversal.",
    );
  }

  // Reject absolute paths (Unix or Windows) AFTER stripping
  if (
    /^[a-zA-Z]:/.test(cleaned) ||
    cleaned.startsWith("file:")
  ) {
    throw new Error(
      "Ruta inválida: no se permiten rutas absolutas. Usa rutas relativas al proyecto.",
    );
  }

  return cleaned;
}

// ─── Security ──────────────────────────────────────────────────

/** Valida que una ruta no escapa del proyecto. */
function validatePath(relativePath: string): void {
  const forbidden = [
    "..",           // Path traversal
    "~",            // Home directory expansion
    "\0",           // Null byte injection
    "%2e%2e",       // URL-encoded ..
    "%2f",          // URL-encoded /
    "%5c",          // URL-encoded \
  ];

  const lower = relativePath.toLowerCase();

  if (forbidden.some((p) => lower.includes(p))) {
    throw new Error(
      "Ruta inválida: no se permiten rutas con caracteres de escape o traversal.",
    );
  }

  // Reject absolute paths (Unix or Windows)
  if (
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\") ||
    /^[a-zA-Z]:/.test(relativePath) ||
    relativePath.startsWith("file:")
  ) {
    throw new Error(
      "Ruta inválida: no se permiten rutas absolutas. Usa rutas relativas al proyecto.",
    );
  }
}

/** Resuelve una ruta relativa al workspace activo. */
function resolveProjectPath(relativePath: string): string {
  const rootPath = useProjectStore.getState().activeWorkspaceId;
  if (!rootPath) {
    throw new Error(
      "No hay un proyecto abierto. Abre un proyecto primero para usar herramientas de código.",
    );
  }

  validatePath(relativePath);

  // Normalizar separadores
  const normalized = relativePath.replace(/\\/g, "/");
  const sep = rootPath.includes("\\") ? "\\" : "/";
  const resolved = `${rootPath}${sep}${normalized.replace(/\//g, sep)}`;

  // Final defense: verify resolved path is actually under the project root
  const normalizedRoot = rootPath.replace(/\\/g, "/").toLowerCase();
  const normalizedResolved = resolved.replace(/\\/g, "/").toLowerCase();
  if (!normalizedResolved.startsWith(normalizedRoot)) {
    throw new Error("Ruta inválida: la ruta resuelta escapa del directorio del proyecto.");
  }

  return resolved;
}

// ─── Virtual Workspace I/O ─────────────────────────────────────

/**
 * Reads a file from a virtual (template://) workspace.
 * Files live in Zustand's fileContents, not on the filesystem.
 * Returns null if the file doesn't exist in memory.
 */
function virtualRead(relativePath: string): string | null {
  const store = useProjectStore.getState();
  const wsId = store.activeWorkspaceId;
  if (!wsId) return null;

  const cleanPath = sanitizePath(relativePath);
  const fullVirtualPath = `${wsId}/${cleanPath}`;

  return store.fileContents[fullVirtualPath] ?? null;
}

/**
 * Writes a file to a virtual (template://) workspace.
 * Updates Zustand state — no filesystem access needed.
 */
function virtualWrite(relativePath: string, content: string): void {
  const store = useProjectStore.getState();
  const wsId = store.activeWorkspaceId;
  if (!wsId) throw new Error("No hay un proyecto abierto.");

  const cleanPath = sanitizePath(relativePath);
  const fullVirtualPath = `${wsId}/${cleanPath}`;

  store.setFileContent(fullVirtualPath, content);
}

// ─── Tool Implementations ──────────────────────────────────────

async function toolReadFile(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const path = String(args.path || "");
  if (!path) return { name: "read_file", success: false, error: "Se requiere el parámetro 'path'" };

  try {
    const wsId = useProjectStore.getState().activeWorkspaceId;

    // Virtual workspace — read from Zustand memory
    if (isVirtualWorkspace(wsId)) {
      const content = virtualRead(path);
      if (content === null) {
        return {
          name: "read_file",
          success: false,
          error: `Archivo '${sanitizePath(path)}' no encontrado en el proyecto.`,
        };
      }
      const lines = content.split("\n");
      return {
        name: "read_file",
        success: true,
        result: `[${sanitizePath(path)} — ${lines.length} líneas]\n${content}`,
      };
    }

    // Real filesystem
    const fullPath = resolveProjectPath(path);
    const content = await readFileContent(fullPath);

    const lines = content.split("\n");
    const totalLines = lines.length;
    const MAX_LINES = 500;

    if (totalLines <= MAX_LINES) {
      return {
        name: "read_file",
        success: true,
        result: `[${path} — ${totalLines} líneas]\n${content}`,
      };
    }

    // File too large — return first MAX_LINES with note
    const truncated = lines.slice(0, MAX_LINES).join("\n");
    return {
      name: "read_file",
      success: true,
      result: `[${path} — ${totalLines} líneas, mostrando primeras ${MAX_LINES}]\n${truncated}\n\n... (${totalLines - MAX_LINES} líneas más — usa search_code para buscar secciones específicas)`,
    };
  } catch (err) {
    return {
      name: "read_file",
      success: false,
      error: `No se pudo leer '${path}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function toolWriteFile(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const path = String(args.path || "");
  const content = String(args.content ?? "");
  if (!path) return { name: "write_file", success: false, error: "Se requiere el parámetro 'path'" };

  try {
    const wsId = useProjectStore.getState().activeWorkspaceId;

    // Virtual workspace — write to Zustand memory
    if (isVirtualWorkspace(wsId)) {
      const cleanPath = sanitizePath(path);
      // Snapshot existing content if available
      const existing = virtualRead(path);
      if (existing !== null) saveSnapshot(cleanPath, existing, "write");

      virtualWrite(path, content);
      return {
        name: "write_file",
        success: true,
        result: `Archivo '${cleanPath}' escrito exitosamente (${content.length} caracteres).`,
      };
    }

    // Real filesystem
    const fullPath = resolveProjectPath(path);

    // Save snapshot before overwriting
    try {
      const existing = await readFileContent(fullPath);
      saveSnapshot(path, existing, "write");
    } catch {
      // File doesn't exist yet — no snapshot needed
    }

    await saveFileContent(fullPath, content);

    // Actualizar el editor en tiempo real
    const store = useProjectStore.getState();
    store.setFileContent(fullPath, content);

    // Abrir el archivo en el editor automáticamente
    await store.openFile(fullPath);

    return {
      name: "write_file",
      success: true,
      result: `Archivo '${path}' escrito exitosamente (${content.length} caracteres).`,
    };
  } catch (err) {
    return {
      name: "write_file",
      success: false,
      error: `No se pudo escribir '${path}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function toolApplyDiff(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const path = String(args.path || "");
  const search = String(args.search || "");
  const replace = String(args.replace ?? "");

  if (!path) return { name: "apply_diff", success: false, error: "Se requiere 'path'" };
  if (!search) return { name: "apply_diff", success: false, error: "Se requiere 'search'" };

  try {
    const wsId = useProjectStore.getState().activeWorkspaceId;
    const isVirtual = isVirtualWorkspace(wsId);

    // Read content (virtual or filesystem)
    let content: string;
    let fullPath = "";
    if (isVirtual) {
      const virtualContent = virtualRead(path);
      if (virtualContent === null) {
        return {
          name: "apply_diff",
          success: false,
          error: `Archivo '${sanitizePath(path)}' no encontrado. Usa list_files para ver los archivos disponibles.`,
        };
      }
      content = virtualContent;
    } else {
      fullPath = resolveProjectPath(path);
      content = await readFileContent(fullPath);
    }

    // Save snapshot before modifying
    saveSnapshot(isVirtual ? sanitizePath(path) : path, content, "diff");

    // Contar ocurrencias para evitar reemplazos ambiguos
    const occurrences = content.split(search).length - 1;

    let newContent: string;

    if (occurrences === 1) {
      // Caso ideal: exactamente 1 match
      newContent = content.replace(search, replace);
    } else if (occurrences === 0) {
      // Fallback: intentar con whitespace normalizado
      const normalizeWs = (s: string) => s.replace(/\s+/g, " ").trim();
      const normalizedSearch = normalizeWs(search);
      const lines = content.split("\n");
      let matchStart = -1;
      let matchEnd = -1;
      
      // Buscar el bloque de líneas que coincide al normalizar whitespace
      for (let i = 0; i < lines.length; i++) {
        let accumulated = "";
        for (let j = i; j < lines.length; j++) {
          accumulated += (j > i ? " " : "") + lines[j].trim();
          if (normalizeWs(accumulated) === normalizedSearch) {
            matchStart = i;
            matchEnd = j;
            break;
          }
          if (accumulated.length > normalizedSearch.length * 2) break;
        }
        if (matchStart >= 0) break;
      }

      if (matchStart >= 0) {
        const before = lines.slice(0, matchStart).join("\n");
        const after = lines.slice(matchEnd + 1).join("\n");
        newContent = [before, replace, after].filter(Boolean).join("\n");
      } else {
        return {
          name: "apply_diff",
          success: false,
          error: `No se encontró el texto buscado en '${path}'. Usa read_file para ver el contenido actual y asegúrate de copiar el texto EXACTO.`,
        };
      }
    } else {
      // Múltiples ocurrencias — ambiguo
      return {
        name: "apply_diff",
        success: false,
        error: `Se encontraron ${occurrences} coincidencias del texto en '${path}'. Incluye más contexto (líneas antes/después) para que la búsqueda sea única.`,
      };
    }

    // Write result (virtual or filesystem)
    if (isVirtual) {
      virtualWrite(path, newContent);
    } else {
      await saveFileContent(fullPath, newContent);
      const store = useProjectStore.getState();
      store.setFileContent(fullPath, newContent);
      await store.openFile(fullPath);
    }

    return {
      name: "apply_diff",
      success: true,
      result: `Diff aplicado a '${isVirtual ? sanitizePath(path) : path}' exitosamente.`,
    };
  } catch (err) {
    return {
      name: "apply_diff",
      success: false,
      error: `Error aplicando diff a '${path}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function toolListFiles(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const relativePath = String(args.path || "");

  try {
    const rootPath = useProjectStore.getState().activeWorkspaceId;
    if (!rootPath) {
      return { name: "list_files", success: false, error: "No hay proyecto abierto." };
    }

    // Virtual workspace — read from Zustand workspace.files
    if (isVirtualWorkspace(rootPath)) {
      const workspace = useProjectStore.getState().workspaces.find((w) => w.id === rootPath);
      if (!workspace) {
        return { name: "list_files", success: false, error: "Workspace no encontrado." };
      }
      let formatted = formatFileTree(workspace.files, "", 0, 4);
      if (formatted.length > 3000) {
        formatted = formatted.slice(0, 3000) + "\n... (truncado)";
      }
      return { name: "list_files", success: true, result: formatted };
    }

    // Real filesystem
    const targetPath = relativePath
      ? resolveProjectPath(relativePath)
      : rootPath;

    const nodes = await loadProject(targetPath);
    const filteredNodes = relativePath ? nodes : filterProjectTree(nodes);
    let formatted = formatFileTree(filteredNodes, "", 0, 4);

    // Truncate very long listings
    if (formatted.length > 3000) {
      formatted = formatted.slice(0, 3000) + "\n... (truncado, usa list_files con un subdirectorio para ver más)";
    }

    return { name: "list_files", success: true, result: formatted };
  } catch (err) {
    return {
      name: "list_files",
      success: false,
      error: `Error listando '${relativePath || "/"}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function toolSearchCode(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const query = String(args.query || "");
  if (!query) return { name: "search_code", success: false, error: "Se requiere 'query'" };

  const relativePath = String(args.path || "");

  try {
    const rootPath = useProjectStore.getState().activeWorkspaceId;
    if (!rootPath) {
      return { name: "search_code", success: false, error: "No hay proyecto abierto." };
    }

    // Obtener el árbol de archivos del workspace activo
    const workspace = useProjectStore
      .getState()
      .workspaces.find((w) => w.id === rootPath);
    if (!workspace) {
      return { name: "search_code", success: false, error: "Workspace no encontrado." };
    }

    // Recolectar archivos relevantes
    const files = collectFiles(workspace.files, relativePath);
    const matches: string[] = [];
    const MAX_RESULTS = 20;
    const MAX_FILES = 200; // Scan more files but with early exit on results

    const isVirtual = isVirtualWorkspace(rootPath);
    const storeContents = useProjectStore.getState().fileContents;

    let scanned = 0;
    for (const file of files) {
      if (scanned >= MAX_FILES || matches.length >= MAX_RESULTS) break;

      try {
        // Virtual: read from store memory; Real: read from filesystem
        const content = isVirtual
          ? (storeContents[file.path] ?? "")
          : await readFileContent(file.path);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(query)) {
            const relPath = file.path.replace(rootPath, "").replace(/^[/\\]/, "");
            matches.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
            if (matches.length >= MAX_RESULTS) break;
          }
        }
        scanned++;
      } catch {
        // Archivo no legible, skip
      }
    }

    if (matches.length === 0) {
      return {
        name: "search_code",
        success: true,
        result: `No se encontraron resultados para '${query}' (${scanned} archivos escaneados).`,
      };
    }

    const header = matches.length >= MAX_RESULTS
      ? `[${matches.length}+ coincidencias — mostrando primeras ${MAX_RESULTS}]`
      : `[${matches.length} coincidencia${matches.length === 1 ? "" : "s"}]`;

    return {
      name: "search_code",
      success: true,
      result: `${header}\n${matches.join("\n")}`,
    };
  } catch (err) {
    return {
      name: "search_code",
      success: false,
      error: `Error buscando '${query}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function toolDeleteFile(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const path = String(args.path || "");
  if (!path) return { name: "delete_file", success: false, error: "Se requiere 'path'" };

  try {
    const wsId = useProjectStore.getState().activeWorkspaceId;

    // Virtual workspace — delete from Zustand
    if (isVirtualWorkspace(wsId)) {
      const cleanPath = sanitizePath(path);
      const fullVirtualPath = `${wsId}/${cleanPath}`;
      const existing = virtualRead(path);
      if (existing !== null) saveSnapshot(cleanPath, existing, "delete");

      const store = useProjectStore.getState();
      if (store.openTabs.includes(fullVirtualPath)) {
        store.closeTab(fullVirtualPath);
      }
      // Remove from fileContents by setting empty and closing
      // (Zustand doesn't have a delete method, closeTab cleans up)
      return {
        name: "delete_file",
        success: true,
        result: `Archivo '${cleanPath}' eliminado.`,
      };
    }

    // Real filesystem
    const fullPath = resolveProjectPath(path);

    // Save snapshot before deleting (most destructive operation)
    try {
      const existing = await readFileContent(fullPath);
      saveSnapshot(path, existing, "delete");
    } catch {
      // File might not be readable, proceed anyway
    }

    await deleteEntry(fullPath);

    // Cerrar tab si estaba abierto
    const store = useProjectStore.getState();
    if (store.openTabs.includes(fullPath)) {
      store.closeTab(fullPath);
    }

    return {
      name: "delete_file",
      success: true,
      result: `Archivo '${path}' eliminado.`,
    };
  } catch (err) {
    return {
      name: "delete_file",
      success: false,
      error: `No se pudo eliminar '${path}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Memory Tools ──────────────────────────────────────────────

async function toolMemorySave(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const title = String(args.title || "");
  const content = String(args.content || "");
  const type = String(args.type || "discovery") as "decision" | "pattern" | "bugfix" | "discovery" | "convention";

  if (!title) return { name: "memory_save", success: false, error: "Se requiere 'title'" };
  if (!content) return { name: "memory_save", success: false, error: "Se requiere 'content'" };

  const validTypes = ["decision", "pattern", "bugfix", "discovery", "convention"];
  if (!validTypes.includes(type)) {
    return { name: "memory_save", success: false, error: `Tipo inválido '${type}'. Usa: ${validTypes.join(", ")}` };
  }

  try {
    const project = useProjectStore.getState().activeWorkspaceId || "unknown";
    const entry = await saveMemory({ project, title, content, type });
    return {
      name: "memory_save",
      success: true,
      result: `Memoria guardada: "${entry.title}" [${entry.type}] (ID: ${entry.id})`,
    };
  } catch (err) {
    return {
      name: "memory_save",
      success: false,
      error: `Error guardando memoria: ${err instanceof Error ? err.message : "Error desconocido"}`,
    };
  }
}

async function toolMemorySearch(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const query = String(args.query || "");
  if (!query) return { name: "memory_search", success: false, error: "Se requiere 'query'" };

  try {
    const project = useProjectStore.getState().activeWorkspaceId || "unknown";
    const results = await searchMemories(project, query, 5);

    if (results.length === 0) {
      return {
        name: "memory_search",
        success: true,
        result: `No se encontraron memorias para '${query}'.`,
      };
    }

    const formatted = results.map((m) => {
      const age = Date.now() - m.createdAt;
      const days = Math.floor(age / (1000 * 60 * 60 * 24));
      const timeAgo = days === 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
      return `[${m.type}] "${m.title}" (${timeAgo})\n  ${m.content}`;
    }).join("\n\n");

    return {
      name: "memory_search",
      success: true,
      result: `[${results.length} memoria${results.length === 1 ? "" : "s"} encontrada${results.length === 1 ? "" : "s"}]\n\n${formatted}`,
    };
  } catch (err) {
    return {
      name: "memory_search",
      success: false,
      error: `Error buscando memorias: ${err instanceof Error ? err.message : "Error desconocido"}`,
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────

/** Formatea un árbol de archivos como texto indentado, con límite de profundidad. */
function formatFileTree(nodes: FileNode[], indent: string, depth: number = 0, maxDepth: number = 4): string {
  if (depth >= maxDepth) return `${indent}... (usar list_files para ver más)`;

  return nodes
    .map((node) => {
      if (node.type === "directory") {
        const children =
          node.children && node.children.length > 0
            ? "\n" + formatFileTree(node.children, indent + "  ", depth + 1, maxDepth)
            : "";
        return `${indent}📁 ${node.name}/${children}`;
      }
      return `${indent}📄 ${node.name}`;
    })
    .join("\n");
}

/** Recolecta archivos planos desde un árbol FileNode, filtrando por path relativo. */
function collectFiles(nodes: FileNode[], filterPath: string): FileNode[] {
  const files: FileNode[] = [];

  // Allowlist de extensiones de código (más preciso que blocklist)
  const CODE_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cjs",
    ".css", ".scss", ".less", ".html", ".vue", ".svelte",
    ".json", ".yaml", ".yml", ".toml",
    ".md", ".mdx", ".txt",
    ".py", ".rb", ".go", ".rs", ".java", ".kt",
    ".sql", ".graphql", ".gql",
    ".sh", ".bash", ".zsh", ".ps1",
    ".env", ".env.local", ".env.example",
    ".astro", ".prisma",
  ]);

  function walk(list: FileNode[]) {
    for (const node of list) {
      if (node.type === "file") {
        const ext = "." + (node.name.split(".").pop() || "").toLowerCase();
        // También include archivos sin extensión comunes (Dockerfile, Makefile, etc.)
        const isCodeFile = CODE_EXTENSIONS.has(ext) || !node.name.includes(".");
        if (isCodeFile) {
          if (!filterPath || node.path.includes(filterPath)) {
            files.push(node);
          }
        }
      } else if (node.children) {
        walk(node.children);
      }
    }
  }

  walk(nodes);
  return files;
}

// ─── Command Execution ─────────────────────────────────────────

/** Maximum execution time for a command */
const COMMAND_TIMEOUT_MS = 60_000;

/** Maximum output characters before truncation */
const MAX_OUTPUT_CHARS = 4_000;

/**
 * Patterns that are ALWAYS blocked — destructive system-level commands.
 * These are OS-level dangerous, not project-level (git reset, rm -rf are
 * handled by the agent's own judgment + Tauri sandbox).
 */
const BLOCKED_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bformat\s+[a-zA-Z]:/i, reason: "Formatear disco" },
  { pattern: /\bshutdown\b/i, reason: "Apagar el sistema" },
  { pattern: /\breboot\b/i, reason: "Reiniciar el sistema" },
  { pattern: /\brm\s+(-rf?|--force)\s+[/\\]($|\s)/i, reason: "Eliminar raíz del sistema" },
  { pattern: /\bdel\s+\/[sf]\s+[a-zA-Z]:\\/i, reason: "Eliminar archivos del sistema" },
  { pattern: /\bregistry\b.*\bdelete\b/i, reason: "Modificar registro de Windows" },
  { pattern: /\bmkfs\b/i, reason: "Crear filesystem" },
  { pattern: /\bdd\s+if=/i, reason: "Escritura directa a disco" },
  { pattern: />\s*\/dev\/sd[a-z]/i, reason: "Escritura directa a disco" },
  { pattern: /\b:(){ :\|:& };:/i, reason: "Fork bomb" },
];

/**
 * Checks if a command is blocked by security policy.
 * Returns the reason string if blocked, null if allowed.
 */
export function isBlockedCommand(command: string): string | null {
  for (const { pattern, reason } of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) return reason;
  }
  return null;
}

/**
 * Truncates command output to MAX_OUTPUT_CHARS, keeping head and tail.
 */
function truncateOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;

  const headSize = Math.floor(MAX_OUTPUT_CHARS * 0.55);
  const tailSize = Math.floor(MAX_OUTPUT_CHARS * 0.40);
  const omitted = text.length - headSize - tailSize;

  return (
    text.slice(0, headSize) +
    `\n\n[... ${omitted} caracteres omitidos ...]\n\n` +
    text.slice(-tailSize)
  );
}

async function toolExecuteCommand(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const command = String(args.command || "").trim();
  if (!command) {
    return { name: "execute_command", success: false, error: "Se requiere el parámetro 'command'" };
  }

  // ─── Platform guard ──────────────────────────────────────────
  // Dynamic import to avoid bundling platform check at module level
  const { isTauri } = await import("@/lib/platform");
  if (!isTauri()) {
    return {
      name: "execute_command",
      success: false,
      error: "Ejecución de comandos solo disponible en la app de escritorio. En el navegador, muestra el comando para que el usuario lo ejecute manualmente.",
    };
  }

  // ─── Security guard ──────────────────────────────────────────
  const blockedReason = isBlockedCommand(command);
  if (blockedReason) {
    return {
      name: "execute_command",
      success: false,
      error: `Comando bloqueado por seguridad: ${blockedReason}. Este comando podría dañar el sistema.`,
    };
  }

  // ─── Resolve working directory ───────────────────────────────
  const rootPath = useProjectStore.getState().activeWorkspaceId;
  if (!rootPath) {
    return { name: "execute_command", success: false, error: "No hay un proyecto abierto." };
  }

  let cwd = rootPath;
  const relativeCwd = String(args.cwd || "").trim();
  if (relativeCwd) {
    try {
      validatePath(relativeCwd);
      const sep = rootPath.includes("\\") ? "\\" : "/";
      cwd = `${rootPath}${sep}${relativeCwd.replace(/\//g, sep)}`;

      // Verify resolved path is under project root
      const normalizedRoot = rootPath.replace(/\\/g, "/").toLowerCase();
      const normalizedCwd = cwd.replace(/\\/g, "/").toLowerCase();
      if (!normalizedCwd.startsWith(normalizedRoot)) {
        return {
          name: "execute_command",
          success: false,
          error: "Directorio de trabajo inválido: escapa del proyecto.",
        };
      }
    } catch (err) {
      return {
        name: "execute_command",
        success: false,
        error: `Directorio de trabajo inválido: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ─── Execute with timeout ────────────────────────────────────
  try {
    const { execShell } = await import("@/lib/ipc");

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Comando cancelado: excedió 60 segundos de ejecución.")),
        COMMAND_TIMEOUT_MS,
      ),
    );

    const execPromise = execShell(command, cwd);
    const result = await Promise.race([execPromise, timeoutPromise]);

    // ─── Format output ───────────────────────────────────────
    const parts: string[] = [];

    if (result.stdout) {
      parts.push(truncateOutput(result.stdout));
    }

    if (result.stderr) {
      parts.push(`[stderr]\n${truncateOutput(result.stderr)}`);
    }

    if (result.exit_code !== 0) {
      parts.push(`[exit code: ${result.exit_code}]`);
    }

    const output = parts.join("\n\n") || "(sin salida)";

    return {
      name: "execute_command",
      success: true,
      result: output,
    };
  } catch (err) {
    return {
      name: "execute_command",
      success: false,
      error: `Error ejecutando '${command}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Preview Component ─────────────────────────────────────────

async function toolPreviewComponent(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const component = String(args.component || "").trim();
  if (!component) {
    return { name: "preview_component", success: false, error: "Se requiere el parámetro 'component'" };
  }

  try {
    // Dynamic import to avoid circular dependency
    const { useUIStore } = await import("@/stores/ui");
    useUIStore.getState().setPreviewTarget(component);
    useUIStore.getState().setVibeLensEnabled(true);

    const propsStr = typeof args.props === "string" ? args.props : "";
    const propsNote = propsStr ? ` con props: ${propsStr}` : "";

    return {
      name: "preview_component",
      success: true,
      result: `Componente '${component}' aislado en VibeLens${propsNote}. El usuario puede verlo en la vista previa.`,
    };
  } catch (err) {
    return {
      name: "preview_component",
      success: false,
      error: `Error previsualizando '${component}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Main Executor ─────────────────────────────────────────────

const TOOL_MAP: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>> = {
  read_file: toolReadFile,
  read_local_file: toolReadFile,  // Alias — some models call it this way
  write_file: toolWriteFile,
  apply_diff: toolApplyDiff,
  list_files: toolListFiles,
  search_code: toolSearchCode,
  delete_file: toolDeleteFile,
  memory_save: toolMemorySave,
  memory_search: toolMemorySearch,
  execute_command: toolExecuteCommand,
  preview_component: toolPreviewComponent,
};

/**
 * Ejecuta una herramienta por nombre con los argumentos dados.
 * Retorna siempre un ToolResult (nunca lanza excepciones).
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const handler = TOOL_MAP[call.name];
  if (!handler) {
    return {
      name: call.name,
      success: false,
      error: `Herramienta desconocida: '${call.name}'`,
    };
  }

  try {
    return await handler(call.args);
  } catch (err) {
    return {
      name: call.name,
      success: false,
      error: `Error interno ejecutando '${call.name}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Genera el resumen compacto del proyecto para inyectar en el system prompt.
 * Filtra directorios de ruido (node_modules, dist, .git, etc.) y limita profundidad.
 */
export function getProjectSummary(): string | null {
  const store = useProjectStore.getState();
  const workspace = store.workspaces.find(
    (w) => w.id === store.activeWorkspaceId,
  );
  if (!workspace || !workspace.files.length) return null;

  const tree = formatFileTree(filterProjectTree(workspace.files), "", 0, 3);
  const activeFile = store.activeTab;
  const activeContent = activeFile
    ? store.fileContents[activeFile]
    : undefined;

  let summary = `Proyecto: ${workspace.name}\nRuta: ${workspace.path}\n\nEstructura:\n${tree}`;

  // Limitar a ~2000 chars de árbol
  if (summary.length > 2000) {
    summary = summary.slice(0, 2000) + "\n... (árbol truncado, usa list_files para ver más)";
  }

  if (activeFile && activeContent !== undefined) {
    const totalLines = activeContent.split("\n").length;
    // Solo incluir si el archivo no es demasiado grande
    if (totalLines <= 300) {
      const relPath = activeFile.replace(workspace.path, "").replace(/^[/\\]/, "");
      const truncated = activeContent.split("\n").slice(0, 100).join("\n");
      const wasTruncated = totalLines > 100;
      summary += `\n\nArchivo activo en el editor: ${relPath}\n\`\`\`\n${truncated}\n\`\`\`${wasTruncated ? "\n(... archivo truncado, usa read_file para ver el completo)" : ""}`;
    } else {
      const relPath = activeFile.replace(workspace.path, "").replace(/^[/\\]/, "");
      summary += `\n\nArchivo activo: ${relPath} (${totalLines} líneas — usa read_file para leerlo)`;
    }
  }

  return summary;
}

// ─── Tree Helpers ──────────────────────────────────────────────

/** Directorios que se filtran del árbol de proyecto. */
const NOISE_DIRS = new Set([
  "node_modules", "dist", "build", ".git", ".next", ".nuxt",
  "coverage", ".cache", ".turbo", ".output", "__pycache__",
  ".svelte-kit", ".astro", ".vercel", ".netlify",
]);

/** Filtra directorios de ruido del árbol del proyecto. */
function filterProjectTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .filter((node) => {
      if (node.type === "directory" && NOISE_DIRS.has(node.name)) return false;
      return true;
    })
    .map((node) => {
      if (node.type === "directory" && node.children) {
        return { ...node, children: filterProjectTree(node.children) };
      }
      return node;
    });
}
