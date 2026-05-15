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

// ─── Creating / Renaming State ─────────────────────────────────

interface CreatingState {
  parentPath: string;
  type: "file" | "directory";
}

interface RenamingState {
  node: FileNode;
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
  const reloadWorkspace = useProjectStore((s) => s.reloadWorkspace);
  const workspaces = useProjectStore((s) => s.workspaces);

  const activeWs = workspaces.find(w => parentPath.startsWith(w.path));

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
      if (activeWs) {
        await reloadWorkspace(activeWs.id);
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
  }, [name, type, parentPath, activeWs, openFile, reloadWorkspace, onComplete]);

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
        className="flex-1 bg-obsidian-800 text-slate-200 text-sm px-1 py-0.5 border border-aura-purple/50 focus:ring-1 focus:ring-aura-purple/50 outline-none rounded min-w-0 transition-all"
      />
    </div>
  );
}

// ─── Inline Rename Input ───────────────────────────────────────

function InlineRenameInput({
  node,
  level,
  onComplete,
}: {
  node: FileNode;
  level: number;
  onComplete: () => void;
}) {
  const [name, setName] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const reloadWorkspace = useProjectStore((s) => s.reloadWorkspace);
  const workspaces = useProjectStore((s) => s.workspaces);

  const activeWs = workspaces.find(w => node.path.startsWith(w.path));

  useEffect(() => {
    inputRef.current?.focus();
    // Select filename without extension
    if (node.type === "file" && node.name.includes(".")) {
      const idx = node.name.lastIndexOf(".");
      inputRef.current?.setSelectionRange(0, idx);
    } else {
      inputRef.current?.select();
    }
  }, [node]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === node.name) {
      onComplete();
      return;
    }

    const parentPath = node.path.split(/[/\\]/).slice(0, -1).join("/") || "";
    const parentSep = parentPath ? "/" : "";
    const newPath = `${parentPath}${parentSep}${trimmed}`;

    try {
      const { renameEntry } = await import("@/lib/fs");
      await renameEntry(node.path, newPath);
      
      // Update open tabs if it's a file
      if (node.type === "file") {
        const store = useProjectStore.getState();
        const { openTabs, activeTab, fileContents, isDirty, setActiveTab } = store;
        
        if (openTabs.includes(node.path)) {
          const newTabs = openTabs.map(t => t === node.path ? newPath : t);
          const newContents = { ...fileContents };
          if (newContents[node.path] !== undefined) {
            newContents[newPath] = newContents[node.path];
            delete newContents[node.path];
          }
          const newDirty = { ...isDirty };
          if (newDirty[node.path] !== undefined) {
            newDirty[newPath] = newDirty[node.path];
            delete newDirty[node.path];
          }
          
          useProjectStore.setState({
            openTabs: newTabs,
            fileContents: newContents,
            isDirty: newDirty,
          });
        }
        
        if (activeTab === node.path) {
          setActiveTab(newPath);
        }
      }

      // Reload
      if (activeWs) {
        await reloadWorkspace(activeWs.id);
      }
    } catch (e) {
      console.error(e);
      useProjectStore.setState({ statusMessage: e instanceof Error ? e.message : "Error al renombrar" });
    }
    onComplete();
  }, [name, node, activeWs, reloadWorkspace, onComplete]);

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
        {node.type === "directory" ? FOLDER_ICON : DEFAULT_FILE_ICON}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        className="flex-1 bg-obsidian-800 text-slate-200 text-sm px-1 py-0.5 border border-aura-purple/50 focus:ring-1 focus:ring-aura-purple/50 outline-none rounded min-w-0 transition-all"
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
  onRename,
  onDelete,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
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
      className="fixed z-50 bg-obsidian-800/90 backdrop-blur-3xl border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] select-none"
      style={{ left: state.x, top: state.y }}
    >
      <button
        onClick={onNewFile}
        className="w-full text-left px-4 py-1.5 text-sm text-slate-200 hover:text-white hover:bg-aura-purple/40 transition-colors"
      >
        Nuevo archivo
      </button>

      {isDirectory && (
        <button
          onClick={onNewFolder}
          className="w-full text-left px-4 py-1.5 text-sm text-slate-200 hover:text-white hover:bg-aura-purple/40 transition-colors"
        >
          Nueva carpeta
        </button>
      )}

      <div className="border-t border-white/10 my-1" />

      <button
        onClick={onRename}
        className="w-full text-left px-4 py-1.5 text-sm text-slate-200 hover:text-white hover:bg-aura-purple/40 transition-colors"
      >
        Renombrar
      </button>

      <button
        onClick={onDelete}
        className="w-full text-left px-4 py-1.5 text-sm text-[#f44747] hover:bg-red-900/20 transition-colors"
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
  renamingIn,
  onContextMenu,
  onCancelCreate,
  onInlineCreate,
  onCancelRename,
}: {
  node: FileNode;
  level: number;
  creatingIn: CreatingState | null;
  renamingIn: RenamingState | null;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onCancelCreate: () => void;
  onInlineCreate: (parentPath: string, type: "file" | "directory") => void;
  onCancelRename: () => void;
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

  const handleDotsClick = useCallback(
    (e: React.MouseEvent) => {
      // Simulate context menu on exactly the dots position
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const simEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: rect.left,
        clientY: rect.bottom,
      } as unknown as React.MouseEvent;
      onContextMenu(simEvent, node);
    },
    [onContextMenu, node]
  );

  const handleNewFileHover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(true);
    onInlineCreate(node.path, "file");
  }, [node.path, onInlineCreate]);

  const handleNewFolderHover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(true);
    onInlineCreate(node.path, "directory");
  }, [node.path, onInlineCreate]);

  const showingInput =
    creatingIn !== null &&
    creatingIn.parentPath === node.path &&
    node.type === "directory";

  const isRenaming = renamingIn?.node.path === node.path;

  if (isRenaming) {
    return <InlineRenameInput node={node} level={level} onComplete={onCancelRename} />;
  }

  return (
    <div>
      {/* Node row */}
      <div
        onClick={handleClick}
        onContextMenu={handleContext}
        className={`flex items-center gap-1 px-2 py-0.5 text-sm cursor-pointer select-none hover:bg-aura-purple/10 transition-colors group ${isActive ? "bg-white/10 text-aura-cyan" : "text-slate-300"}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        title={node.path}
      >
        {/* Expand/collapse arrow */}
        <span className="w-4 text-center text-slate-500 text-[10px] shrink-0">
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
        <span className="truncate flex-1">{node.name}</span>

        {/* Hover actions & Mobile dots */}
        <div className="flex items-center ml-auto">
          {node.type === "directory" && (
            <div className="hidden group-hover:flex items-center gap-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleNewFileHover} className="p-0.5 text-slate-400 hover:text-aura-cyan hover:bg-white/10 rounded transition-colors" title="Nuevo Archivo">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </button>
              <button onClick={handleNewFolderHover} className="p-0.5 text-slate-400 hover:text-aura-cyan hover:bg-white/10 rounded transition-colors" title="Nueva Carpeta">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
              </button>
            </div>
          )}
          {/* Menu button visible on mobile always, or on desktop hover */}
          <button onClick={handleDotsClick} className="p-0.5 ml-1 text-slate-400 hover:text-white md:opacity-0 md:group-hover:opacity-100 transition-opacity" title="Opciones" aria-label="Opciones">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
          </button>
        </div>
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
              renamingIn={renamingIn}
              onContextMenu={onContextMenu}
              onCancelCreate={onCancelCreate}
              onInlineCreate={onInlineCreate}
              onCancelRename={onCancelRename}
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
  const [renamingIn, setRenamingIn] = useState<RenamingState | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Auto-adjust if menu goes out of bounds
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    
    setContextMenu({ visible: true, x, y, node });
    setCreatingIn(null); // close any open inline input
    setRenamingIn(null);
  }, []);

  useEffect(() => {
    const handleGlobalCreateFile = () => {
      const workspaceId = useProjectStore.getState().activeWorkspaceId;
      if (workspaceId) {
        setCreatingIn({ parentPath: workspaceId, type: "file" });
        setRenamingIn(null);
      }
    };
    
    window.addEventListener("vibe:create-file", handleGlobalCreateFile);
    return () => window.removeEventListener("vibe:create-file", handleGlobalCreateFile);
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
    setRenamingIn(null);
    closeContext();
  }, [contextMenu.node, closeContext]);

  const handleNewFolder = useCallback(() => {
    const node = contextMenu.node;
    if (!node) return;
    const parentPath =
      node.type === "directory" ? node.path : node.path.split("/").slice(0, -1).join("/");
    setCreatingIn({ parentPath, type: "directory" });
    setRenamingIn(null);
    closeContext();
  }, [contextMenu.node, closeContext]);

  const handleRename = useCallback(() => {
    const node = contextMenu.node;
    if (!node) return;
    setRenamingIn({ node });
    setCreatingIn(null);
    closeContext();
  }, [contextMenu.node, closeContext]);

  const handleDelete = useCallback(async () => {
    const node = contextMenu.node;
    if (!node) return;
    closeContext();

    if (window.confirm(`¿Seguro que deseas eliminar "${node.name}"?`)) {
      try {
        const { deleteEntry } = await import("@/lib/fs");
        await deleteEntry(node.path);

        // Close tab if deleted file was open
        const store = useProjectStore.getState();
        if (store.openTabs.includes(node.path)) {
          store.closeTab(node.path);
        }

        const workspaces = store.workspaces;
        const activeWs = workspaces.find(w => node.path.startsWith(w.path));
        if (activeWs) {
          useProjectStore.getState().reloadWorkspace(activeWs.id);
        }
      } catch (e) {
        console.error(e);
        useProjectStore.setState({ statusMessage: e instanceof Error ? e.message : "Error al eliminar" });
      }
    }
  }, [contextMenu.node, closeContext]);

  const handleCancelCreate = useCallback(() => {
    setCreatingIn(null);
  }, []);

  const handleInlineCreate = useCallback((parentPath: string, type: "file" | "directory") => {
    setCreatingIn({ parentPath, type });
    setRenamingIn(null);
  }, []);
  
  const handleCancelRename = useCallback(() => {
    setRenamingIn(null);
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
            renamingIn={renamingIn}
            onContextMenu={handleContextMenu}
            onCancelCreate={handleCancelCreate}
            onInlineCreate={handleInlineCreate}
            onCancelRename={handleCancelRename}
          />
        ))
      )}

      {/* Context menu */}
      <ContextMenu
        state={contextMenu}
        onClose={closeContext}
        onNewFile={handleNewFile}
        onNewFolder={handleNewFolder}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </div>
  );
}
