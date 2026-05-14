import { createClient, type SupabaseClient, type AuthChangeEvent, type Session, type Provider } from "@supabase/supabase-js";

/**
 * Configuration options for creating a CloudContextClient.
 */
export interface CloudContextConfig {
  /** Supabase project URL (e.g. https://xyz.supabase.co) */
  supabaseUrl: string;
  /** Supabase anon/public key */
  anonKey: string;
}

/**
 * Unified client for cloud-backed context persistence.
 *
 * Wraps Supabase Auth and provides a clean API for:
 * - Authentication (sign in, sign out, session management)
 * - Auth state change subscriptions
 * - Session lifecycle management
 */
export class CloudContextClient {
  private supabase: SupabaseClient;

  /**
   * Creates a new CloudContextClient instance.
   *
   * @param config - Supabase connection configuration
   * @throws {Error} If supabaseUrl or anonKey are empty
   */
  constructor(config: CloudContextConfig) {
    if (!config.supabaseUrl) {
      throw new Error("supabaseUrl is required");
    }
    if (!config.anonKey) {
      throw new Error("anonKey is required");
    }

    this.supabase = createClient(config.supabaseUrl, config.anonKey);
  }

  /**
   * Initialize the client by checking for an existing session.
   * Call this on app startup.
   */
  async init(): Promise<void> {
    await this.supabase.auth.getSession();
  }

  /**
   * Get the current auth session, if any.
   */
  async getSession(): Promise<Session | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session;
  }

  /**
   * Sign in with the specified OAuth provider.
   *
   * @param provider - The OAuth provider name (e.g. "google")
   */
  async signIn(provider: string, redirectTo?: string): Promise<void> {
    await this.supabase.auth.signInWithOAuth({ 
      provider: provider as Provider,
      options: { redirectTo }
    });
  }

  /**
   * Sign out the current user.
   */
  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  /**
   * Subscribe to authentication state changes.
   *
   * @param callback - Function called on every auth state change
   * @returns An unsubscribe function to stop listening
   */
  onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    const {
      data: { subscription },
    } = this.supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  }
}
