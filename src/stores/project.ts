import { create } from "zustand";
import type { FileNode } from "@/lib/types";
import { loadProject, readFileContent, saveFileContent, isGitRepo } from "@/lib/fs";
import { getGitBranch } from "@/lib/git";
import { markWriting, markWritten } from "@/lib/file-watcher";

// ─── State ─────────────────────────────────────────────────────

interface ProjectState {
  rootPath: string | null;
  files: FileNode[];
  openTabs: string[];
  activeTab: string | null;
  isDirty: Record<string, boolean>;
  /** Contenido de archivos abiertos (path → contenido actual) */
  fileContents: Record<string, string>;
  /** Indica si el proyecto es un repositorio git */
  isGitRepo: boolean;
  /** Nombre de la rama git actual (null si no es repo) */
  gitBranch: string | null;
  /** Indica si se está cargando un proyecto */
  isLoading: boolean;
  /** Mensaje de estado de la última operación */
  statusMessage: string | null;
}

// ─── Actions ───────────────────────────────────────────────────

interface ProjectActions {
  setRootPath: (path: string | null) => void;
  setFiles: (files: FileNode[]) => void;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string | null) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  isTabOpen: (path: string) => boolean;

  /** Establece el contenido de un archivo en memoria y lo marca como dirty */
  setFileContent: (path: string, content: string) => void;

  /** Abre un proyecto: carga el árbol de archivos */
  openProject: (path: string) => Promise<void>;

  /** Abre un archivo: lo lee de disco, lo agrega a tabs, carga su contenido */
  openFile: (path: string) => Promise<void>;

  /** Guarda un archivo: escribe a disco, limpia dirty */
  saveFile: (path: string) => Promise<void>;

  /** Cierra un tab guardando si está dirty (devuelve true si se cerró) */
  closeTabWithSave: (path: string) => Promise<boolean>;

  /** Establece información git */
  setGitInfo: (branch: string | null, isRepo: boolean) => void;

  /** Limpia el mensaje de estado */
  clearStatusMessage: () => void;
}

// ─── Store ─────────────────────────────────────────────────────

export type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set, get) => ({
  rootPath: null,
  files: [],
  openTabs: [],
  activeTab: null,
  isDirty: {},
  fileContents: {},
  isGitRepo: false,
  gitBranch: null,
  isLoading: false,
  statusMessage: null,

  // ── Síncronos (ya existentes) ──────────────────────────────

  setRootPath: (path) => set({ rootPath: path }),

  setFiles: (files) => set({ files }),

  openTab: (path) => {
    const { openTabs } = get();
    if (!openTabs.includes(path)) {
      set({ openTabs: [...openTabs, path], activeTab: path });
    } else {
      set({ activeTab: path });
    }
  },

  closeTab: (path) => {
    const { openTabs, activeTab, fileContents } = get();
    const idx = openTabs.indexOf(path);
    const newTabs = openTabs.filter((t) => t !== path);

    let newActive = activeTab;
    if (activeTab === path) {
      newActive = newTabs.length > 0 ? newTabs[Math.min(idx, newTabs.length - 1)] : null;
    }

    // Limpiar contenido de memoria al cerrar
    const newContents = { ...fileContents };
    delete newContents[path];

    const newDirty = { ...get().isDirty };
    delete newDirty[path];

    set({
      openTabs: newTabs,
      activeTab: newActive,
      fileContents: newContents,
      isDirty: newDirty,
    });
  },

  setActiveTab: (path) => set({ activeTab: path }),

  markDirty: (path) =>
    set((state) => ({
      isDirty: { ...state.isDirty, [path]: true },
    })),

  markClean: (path) =>
    set((state) => ({
      isDirty: { ...state.isDirty, [path]: false },
    })),

  isTabOpen: (path) => get().openTabs.includes(path),

  // ── Nuevos síncronos ───────────────────────────────────────

  setFileContent: (path, content) =>
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
      isDirty: { ...state.isDirty, [path]: true },
    })),

  // ── Asíncronos ─────────────────────────────────────────────

  openProject: async (path) => {
    set({ isLoading: true, statusMessage: "Abriendo proyecto...", rootPath: path });

    try {
      const [files, isRepo] = await Promise.all([loadProject(path), isGitRepo(path)]);

      let branch: string | null = null;
      if (isRepo) {
        branch = await getGitBranch(path);
      }

      set({
        files,
        isGitRepo: isRepo,
        gitBranch: branch,
        isLoading: false,
        statusMessage: `Proyecto abierto: ${path.split(/[/\\]/).pop()}`,
      });
    } catch (error) {
      set({
        isLoading: false,
        statusMessage: `Error al abrir proyecto: ${error instanceof Error ? error.message : "Error desconocido"}`,
      });
    }
  },

  openFile: async (path) => {
    const { openTabs, fileContents } = get();

    // Si el archivo ya está abierto, solo activamos el tab
    if (openTabs.includes(path) && fileContents[path] !== undefined) {
      set({ activeTab: path });
      return;
    }

    try {
      const content = await readFileContent(path);
      set((state) => {
        const newTabs = state.openTabs.includes(path)
          ? state.openTabs
          : [...state.openTabs, path];
        return {
          openTabs: newTabs,
          activeTab: path,
          fileContents: { ...state.fileContents, [path]: content },
          statusMessage: null,
        };
      });
    } catch (error) {
      set({
        statusMessage: `Error al abrir archivo: ${error instanceof Error ? error.message : "Error desconocido"}`,
      });
    }
  },

  saveFile: async (path) => {
    const content = get().fileContents[path];
    if (content === undefined) return;

    try {
      await saveFileContent(path, content);
      set((state) => ({
        isDirty: { ...state.isDirty, [path]: false },
        statusMessage: "Guardado",
      }));
    } catch (error) {
      set({
        statusMessage: `Error al guardar: ${error instanceof Error ? error.message : "Error desconocido"}`,
      });
    }
  },

  closeTabWithSave: async (path) => {
    const { isDirty, fileContents } = get();
    if (isDirty[path] && fileContents[path] !== undefined) {
      await get().saveFile(path);
    }
    get().closeTab(path);
    return true;
  },

  setGitInfo: (branch, isRepo) => set({ gitBranch: branch, isGitRepo: isRepo }),

  clearStatusMessage: () => set({ statusMessage: null }),
}));
