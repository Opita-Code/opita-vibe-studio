import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomToolDef } from "@/agent/stream-client";

// ─── Types ──────────────────────────────────────────────────────

interface CustomToolsState {
  /** User-defined tools (max 10, persisted in localStorage) */
  tools: CustomToolDef[];
}

interface CustomToolsActions {
  addTool: (tool: CustomToolDef) => void;
  removeTool: (name: string) => void;
  updateTool: (name: string, updates: Partial<CustomToolDef>) => void;
  /** Returns the tools array ready to send to the backend */
  getTools: () => CustomToolDef[];
}

// ─── Constants ──────────────────────────────────────────────────

const MAX_CUSTOM_TOOLS = 10;

// ─── Store ──────────────────────────────────────────────────────

export type CustomToolsStore = CustomToolsState & CustomToolsActions;

export const useCustomToolsStore = create<CustomToolsStore>()(
  persist(
    (set, get) => ({
      tools: [],

      addTool: (tool) => {
        const current = get().tools;
        if (current.length >= MAX_CUSTOM_TOOLS) return;
        if (current.some((t) => t.name === tool.name)) return;
        set({ tools: [...current, tool] });
      },

      removeTool: (name) => {
        set({ tools: get().tools.filter((t) => t.name !== name) });
      },

      updateTool: (name, updates) => {
        // Strip name from updates to prevent collision with existing tools
        const { name: _ignoredName, ...safeUpdates } = updates as CustomToolDef;
        set({
          tools: get().tools.map((t) =>
            t.name === name ? { ...t, ...safeUpdates } : t,
          ),
        });
      },

      getTools: () => get().tools,
    }),
    {
      name: "vibe-custom-tools",
    },
  ),
);
