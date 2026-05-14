/**
 * CloudBridge — reads/writes context to Supabase PostgreSQL via the Supabase client.
 *
 * Maps between app-level context types (key-value with timestamps) and the
 * `cloud_context` Supabase table schema.
 *
 * Schema:
 *   cloud_context (
 *     id uuid PK,
 *     user_id uuid FK → auth.users,
 *     context_key text,
 *     context_value jsonb,
 *     updated_at timestamptz,
 *     source text,
 *     UNIQUE(user_id, context_key)
 *   )
 */
export interface SupabaseClientLike {
  from: (table: string) => SupabaseQueryBuilder;
}

interface SupabaseQueryBuilder {
  select: (columns?: string) => SupabaseQueryBuilder;
  eq: (column: string, value: unknown) => SupabaseQueryBuilder;
  order: (column: string, options: { ascending: boolean }) => Promise<SupabaseResponse>;
  maybeSingle: () => Promise<SupabaseResponse>;
  single: () => Promise<SupabaseResponse>;
  upsert: (data: Record<string, unknown>, options: { onConflict: string }) => SupabaseQueryBuilder;
  insert: (data: Record<string, unknown>) => SupabaseQueryBuilder;
  update: (data: Record<string, unknown>) => SupabaseQueryBuilder;
  limit: (count: number) => SupabaseQueryBuilder;
}

interface SupabaseResponse {
  data: unknown;
  error: Error | null;
}

const TABLE = "cloud_context";

export class CloudBridge {
  private client: SupabaseClientLike;

  constructor(client: SupabaseClientLike) {
    this.client = client;
  }

  /**
   * Read a context entry for a user by key.
   * Returns { value, timestamp } or null if the entry doesn't exist.
   */
  async readContext(
    userId: string,
    key: string,
  ): Promise<{ value: unknown; timestamp: number } | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("context_key, context_value")
      .eq("user_id", userId)
      .eq("context_key", key)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const row = data as { context_value: { value: unknown; timestamp: number } };
    return {
      value: row.context_value.value,
      timestamp: row.context_value.timestamp,
    };
  }

  /**
   * Upsert a context entry for a user.
   * Uses ON CONFLICT (user_id, context_key) to update existing entries.
   */
  async writeContext(
    userId: string,
    key: string,
    value: unknown,
    timestamp: number,
  ): Promise<void> {
    const { data: _data, error } = await this.client
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          context_key: key,
          context_value: { value, timestamp },
          source: "vibe-studio",
        },
        { onConflict: "user_id, context_key" },
      )
      .select()
      .single();

    if (error) throw error;
  }

  /**
   * List all context keys stored for a user.
   */
  async listContextKeys(userId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("context_key")
      .eq("user_id", userId)
      .order("context_key", { ascending: true });

    if (error) throw error;
    if (!data) return [];

    const rows = data as { context_key: string }[];
    return rows.map((r) => r.context_key);
  }
}
