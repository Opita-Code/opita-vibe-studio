import { ContextDecayEngine, type DecayOptions } from "./sync/context-decay";

/**
 * Configuration options for creating a MemoryClient.
 */
export interface MemoryClientConfig {
  /** API Gateway base URL (e.g. https://api.opitacode.com) */
  apiBaseUrl: string;
  /** Async callback that returns the Cognito JWT token */
  getAuthToken: () => Promise<string | null>;
  /** The service name identifying this client (e.g., 'vibe-studio', 'aura') */
  serviceName: string;
  /** Optional decay configuration options */
  decayOptions?: DecayOptions;
}

/**
 * Deprecated configuration type for backwards compatibility during migration.
 * @deprecated Use MemoryClientConfig instead.
 */
export type CloudContextConfig = MemoryClientConfig;

/**
 * Unified client for AWS-backed context persistence and memory management.
 *
 * Provides a clean API for:
 * - Direct connection configuration with API Gateway
 * - User-scoped and product-scoped memory access
 * - Automatic time-based decay of context profiles
 */
export class MemoryClient {
  public apiBaseUrl: string;
  public getAuthToken: () => Promise<string | null>;
  public serviceName: string;
  public decayEngine: ContextDecayEngine;

  /**
   * Creates a new MemoryClient instance.
   *
   * @param config - Connection and service configuration
   * @throws {Error} If required config properties are missing
   */
  constructor(config: MemoryClientConfig) {
    if (!config.apiBaseUrl) {
      throw new Error("apiBaseUrl is required");
    }
    if (!config.getAuthToken) {
      throw new Error("getAuthToken callback is required");
    }
    if (!config.serviceName) {
      throw new Error("serviceName is required");
    }

    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.getAuthToken = config.getAuthToken;
    this.serviceName = config.serviceName;
    this.decayEngine = new ContextDecayEngine(config.decayOptions);
  }

  /**
   * Initialize the client (placeholder for startup compatibility).
   */
  async init(): Promise<void> {
    // No-op for AWS native, as authorization is handled per-request via getAuthToken callback
  }
}

/**
 * Deprecated alias for backwards compatibility during migration.
 * @deprecated Use MemoryClient instead.
 */
export const CloudContextClient = MemoryClient;
