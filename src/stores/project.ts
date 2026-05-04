import { create } from "zustand";
import type { FileNode } from "@/lib/types";

// ─── State ─────────────────────────────────────────────────────

interface ProjectState {
  rootPath: string | null;
  files: FileNode[];
  openTabs: string[];
  activeTab: string | null;
  isDirty: Record<string, boolean>;
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
}

// ─── Store ─────────────────────────────────────────────────────

export type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>((set, get) => ({
  rootPath: null,
  files: [],
  openTabs: [],
  activeTab: null,
  isDirty: {},

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
    const { openTabs, activeTab } = get();
    const idx = openTabs.indexOf(path);
    const newTabs = openTabs.filter((t) => t !== path);

    let newActive = activeTab;
    if (activeTab === path) {
      newActive = newTabs.length > 0 ? newTabs[Math.min(idx, newTabs.length - 1)] : null;
    }

    set({ openTabs: newTabs, activeTab: newActive });
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
}));
