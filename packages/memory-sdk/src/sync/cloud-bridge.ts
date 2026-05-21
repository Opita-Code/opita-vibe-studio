/**
 * CloudBridge — reads/writes context to AWS DynamoDB via API Gateway endpoints.
 *
 * Replaces the Supabase client implementation with standard HTTP fetch calls.
 * Uses AWS Cognito JWT token in the Authorization header to authenticate requests.
 */
export interface CloudBridgeConfig {
  /** API Gateway base URL (e.g. https://api.opitacode.com) */
  apiBaseUrl: string;
  /** Async callback that returns the Cognito JWT token */
  getAuthToken: () => Promise<string | null>;
  /** The service name identifying this client (e.g., 'vibe-studio', 'aura') */
  serviceName: string;
}

export class CloudBridge {
  private apiBaseUrl: string;
  private getAuthToken: () => Promise<string | null>;
  private serviceName: string;

  constructor(config: CloudBridgeConfig) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.getAuthToken = config.getAuthToken;
    this.serviceName = config.serviceName;
  }

  private async fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const url = `${this.apiBaseUrl}${path}`;
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} url: ${url}`);
    }

    return response;
  }

  /**
   * Read a context entry for a user by key.
   * Returns { value, timestamp } or null if the entry doesn't exist.
   */
  async readContext(
    _userId: string, // Kept in signature for interface compatibility
    key: string,
  ): Promise<{ value: unknown; timestamp: number } | null> {
    try {
      const response = await this.fetchWithAuth(
        `/trabajos/context?service=${encodeURIComponent(this.serviceName)}&key=${encodeURIComponent(key)}`
      );
      const data = await response.json() as { value: unknown; timestamp: number } | null;
      if (!data || data.value === null) {
        return null;
      }
      return {
        value: data.value,
        timestamp: data.timestamp,
      };
    } catch (error) {
      console.error(`Error reading context for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Upsert a context entry for a user.
   */
  async writeContext(
    _userId: string, // Kept in signature for interface compatibility
    key: string,
    value: unknown,
    timestamp: number,
  ): Promise<void> {
    await this.fetchWithAuth("/trabajos/context", {
      method: "POST",
      body: JSON.stringify({
        service: this.serviceName,
        key,
        value,
        timestamp,
      }),
    });
  }

  /**
   * List all context keys stored for a user.
   */
  async listContextKeys(_userId: string): Promise<string[]> {
    try {
      const response = await this.fetchWithAuth(
        `/trabajos/context?service=${encodeURIComponent(this.serviceName)}`
      );
      const data = await response.json() as { context: Record<string, { value: unknown; timestamp: number }> };
      if (!data || !data.context) {
        return [];
      }
      return Object.keys(data.context);
    } catch (error) {
      console.error("Error listing context keys:", error);
      return [];
    }
  }
}
