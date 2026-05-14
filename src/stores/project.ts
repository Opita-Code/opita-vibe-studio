import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FileNode } from "@/lib/types";
import { loadProject, readFileContent, saveFileContent, isGitRepo } from "@/lib/fs";
import { getGitBranch } from "@/lib/git";

export interface Workspace {
  id: string; // The root path is the id
  name: string;
  path: string;
  files: FileNode[];
  isGitRepo: boolean;
  gitBranch: string | null;
}

// ─── State ─────────────────────────────────────────────────────

interface ProjectState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;

  openTabs: string[];
  activeTab: string | null;
  isDirty: Record<string, boolean>;
  /** Contenido de archivos abiertos (path → contenido actual) */
  fileContents: Record<string, string>;

  /** Indica si se está cargando un proyecto */
  isLoading: boolean;
  /** Mensaje de estado de la última operación */
  statusMessage: string | null;

  /** Estado de sincronización en la nube (Free Tier OPFS) */
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  hasUnsyncedChanges: boolean;
}

// ─── Actions ───────────────────────────────────────────────────

interface ProjectActions {
  addWorkspace: (path: string) => Promise<void>;
  removeWorkspace: (id: string) => void;
  setActiveWorkspace: (id: string | null) => void;
  
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string | null) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  isTabOpen: (path: string) => boolean;

  /** Establece el contenido de un archivo en memoria y lo marca como dirty */
  setFileContent: (path: string, content: string) => void;

  /** Abre un proyecto (reemplaza todos los workspaces actuales) */
  openProject: (path: string) => Promise<void>;

  /** Recarga los archivos de un workspace específico */
  reloadWorkspace: (id: string) => Promise<void>;

  /** Sincroniza el workspace activo hacia la nube */
  syncProject: () => Promise<void>;

  /** Abre un archivo: lo lee de disco, lo agrega a tabs, carga su contenido */
  openFile: (path: string) => Promise<void>;

  /** Guarda un archivo: escribe a disco, limpia dirty */
  saveFile: (path: string) => Promise<void>;

  /** Cierra un tab guardando si está dirty (devuelve true si se cerró) */
  closeTabWithSave: (path: string) => Promise<boolean>;

  /** Actualiza la info git de un workspace (se invoca internamente o desde file watcher) */
  updateWorkspaceGitInfo: (id: string, branch: string | null, isRepo: boolean) => void;

  /** Actualiza la lista de archivos de un workspace específico (útil para el file watcher) */
  updateWorkspaceFiles: (id: string, files: FileNode[]) => void;

  /** Limpia el mensaje de estado */
  clearStatusMessage: () => void;
}

// ─── Store ─────────────────────────────────────────────────────

export type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,

      openTabs: [],
      activeTab: null,
      isDirty: {},
      fileContents: {},
      
      isLoading: false,
      statusMessage: null,
      isSyncing: false,
      lastSyncedAt: null,
      hasUnsyncedChanges: false,

      // ── Síncronos (ya existentes) ──────────────────────────────

      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

      openTab: (path) => {
        const { openTabs } = get();
        const tabs = openTabs ?? [];
        if (!tabs.includes(path)) {
          set({ openTabs: [...tabs, path], activeTab: path });
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

      setActiveTab: (path) => {
        // Find which workspace this tab belongs to, and make it active
        const wsId = get().workspaces.find((w) => path?.startsWith(w.path))?.id || get().activeWorkspaceId;
        set({ activeTab: path, activeWorkspaceId: wsId });
      },

      markDirty: (path) =>
        set((state) => ({
          isDirty: { ...state.isDirty, [path]: true },
        })),

      markClean: (path) =>
        set((state) => ({
          isDirty: { ...state.isDirty, [path]: false },
        })),

      isTabOpen: (path) => get().openTabs.includes(path),

      setFileContent: (path, content) =>
        set((state) => ({
          fileContents: { ...state.fileContents, [path]: content },
          isDirty: { ...state.isDirty, [path]: true },
        })),

      // ── Asíncronos ─────────────────────────────────────────────

      addWorkspace: async (path) => {
        set({ isLoading: true, statusMessage: "Añadiendo workspace..." });
        try {
          const [files, isRepo] = await Promise.all([loadProject(path), isGitRepo(path)]);
          let branch: string | null = null;
          if (isRepo) {
            branch = await getGitBranch(path);
          }

          const newWs: Workspace = {
            id: path,
            path,
            name: path.split(/[/\\]/).pop() || "Project",
            files,
            isGitRepo: isRepo,
            gitBranch: branch,
          };

          set((state) => {
            // Check if already exists
            const exists = state.workspaces.some((w) => w.id === path);
            const workspaces = exists ? state.workspaces : [...state.workspaces, newWs];
            return {
              workspaces,
              activeWorkspaceId: path,
              isLoading: false,
              statusMessage: `Workspace añadido: ${newWs.name}`,
            };
          });
        } catch (error) {
          set({
            isLoading: false,
            statusMessage: `Error al añadir workspace: ${error instanceof Error ? error.message : "Error desconocido"}`,
          });
        }
      },

      removeWorkspace: (id) => {
        const state = get();
        // Cierra los tabs que pertenezcan a este workspace
        const tabsToClose = state.openTabs.filter((t) => t.startsWith(id));
        tabsToClose.forEach((t) => state.closeTab(t));

        set((s) => {
          const workspaces = s.workspaces.filter((w) => w.id !== id);
          return {
            workspaces,
            activeWorkspaceId: s.activeWorkspaceId === id ? (workspaces.length > 0 ? workspaces[0].id : null) : s.activeWorkspaceId,
          };
        });
      },

      openProject: async (path) => {
        // Reemplaza todos los workspaces por uno solo
        set({ isLoading: true, statusMessage: "Abriendo proyecto...", workspaces: [], openTabs: [], activeTab: null, fileContents: {} });
        
        try {
          const [files, isRepo] = await Promise.all([loadProject(path), isGitRepo(path)]);
          let branch: string | null = null;
          if (isRepo) {
            branch = await getGitBranch(path);
          }

          const newWs: Workspace = {
            id: path,
            path,
            name: path.split(/[/\\]/).pop() || "Project",
            files,
            isGitRepo: isRepo,
            gitBranch: branch,
          };

          set({
            workspaces: [newWs],
            activeWorkspaceId: newWs.id,
            isLoading: false,
            statusMessage: `Proyecto abierto: ${newWs.name}`,
          });
        } catch (error) {
          set({
            isLoading: false,
            statusMessage: `Error al abrir proyecto: ${error instanceof Error ? error.message : "Error desconocido"}`,
          });
        }
      },

      reloadWorkspace: async (id) => {
        if (!id) return;
        try {
          const files = await loadProject(id);
          get().updateWorkspaceFiles(id, files);
        } catch (e) {
          if (e instanceof Error && e.message.includes("No se seleccionó ninguna carpeta")) {
            // Ignorar silenciosamente si no hay carpeta activa aún
            return;
          }
          console.error("Failed to reload workspace", e);
        }
      },

      syncProject: async () => {
        const { activeWorkspaceId, workspaces } = get();
        if (!activeWorkspaceId) return;

        const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
        if (!workspace) return;

        set({ isSyncing: true, statusMessage: "Preparando sincronización..." });

        try {
          const { SyncEngine } = await import("@/lib/sync");
          const { getFileSystemBackend } = await import("@/lib/fs-backend");
          
          await SyncEngine.pushToCloud(
            workspace.files,
            workspace.path,
            getFileSystemBackend(),
            (msg) => set({ statusMessage: msg })
          );

          set({ 
            isSyncing: false, 
            statusMessage: "Nube sincronizada exitosamente", 
            lastSyncedAt: new Date(),
            hasUnsyncedChanges: false,
          });
          
          // Clear status after a few seconds
          setTimeout(() => {
            if (get().statusMessage === "Nube sincronizada exitosamente") {
              set({ statusMessage: null });
            }
          }, 3000);
        } catch (error) {
          set({
            isSyncing: false,
            statusMessage: `Error al sincronizar: ${error instanceof Error ? error.message : "Desconocido"}`,
          });
        }
      },

      updateWorkspaceGitInfo: (id, branch, isRepo) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, gitBranch: branch, isGitRepo: isRepo } : w
          ),
        }));
      },

      updateWorkspaceFiles: (id, files) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, files } : w
          ),
        }));
      },

      openFile: async (path) => {
        const { openTabs, fileContents } = get();

        // Determina el activeWorkspaceId por el path
        const wsId = get().workspaces.find((w) => path.startsWith(w.path))?.id || get().activeWorkspaceId;

        if (openTabs.includes(path) && fileContents[path] !== undefined) {
          set({ activeTab: path, activeWorkspaceId: wsId });
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
              activeWorkspaceId: wsId,
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
            hasUnsyncedChanges: true,
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

      clearStatusMessage: () => set({ statusMessage: null }),
    }),
    {
      name: "vibe-studio-project",
      partialize: (state) => ({
        workspaces: state.workspaces.map(w => ({ id: w.id, path: w.path, name: w.name, files: [], isGitRepo: false, gitBranch: null })), // Only save paths to reload later
        activeWorkspaceId: state.activeWorkspaceId,
        openTabs: state.openTabs,
        activeTab: state.activeTab,
      }),
    },
  ),
);
