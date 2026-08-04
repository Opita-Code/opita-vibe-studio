/**
 * DarkMemoryBridge — Cliente principal.
 *
 * Expone la superficie de dark-memory como una API TypeScript limpia
 * para el harness Aura. Incluye:
 *  - session lifecycle (start / context / close)
 *  - agent_memory (save / recall / list / get / entities)
 *  - caché local con TTL para recall/list
 *  - health check con degradación elegante
 *
 * Uso:
 *   const bridge = new DarkMemoryBridge({ operator: "aura", projectId: "proyecto-x" });
 *   await bridge.sessionStart();
 *   await bridge.save({ kind: "decision", content: "..." });
 *   const hits = await bridge.recall({ query: "decisión auth", operator: "aura" });
 *   await bridge.sessionClose();
 */

import type {
  AgentMemoryRow,
  BridgeHealth,
  BridgeTransport,
  DarkMemoryBridgeConfig,
  ListMemoryInput,
  MemoryEntity,
  RecallInput,
  RecallItem,
  SaveMemoryInput,
  SessionContextResult,
  SessionInfo,
} from "./types";
import { createTransport, isTauriAvailable } from "./transport";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class DarkMemoryBridge {
  readonly operator: string;
  readonly projectId: string;

  private transport: BridgeTransport;
  private cacheTtlMs: number;
  private maxCacheEntries: number;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private sessionId: string | null = null;
  private closed = false;

  constructor(config: DarkMemoryBridgeConfig) {
    if (!config.operator) throw new Error("DarkMemoryBridge: operator es requerido");
    if (!config.projectId) throw new Error("DarkMemoryBridge: projectId es requerido");

    this.operator = config.operator;
    this.projectId = config.projectId;
    this.cacheTtlMs = config.cacheTtlMs ?? 30_000;
    this.maxCacheEntries = config.maxCacheEntries ?? 50;

    this.transport = createTransport({
      transport: config.transport ?? "auto",
      baseUrl: config.baseUrl,
    });
  }

  // ─── Salud ────────────────────────────────────────────────────

  /**
   * Health check. Nunca lanza — devuelve available:false si DM no
   * responde (degradación elegante, el caller decide el fallback).
   */
  async health(): Promise<BridgeHealth> {
    const started = performance.now();
    try {
      const result = await this.transport.ping();
      return {
        available: true,
        serverVersion: result.server?.version,
        schemaVersion: result.db?.schema_version,
        activeProject: result.db?.active_project,
        transport: this.transport.kind,
        latencyMs: performance.now() - started,
      };
    } catch (err: unknown) {
      return {
        available: false,
        transport: this.transport.kind,
        latencyMs: performance.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Detector de entorno (Tauri vs web vs node). */
  static detectEnvironment(): "tauri" | "web" | "node" {
    if (isTauriAvailable()) return "tauri";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (globalThis as any).document !== "undefined") return "web";
    return "node";
  }

  // ─── Session lifecycle ────────────────────────────────────────

  /** Inicia sesión de dark-memory para el proyecto activo. */
  async sessionStart(notes?: string): Promise<SessionInfo> {
    const result = (await this.transport.call("dark_memory_session_start", {
      operator: this.operator,
      project_id: this.projectId,
      notes,
    })) as SessionInfo;
    this.sessionId = result.session_id;
    this.clearCache();
    return result;
  }

  /** Estado de la sesión activa. */
  async sessionContext(): Promise<SessionContextResult> {
    const result = (await this.transport.call("dark_memory_session_status", {
      session_id: this.sessionId ?? undefined,
    })) as SessionContextResult;
    return result;
  }

  /** Cierra la sesión activa. */
  async sessionClose(): Promise<{ session_id: string; closed_at: string }> {
    const result = (await this.transport.call("dark_memory_session_close", {
      session_id: this.sessionId ?? undefined,
    })) as { session_id: string; closed_at: string };
    this.sessionId = null;
    this.clearCache();
    return result;
  }

  // ─── Agent memory ─────────────────────────────────────────────

  /** Guarda una memoria (finding/decision/note/...) en agent_memory. */
  async save(input: SaveMemoryInput): Promise<AgentMemoryRow> {
    const result = (await this.transport.call("dark_memory_agent_memory_save", {
      operator: input.operator ?? this.operator,
      project_id: this.projectId,
      kind: input.kind,
      content: input.content,
      title: input.title,
      memory_type: input.memory_type,
      agent_id: input.agent_id,
      tags: input.tags,
      pinned: input.pinned,
      bind_session: input.bind_session,
    })) as AgentMemoryRow;
    // Los saves invalidan cachés de recall/list.
    this.invalidateListCaches();
    return result;
  }

  /** Búsqueda BM25 (FTS5) sobre agent_memory. Con caché TTL. */
  async recall(input: RecallInput): Promise<RecallItem[]> {
    const cacheKey = this.recallCacheKey(input);
    const cached = this.readCache<RecallItem[]>(cacheKey);
    if (cached) return cached;

    const result = (await this.transport.call("dark_memory_agent_memory_recall", {
      query: input.query,
      operator: this.operator,
      project_id: this.projectId,
      kind: input.kind,
      memory_type: input.memory_type,
      agent_id: input.agent_id,
      limit: input.limit,
    })) as RecallItem[];

    this.writeCache(cacheKey, result);
    return result;
  }

  /** Lista memories por scope/kind/tag. Con caché TTL. */
  async list(input: ListMemoryInput = {}): Promise<AgentMemoryRow[]> {
    const cacheKey = this.listCacheKey(input);
    const cached = this.readCache<AgentMemoryRow[]>(cacheKey);
    if (cached) return cached;

    const result = (await this.transport.call("dark_memory_agent_memory_list", {
      project_id: this.projectId,
      scope: input.scope ?? "project",
      kind: input.kind,
      tag: input.tag,
      memory_type: input.memory_type,
      operator: input.operator,
      agent_id: input.agent_id,
      pinned_only: input.pinned_only,
      include_archived: input.include_archived,
      limit: input.limit,
    })) as AgentMemoryRow[];

    this.writeCache(cacheKey, result);
    return result;
  }

  /** Recupera una memory por id. Sin caché (single-row reads). */
  async get(id: number): Promise<AgentMemoryRow | null> {
    const result = (await this.transport.call("dark_memory_agent_memory_get", {
      project_id: this.projectId,
      id,
    })) as AgentMemoryRow | null;
    return result;
  }

  /** Entidades extraídas de una memory. */
  async entities(id: number): Promise<MemoryEntity[]> {
    const result = (await this.transport.call("dark_memory_agent_memory_entities", {
      id,
    })) as { id: number; entities: MemoryEntity[] };
    return result.entities ?? [];
  }

  // ─── Caché ────────────────────────────────────────────────────

  private recallCacheKey(input: RecallInput): string {
    return `recall:${input.query}:${input.kind ?? "*"}:${input.memory_type ?? "*"}:${input.limit ?? 10}`;
  }

  private listCacheKey(input: ListMemoryInput): string {
    return `list:${input.scope ?? "project"}:${input.kind ?? "*"}:${input.tag ?? "*"}:${input.pinned_only ?? false}:${input.include_archived ?? false}`;
  }

  private readCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  private writeCache<T>(key: string, value: T): void {
    if (this.cache.size >= this.maxCacheEntries) {
      // Evict oldest
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private invalidateListCaches(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith("recall:") || key.startsWith("list:")) {
        this.cache.delete(key);
      }
    }
  }

  private clearCache(): void {
    this.cache.clear();
  }

  /** Libera recursos del transporte. Idempotente. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.transport.close();
    this.clearCache();
  }
}
