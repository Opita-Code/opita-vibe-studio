import { useState, useCallback, useRef, useEffect } from "react";
import type { FileNode } from "@/lib/types";
import { useProjectStore } from "@/stores/project";

// ─── Icons ──────────────────────────────────────────────────────

const FILE_ICONS: Record<string, string> = {
  html: "\u{1F310}",
  css: "\u{1F3A8}",
  js: "\u{26A1}",
  jsx: "\u{26A1}",
  ts: "\u{26A1}",
  tsx: "\u{26A1}",
  json: "\u{1F4CB}",
  md: "\u{1F4DD}",
  xml: "\u{1F4C4}",
  yaml: "\u{2699}\u{FE0F}",
  yml: "\u{2699}\u{FE0F}",
  sh: "\u{1F4BB}",
  py: "\u{1F40D}",
  rs: "\u{1F980}",
  svg: "\u{1F5BC}\u{FE0F}",
  png: "\u{1F5BC}\u{FE0F}",
  jpg: "\u{1F5BC}\u{FE0F}",
  jpeg: "\u{1F5BC}\u{FE0F}",
  gif: "\u{1F5BC}\u{FE0F}",
  ico: "\u{1F5BC}\u{FE0F}",
  gitignore: "\u{1F512}",
  env: "\u{1F511}",
};

const FOLDER_ICON = "\u{1F4C1}";
const FOLDER_OPEN_ICON = "\u{1F4C2}";
const DEFAULT_FILE_ICON = "\u{1F4C4}";

function getFileIcon(node: FileNode): string {
  if (node.type === "directory") return FOLDER_ICON;
  const ext = node.extension || node.name.split(".").pop()?.toLowerCase();
  if (ext && ext in FILE_ICONS) return FILE_ICONS[ext];
  if (node.name.toLowerCase() in FILE_ICONS) return FILE_ICONS[node.name.toLowerCase()];
  return DEFAULT_FILE_ICON;
}

// ─── Creating State ────────────────────────────────────────────

interface CreatingState {
  parentPath: string;
  type: "file" | "directory";
}

// ─── Context Menu State ────────────────────────────────────────

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: FileNode | null;
}

// ─── Inline Create Input ───────────────────────────────────────

function InlineCreateInput({
  parentPath,
  type,
  level,
  onComplete,
}: {
  parentPath: string;
  type: "file" | "directory";
  level: number;
  onComplete: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const openFile = useProjectStore((s) => s.openFile);
  const openProject = useProjectStore((s) => s.openProject);
  const rootPath = useProjectStore((s) => s.rootPath);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      onComplete();
      return;
    }

    const separator = parentPath.endsWith("/") || parentPath.endsWith("\\") ? "" : "/";
    const fullPath = `${parentPath}${separator}${trimmed}`;

    try {
      if (type === "directory") {
        const { createDir } = await import("@/lib/fs");
        await createDir(fullPath);
      } else {
        const { createFileItem } = await import("@/lib/fs");
        await createFileItem(fullPath);
      }
      // Recargar árbol
      if (rootPath) {
        await openProject(rootPath);
      }
      // Si es archivo, abrirlo después de recargar
      if (type === "file") {
        // Esperar a que el árbol se recargue
        setTimeout(() => openFile(fullPath), 50);
      }
    } catch {
      // Si falla, cerrar el input igual
    }
    onComplete();
  }, [name, type, parentPath, rootPath, openFile, openProject, onComplete]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
      if (e.key === "Escape") onComplete();
    },
    [handleSubmit, onComplete],
  );

  return (
    <div
      className="flex items-center gap-1 px-2 py-0.5"
      style={{ paddingLeft: `${8 + level * 16}px` }}
    >
      <span className="text-xs shrink-0">
        {type === "directory" ? FOLDER_ICON : DEFAULT_FILE_ICON}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={type === "directory" ? "nombre-carpeta" : "archivo.ext"}
        className="flex-1 bg-[#3c3c3c] text-[#cccccc] text-sm px-1 py-0.5 border border-[#007acc] outline-none rounded min-w-0"
      />
    </div>
  );
}

// ─── Context Menu ───────────────────────────────────────────────

function ContextMenu({
  state,
  onClose,
  onNewFile,
  onNewFolder,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!state.visible || !state.node) return null;

  const isDirectory = state.node.type === "directory";

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-[#252526] border border-[#444] rounded shadow-lg py-1 min-w-[180px] select-none"
      style={{ left: state.x, top: state.y }}
    >
      <button
        onClick={onNewFile}
        className="w-full text-left px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#094771] transition-colors"
      >
        Nuevo archivo
      </button>

      {isDirectory && (
        <button
          onClick={onNewFolder}
          className="w-full text-left px-4 py-1.5 text-sm text-[#cccccc] hover:bg-[#094771] transition-colors"
        >
          Nueva carpeta
        </button>
      )}

      <div className="border-t border-[#333] my-1" />

      <button
        disabled
        className="w-full text-left px-4 py-1.5 text-sm text-[#616161] cursor-not-allowed"
        title="Próximamente"
      >
        Renombrar
      </button>

      <button
        disabled
        className="w-full text-left px-4 py-1.5 text-sm text-[#616161] cursor-not-allowed"
        title="Próximamente"
      >
        Eliminar
      </button>
    </div>
  );
}

// ─── TreeNode ──────────────────────────────────────────────────

function FileTreeNode({
  node,
  level,
  creatingIn,
  onContextMenu,
  onCancelCreate,
}: {
  node: FileNode;
  level: number;
  creatingIn: CreatingState | null;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onCancelCreate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const openFile = useProjectStore((s) => s.openFile);
  const activeTab = useProjectStore((s) => s.activeTab);

  const isActive = activeTab === node.path;

  // Auto-expand if creating in this directory
  useEffect(() => {
    if (creatingIn?.parentPath === node.path && node.type === "directory") {
      setExpanded(true);
    }
  }, [creatingIn, node.path, node.type]);

  const handleClick = useCallback(() => {
    if (node.type === "directory") {
      setExpanded((prev) => !prev);
    } else {
      openFile(node.path);
    }
  }, [node.type, node.path, openFile]);

  const handleContext = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu(e, node);
    },
    [onContextMenu, node],
  );

  const showingInput =
    creatingIn !== null &&
    creatingIn.parentPath === node.path &&
    node.type === "directory";

  return (
    <div>
      {/* Node row */}
      <div
        onClick={handleClick}
        onContextMenu={handleContext}
        className={`flex items-center gap-1 px-2 py-0.5 text-sm cursor-pointer select-none hover:bg-[#2a2d2e] transition-colors ${isActive ? "bg-[#37373d]" : ""}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        title={node.path}
      >
        {/* Expand/collapse arrow */}
        <span className="w-4 text-center text-[#969696] text-[10px] shrink-0">
          {node.type === "directory"
            ? node.children && node.children.length > 0
              ? expanded
                ? "\u25BC"
                : "\u25B6"
              : "\u3000"
            : "\u3000"}
        </span>

        {/* File icon */}
        <span className="shrink-0 text-xs leading-none">
          {node.type === "directory" && expanded ? FOLDER_OPEN_ICON : getFileIcon(node)}
        </span>

        {/* Name */}
        <span className="truncate text-[#cccccc]">{node.name}</span>
      </div>

      {/* Children */}
      {node.type === "directory" && expanded && (
        <div>
          {/* Inline create input */}
          {showingInput && (
            <InlineCreateInput
              parentPath={node.path}
              type={creatingIn!.type}
              level={level + 1}
              onComplete={onCancelCreate}
            />
          )}

          {/* Child nodes */}
          {node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              creatingIn={creatingIn}
              onContextMenu={onContextMenu}
              onCancelCreate={onCancelCreate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main FileTree ──────────────────────────────────────────────

/**
 * Árbol de archivos recursivo con iconos por tipo, expandir/colapsar,
 * menú contextual, y creación inline de archivos/carpetas.
 */
export function FileTree({ nodes, level = 0 }: { nodes: FileNode[]; level?: number }) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
  });

  const [creatingIn, setCreatingIn] = useState<CreatingState | null>(null);

  // ── Handlers ───────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, node });
    setCreatingIn(null); // close any open inline input
  }, []);

  const closeContext = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleNewFile = useCallback(() => {
    const node = contextMenu.node;
    if (!node) return;
    const parentPath =
      node.type === "directory" ? node.path : node.path.split("/").slice(0, -1).join("/");
    setCreatingIn({ parentPath, type: "file" });
    closeContext();
  }, [contextMenu.node, closeContext]);

  const handleNewFolder = useCallback(() => {
    const node = contextMenu.node;
    if (!node) return;
    const parentPath =
      node.type === "directory" ? node.path : node.path.split("/").slice(0, -1).join("/");
    setCreatingIn({ parentPath, type: "directory" });
    closeContext();
  }, [contextMenu.node, closeContext]);

  const handleCancelCreate = useCallback(() => {
    setCreatingIn(null);
  }, []);

  return (
    <div
      className="text-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (contextMenu.visible) closeContext();
      }}
    >
      {nodes.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#616161]">
          Proyecto vacío — crea un archivo con click derecho
        </p>
      ) : (
        nodes.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            level={level}
            creatingIn={creatingIn}
            onContextMenu={handleContextMenu}
            onCancelCreate={handleCancelCreate}
          />
        ))
      )}

      {/* Context menu */}
      <ContextMenu
        state={contextMenu}
        onClose={closeContext}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
      />
    </div>
  );
}
