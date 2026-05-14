import { ComponentType } from 'react';

// --- View Registry Types ---
export type ViewTargetSlot = 'sidebar' | 'editor' | 'statusbar' | 'panel';

export interface ViewDefinition {
  id: string;
  title: string;
  target: ViewTargetSlot;
  component: ComponentType<any>;
  icon?: string;
  order?: number;
}

export interface ViewRegistry {
  registerView: (view: ViewDefinition) => void;
  getViewsForSlot: (slot: ViewTargetSlot) => ViewDefinition[];
}

// --- Command Registry Types ---
export type CommandHandler = (...args: any[]) => void | Promise<void>;

export interface CommandDefinition {
  id: string;
  title: string;
  handler: CommandHandler;
}

export interface CommandRegistry {
  registerCommand: (command: CommandDefinition) => void;
  executeCommand: (id: string, ...args: any[]) => Promise<void>;
}

// --- System Services ---
// (Placeholders for now, to be expanded when integrating Auth/Storage)
export interface AuthService {
  getToken: () => string | null;
  isAuthenticated: () => boolean;
}

export interface StorageService {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T) => Promise<void>;
}

// --- Extension Context ---
export interface ExtensionContext {
  /** The unique ID of the extension */
  id: string;
  
  /** Resources to dispose when extension deactivates */
  subscriptions: { dispose: () => void }[];
  
  /** Register UI components */
  views: ViewRegistry;
  
  /** Register actionable commands */
  commands: CommandRegistry;
  
  /** Access core services */
  services: {
    auth?: AuthService;
    storage?: StorageService;
  };
}

export interface Extension {
  id: string;
  activate: (context: ExtensionContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
}
