import { createStore } from 'zustand/vanilla';
import { ViewDefinition, CommandDefinition } from '../types';

export interface CoreState {
  // Registries
  views: Record<string, ViewDefinition>;
  commands: Record<string, CommandDefinition>;
  activeExtensionIds: string[];
  
  // Actions (Mutators)
  registerView: (view: ViewDefinition) => void;
  registerCommand: (command: CommandDefinition) => void;
  markExtensionActive: (id: string) => void;
}

/**
 * Headless Zustand store. 
 * This lives outside React. React components can subscribe to it later using `useStore`.
 */
export const coreStore = createStore<CoreState>()((set) => ({
  views: {},
  commands: {},
  activeExtensionIds: [],

  registerView: (view) => set((state) => {
    if (state.views[view.id]) {
      console.warn(`View ${view.id} is already registered. Overwriting.`);
    }
    return {
      views: { ...state.views, [view.id]: view }
    };
  }),

  registerCommand: (command) => set((state) => {
    if (state.commands[command.id]) {
      console.warn(`Command ${command.id} is already registered. Overwriting.`);
    }
    return {
      commands: { ...state.commands, [command.id]: command }
    };
  }),

  markExtensionActive: (id) => set((state) => ({
    activeExtensionIds: [...new Set([...state.activeExtensionIds, id])]
  }))
}));
