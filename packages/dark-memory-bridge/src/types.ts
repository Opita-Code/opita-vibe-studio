/**
 * DarkMemoryBridge — Core Types.
 *
 * Mapeo 1:1 con la superficie de dark-memory v2.9.3-alpha
 * (namespace AGENT_MEMORY + SESSION + RESEARCH). Estos tipos son
 * el contrato entre el harness Aura y el backend de memoria.
 *
 * Referencia: bin\dark-mem-mcp.exe v2.9.3-alpha, schema v18+, FTS5 BM25.
 */

// ─── Memory Kinds (taxonomía canónica de agent_memory) ─────────

export type MemoryKind =
  | "note"            // notas generales
  | "observation"     // observado sobre estado/comportamiento
  | "decision"        // elección arquitectónica/estratégica (el "por qué")
  | "finding"         // hecho derivado de investigación
  | "todo"            // seguimiento accionable
  | "link"            // puntero a recurso externo
  | "context";        // fondo ambiental/constitucional

/** Taxonomía Mem0 de tres clases. */
export type MemoryType = "episodic" | "semantic" | "procedural";

/** Scopes de listado de agent_memory (v2.3.0). */
export type ListScope = "current" | "session" | "project" | "operator" | "agent" | "all";

// ─── Rows ───────────────────────────────────────────────────────

/** Fila canónica de agent_memory tal como la devuelve dark-memory. */
export interface AgentMemoryRow {
  id: number;
  project_id: string;
  operator: string;
  kind: MemoryKind;
  memory_type: MemoryType | null;
  agent_id: string | null;
  subagent_id: string | null;
  title: string;
  content: string;
  tags: string;               // CSV normalizado lowercase
  pinned: boolean;
  session_id: string | null;
  created_at: string;         // RFC3339
  updated_at: string;         // RFC3339
  archived_at: string | null;
}

/** Resultado de búsqueda BM25 (agent_memory_recall). */
export interface RecallItem extends AgentMemoryRow {
  /** Ranking BM25 de FTS5 (mayor = más relevante). */
  rank: number;
}

/** Entidad extraída de una memory (agent_memory_entities, v2.9.0). */
export interface MemoryEntity {
  entity: string;
  source: "title" | "content" | "tags" | "inferred";
  confidence: number;
  model: string;
}

// ─── Save input ─────────────────────────────────────────────────

export interface SaveMemoryInput {
  /** Operator id (INV-1 audit). Default: el operator del bridge. */
  operator?: string;
  /** Kind canónico. */
  kind: MemoryKind;
  /** Payload de la memoria. */
  content: string;
  /** Título corto. */
  title?: string;
  /** Mem0 three-class taxonomy. */
  memory_type?: MemoryType;
  /** Mem0 agent_id (LLM que posee la memoria). */
  agent_id?: string;
  /** Tags CSV, normalizados lowercase. */
  tags?: string;
  /** Anclar (aparece en context recaps). */
  pinned?: boolean;
  /** Vincular a la sesión activa. Default false (v2.3.0). */
  bind_session?: boolean;
}

// ─── List input ─────────────────────────────────────────────────

export interface ListMemoryInput {
  scope?: ListScope;
  kind?: MemoryKind;
  tag?: string;
  memory_type?: MemoryType;
  operator?: string;
  agent_id?: string;
  pinned_only?: boolean;
  include_archived?: boolean;
  limit?: number;
}

// ─── Recall input ───────────────────────────────────────────────

export interface RecallInput {
  /** FTS5 query: alfanumérico + . - _ / + *; AND/OR/NOT/NEAR rechazados. */
  query: string;
  operator: string;
  kind?: MemoryKind;
  memory_type?: MemoryType;
  agent_id?: string;
  limit?: number;
}

// ─── Session ────────────────────────────────────────────────────

export interface SessionInfo {
  session_id: string;
  operator: string;
  project_id: string;
  status: string;
  started_at: string;
}

export interface SessionContextResult {
  session_id: string;
  operator: string;
  project_id: string;
  status: string;
  started_at: string;
  writes_total?: number;
  runs_total?: number;
  items_total?: number;
}

// ─── Health / runtime ───────────────────────────────────────────

export interface BridgeHealth {
  available: boolean;
  serverVersion?: string;
  schemaVersion?: number;
  activeProject?: string;
  transport: TransportKind;
  latencyMs: number;
  error?: string;
}

// ─── Transport ──────────────────────────────────────────────────

export type TransportKind = "tauri" | "http" | "memory";

export interface BridgeTransport {
  readonly kind: TransportKind;
  /** Ejecuta una tool de dark-memory por nombre + args (JSON-RPC). */
  call(tool: string, args: Record<string, unknown>): Promise<unknown>;
  /** Ping de salud (health_ping). */
  ping(): Promise<{ server?: { version?: string }; db?: { schema_version?: number; active_project?: string } }>;
  /** Libera recursos (cierra proceso/subproceso). */
  close(): Promise<void>;
}

// ─── Bridge config ──────────────────────────────────────────────

export interface DarkMemoryBridgeConfig {
  /** Modo de transporte: auto detecta tauri → http → memory. */
  transport?: TransportKind | "auto";
  /** Operator id por defecto (INV-1). */
  operator: string;
  /** Project id por defecto (INV-7). */
  projectId: string;
  /** URL base HTTP para transporte http (MCP streamable). */
  baseUrl?: string;
  /** TTL de caché local en ms (default 5000). */
  cacheTtlMs?: number;
  /** Tamaño máximo de caché de recall (default 50). */
  maxCacheEntries?: number;
}
