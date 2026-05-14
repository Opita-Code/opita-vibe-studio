import { Extension, ExtensionContext, ViewTargetSlot } from './types';
import { coreStore } from './state/coreStore';

/**
 * The central brain of Vibe Studio.
 * Handles bootstrapping and extension lifecycle.
 */
export class CoreHost {
  private static instance: CoreHost;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): CoreHost {
    if (!CoreHost.instance) {
      CoreHost.instance = new CoreHost();
    }
    return CoreHost.instance;
  }

  /**
   * Phase 1: Bootstraps the core environment and services.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    console.log('[CoreHost] Bootstrapping Vibe Studio Engine...');
    
    // In the future, we'll initialize AuthService and StorageService here.
    
    this.isInitialized = true;
  }

  /**
   * Phase 2: Loads and activates an extension.
   */
  public async loadExtension(extension: Extension): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('[CoreHost] Cannot load extension before host is initialized.');
    }

    console.log(`[CoreHost] Activating extension: ${extension.id}`);

    const context = this.createExtensionContext(extension.id);
    
    try {
      await extension.activate(context);
      coreStore.getState().markExtensionActive(extension.id);
      console.log(`[CoreHost] Extension ${extension.id} activated successfully.`);
    } catch (error) {
      console.error(`[CoreHost] Failed to activate extension ${extension.id}:`, error);
    }
  }

  /**
   * Creates the restricted API surface passed to an extension.
   */
  private createExtensionContext(extensionId: string): ExtensionContext {
    return {
      id: extensionId,
      subscriptions: [],
      
      views: {
        registerView: (view) => {
          coreStore.getState().registerView(view);
        },
        getViewsForSlot: (slot: ViewTargetSlot) => {
          const views = Object.values(coreStore.getState().views);
          return views.filter(v => v.target === slot).sort((a, b) => (a.order || 0) - (b.order || 0));
        }
      },
      
      commands: {
        registerCommand: (command) => {
          coreStore.getState().registerCommand(command);
        },
        executeCommand: async (id, ...args) => {
          const command = coreStore.getState().commands[id];
          if (!command) throw new Error(`Command ${id} not found.`);
          await command.handler(...args);
        }
      },
      
      services: {
        // To be injected once implemented
      }
    };
  }
}

// Export the singleton instance for easy access
export const host = CoreHost.getInstance();
