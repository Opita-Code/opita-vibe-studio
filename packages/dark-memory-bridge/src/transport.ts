/**
 * DarkMemoryBridge — Transports.
 *
 * Tres implementaciones de BridgeTransport:
 *
 * 1. TauriTransport  — via `invoke("dark_memory_call", ...)` en el
 *                      backend Rust (sidecar dark-mem-mcp.exe).
 * 2. HttpTransport   — MCP streamable HTTP (JSON-RPC 2.0) contra un
 *                      endpoint local/remoto.
 * 3. MemoryTransport — fallback en-memoria (offline / dev sin DM).
 *
 * El transporte se selecciona por config.transport o auto-detección:
 * tauri disponible → http configurado → memory.
 */

import type { BridgeTransport, TransportKind } from "./types";

// ─── JSON-RPC helpers ───────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let jsonRpcId = 0;
export function nextId(): number {
  jsonRpcId += 1;
  return jsonRpcId;
}

// ─── 1. Tauri transport ─────────────────────────────────────────

/**
 * Habla con el comando Rust `dark_memory_call` (a implementar en
 * src-tauri). El Rust spawns el sidecar dark-mem-mcp.exe y proxya
 * JSON-RPC sobre stdio.
 */
export class TauriTransport implements BridgeTransport {
  readonly kind: TransportKind = "tauri";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private invoke: (cmd: string, args: Record<string, unknown>) => Promise<any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(invokeFn?: (cmd: string, args: Record<string, unknown>) => Promise<any>) {
    this.invoke = invokeFn ?? defaultTauriInvoke;
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    return this.invoke("dark_memory_call", { tool, args });
  }

  async ping(): Promise<{ server?: { version?: string }; db?: { schema_version?: number; active_project?: string } }> {
    const result = await this.call("dark_memory_health_ping", {});
    return result as { server?: { version?: string }; db?: { schema_version?: number; active_project?: string } };
  }

  async close(): Promise<void> {
    // El ciclo de vida del sidecar lo gestiona Rust (on app exit).
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultTauriInvoke(_cmd: string, _args: Record<string, unknown>): Promise<any> {
  return Promise.reject(
    new Error("Tauri transport: @tauri-apps/api no disponible. Usá transporte http o memory."),
  );
}

// ─── 2. HTTP transport (MCP streamable) ─────────────────────────

/**
 * Habla con un endpoint MCP streamable HTTP usando JSON-RPC 2.0
 * POST. Requiere que el servidor exponga la ruta del protocolo
 * (config.baseUrl debe incluir la ruta, ej. http://127.0.0.1:8844/mcp).
 *
 * @remarks Usa `fetch()` (browser API). No usar en entornos Node < 18
 * sin polyfill global. Para Node, usar TauriTransport (sidecar) o
 * MemoryTransport (fallback offline).
 */
export class HttpTransport implements BridgeTransport {
  readonly kind: TransportKind = "http";

  constructor(private baseUrl: string) {
    if (!baseUrl) throw new Error("HttpTransport: baseUrl es requerido");
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const body: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: nextId(),
      method: "tools/call",
      params: { name: tool, arguments: args },
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`dark-memory HTTP ${response.status}: ${response.statusText}`);
    }

    // MCP streamable puede responder application/json directo.
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (contentType.includes("text/event-stream")) {
      // SSE envelope: eventos `event:`/`data:` con JSON-RPC dentro.
      const dataLine = text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      return this.parseRpcResult(dataLine);
    }

    return this.parseRpcResult(text);
  }

  private parseRpcResult(text: string): unknown {
    let parsed: JsonRpcResponse;
    try {
      parsed = JSON.parse(text) as JsonRpcResponse;
    } catch {
      throw new Error(`dark-memory HTTP: respuesta no-JSON: ${text.slice(0, 200)}`);
    }
    if (parsed.error) {
      throw new Error(`dark-memory RPC error ${parsed.error.code}: ${parsed.error.message}`);
    }
    return parsed.result;
  }

  async ping(): Promise<{ server?: { version?: string }; db?: { schema_version?: number; active_project?: string } }> {
    const result = await this.call("dark_memory_health_ping", {});
    return result as { server?: { version?: string }; db?: { schema_version?: number; active_project?: string } };
  }

  async close(): Promise<void> {
    // Sin recursos que liberar.
  }
}

// ─── 3. Memory transport (fallback offline) ─────────────────────

/**
 * Implementación en-memoria de la superficie de dark-memory.
 * Sirve como fallback cuando DM no está disponible (offline,
 * dev server sin sidecar). NO persiste — se pierde al recargar.
 */
export class MemoryTransport implements BridgeTransport {
  readonly kind: TransportKind = "memory";

  private rows: Array<Record<string, unknown>> = [];
  private nextRowId = 1;
  private activeSession: string | null = null;
  private sessionSeq = 0;

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case "dark_memory_health_ping":
        return {
          server: { version: "memory-fallback" },
          db: { schema_version: 0, active_project: args.project_id ?? "default" },
        };

      case "dark_memory_session_start": {
        // Sufijo con contador monótono: Date.now() solo no garantiza unicidad
        // si dos sessionStart() ocurren en el mismo milisegundo.
        this.sessionSeq += 1;
        this.activeSession = `sess-mem-${Date.now().toString(36)}-${this.sessionSeq.toString(36)}`;
        return {
          session_id: this.activeSession,
          operator: args.operator,
          project_id: args.project_id,
          status: "active",
          started_at: new Date().toISOString(),
        };
      }

      case "dark_memory_session_status":
      case "dark_memory_session_context":
        return {
          session_id: this.activeSession ?? "sess-mem-none",
          operator: args.operator ?? "",
          project_id: args.project_id ?? "default",
          status: this.activeSession ? "active" : "none",
          started_at: new Date().toISOString(),
          writes_total: this.rows.length,
          runs_total: 0,
          items_total: this.rows.length,
        };

      case "dark_memory_session_close": {
        const sessionId = this.activeSession;
        this.activeSession = null;
        return { session_id: sessionId ?? args.session_id ?? "", closed_at: new Date().toISOString(), writes_total: this.rows.length };
      }

      case "dark_memory_agent_memory_save": {
        const row = {
          id: this.nextRowId++,
          project_id: args.project_id ?? "default",
          operator: args.operator ?? "",
          kind: args.kind ?? "note",
          memory_type: args.memory_type ?? null,
          agent_id: args.agent_id ?? null,
          subagent_id: args.subagent_id ?? null,
          title: args.title ?? "",
          content: args.content ?? "",
          tags: args.tags ?? "",
          pinned: args.pinned ?? false,
          session_id: this.activeSession,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          archived_at: null,
        };
        this.rows.push(row);
        return row;
      }

      case "dark_memory_agent_memory_recall": {
        const query = String(args.query ?? "").toLowerCase();
        const kind = args.kind as string | undefined;
        const scored = this.rows
          .filter((r) => r.archived_at === null)
          .filter((r) => !kind || r.kind === kind)
          .map((r) => {
            const haystack = `${String(r.title)} ${String(r.content)} ${String(r.tags)}`.toLowerCase();
            let rank = 0;
            for (const word of query.split(/\s+/).filter(Boolean)) {
              if (haystack.includes(word)) rank += 1;
            }
            return { ...r, rank };
          })
          .filter((r) => r.rank > 0)
          .sort((a, b) => Number(b.rank) - Number(a.rank))
          .slice(0, Number(args.limit ?? 10));
        return scored;
      }

      case "dark_memory_agent_memory_list": {
        const kind = args.kind as string | undefined;
        const includeArchived = args.include_archived === true;
        return this.rows
          .filter((r) => includeArchived || r.archived_at === null)
          .filter((r) => !kind || r.kind === kind)
          .slice(0, Number(args.limit ?? 50));
      }

      case "dark_memory_agent_memory_get": {
        const id = Number(args.id);
        return this.rows.find((r) => r.id === id) ?? null;
      }

      case "dark_memory_agent_memory_entities": {
        const id = Number(args.id);
        const row = this.rows.find((r) => r.id === id);
        if (!row) return { id, entities: [] };
        return { id, entities: [] };
      }

      default:
        throw new Error(`MemoryTransport: tool no soportada en fallback: ${tool}`);
    }
  }

  async ping(): Promise<{ server?: { version?: string }; db?: { schema_version?: number; active_project?: string } }> {
    return {
      server: { version: "memory-fallback" },
      db: { schema_version: 0, active_project: "default" },
    };
  }

  async close(): Promise<void> {
    this.rows = [];
  }
}

// ─── Factory ────────────────────────────────────────────────────

export interface TransportFactoryOptions {
  transport?: TransportKind | "auto";
  baseUrl?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tauriInvoke?: (cmd: string, args: Record<string, unknown>) => Promise<any>;
}

export function isTauriAvailable(): boolean {
  try {
    // En Tauri, window.__TAURI_INTERNALS__ existe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (globalThis as any).__TAURI_INTERNALS__ !== "undefined";
  } catch {
    return false;
  }
}

export function createTransport(options: TransportFactoryOptions): BridgeTransport {
  const requested = options.transport ?? "auto";

  if (requested === "tauri") {
    return new TauriTransport(options.tauriInvoke);
  }

  if (requested === "http") {
    if (!options.baseUrl) throw new Error("createTransport: http requiere baseUrl");
    return new HttpTransport(options.baseUrl);
  }

  if (requested === "memory") {
    return new MemoryTransport();
  }

  // auto
  if (isTauriAvailable()) {
    return new TauriTransport(options.tauriInvoke);
  }
  if (options.baseUrl) {
    return new HttpTransport(options.baseUrl);
  }
  return new MemoryTransport();
}
