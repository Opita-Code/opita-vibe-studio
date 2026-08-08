/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DarkMemoryBridge — unit tests de transports.
 *
 * Cubre TauriTransport (invoke + fallback), HttpTransport (JSON-RPC
 * sobre fetch mockeado: JSON, SSE, errores), MemoryTransport (switch de
 * tools con ramas no alcanzadas vía el bridge) y createTransport (auto
 * / explícito / errores). Sin red real: fetch siempre se mockea.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HttpTransport,
  MemoryTransport,
  TauriTransport,
  createTransport,
  isTauriAvailable,
  nextId,
} from "../src/transport";

describe("nextId", () => {
  it("incrementa secuencialmente", () => {
    const a = nextId();
    const b = nextId();
    expect(b).toBe(a + 1);
  });
});

describe("TauriTransport", () => {
  it("usa la invokeFn provista", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: true });
    const t = new TauriTransport(invoke);
    expect(t.kind).toBe("tauri");

    const res = await t.call("dark_memory_health_ping", { x: 1 });
    expect(invoke).toHaveBeenCalledWith("dark_memory_call", {
      tool: "dark_memory_health_ping",
      args: { x: 1 },
    });
    expect(res).toEqual({ ok: true });
  });

  it("ping delega a health_ping y devuelve resultado", async () => {
    const invoke = vi.fn().mockResolvedValue({ server: { version: "v2" } });
    const t = new TauriTransport(invoke);
    const p = await t.ping();
    expect(p.server?.version).toBe("v2");
    expect(invoke.mock.calls[0][1].tool).toBe("dark_memory_health_ping");
    await t.close();
  });

  it("sin invokeFn usa defaultTauriInvoke que rechaza", async () => {
    const t = new TauriTransport();
    await expect(t.call("x", {})).rejects.toThrow("Tauri transport");
    await expect(t.ping()).rejects.toThrow();
  });
});

describe("HttpTransport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lanza sin baseUrl", () => {
    expect(() => new HttpTransport("")).toThrow("baseUrl es requerido");
  });

  it("parsea respuesta JSON-RPC application/json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: 1 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const t = new HttpTransport("http://127.0.0.1:8844/mcp");
    const res = await t.call("dark_memory_health_ping", {});
    expect(res).toEqual({ ok: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8844/mcp");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("tools/call");
    expect(body.params.name).toBe("dark_memory_health_ping");
  });

  it("lanza en respuesta HTTP no-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("err", { status: 500, statusText: "Internal Server Error" })),
    );
    const t = new HttpTransport("http://x/mcp");
    await expect(t.call("x", {})).rejects.toThrow("dark-memory HTTP 500");
  });

  it("lanza en respuesta no-JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("esto no es json", { status: 200, headers: { "content-type": "application/json" } }),
      ),
    );
    const t = new HttpTransport("http://x/mcp");
    await expect(t.call("x", {})).rejects.toThrow("respuesta no-JSON");
  });

  it("lanza en error RPC dentro del JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const t = new HttpTransport("http://x/mcp");
    await expect(t.call("x", {})).rejects.toThrow("dark-memory RPC error -32601: Method not found");
  });

  it("parsea envelope SSE text/event-stream", async () => {
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":2}}\n\n';
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }),
      ),
    );
    const t = new HttpTransport("http://x/mcp");
    const res = await t.call("x", {});
    expect(res).toEqual({ ok: 2 });
  });

  it("ping devuelve resultado JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { server: { version: "v1" } } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const t = new HttpTransport("http://x/mcp");
    const p = await t.ping();
    expect(p.server?.version).toBe("v1");
    await t.close();
  });

  it("propaga rechazo de fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("ECONNREFUSED")));
    const t = new HttpTransport("http://127.0.0.1:1/mcp");
    await expect(t.call("x", {})).rejects.toThrow("ECONNREFUSED");
  });
});

describe("MemoryTransport", () => {
  let mem: MemoryTransport;

  async function callAny(tool: string, args: Record<string, unknown> = {}): Promise<any> {
    return mem.call(tool, args);
  }

  beforeEach(() => {
    mem = new MemoryTransport();
  });

  it("session_status sin sesión activa → none", async () => {
    const r = await callAny("dark_memory_session_status", {});
    expect(r.status).toBe("none");
    expect(r.session_id).toBe("sess-mem-none");
  });

  it("soporta dark_memory_session_context", async () => {
    await callAny("dark_memory_session_start", { operator: "o", project_id: "p" });
    const r = await callAny("dark_memory_session_context", {});
    expect(r.status).toBe("active");
  });

  it("session_close sin sesión usa args.session_id", async () => {
    const r = await callAny("dark_memory_session_close", { session_id: "sess-foo" });
    expect(r.session_id).toBe("sess-foo");
  });

  it("session_close con sesión activa la cierra", async () => {
    const start = await callAny("dark_memory_session_start", {});
    const r = await callAny("dark_memory_session_close", {});
    expect(r.session_id).toBe(start.session_id);
    const status = await callAny("dark_memory_session_status", {});
    expect(status.status).toBe("none");
  });

  it("save con todos los campos", async () => {
    const row = await callAny("dark_memory_agent_memory_save", {
      operator: "op",
      project_id: "pr",
      kind: "todo",
      memory_type: "procedural",
      agent_id: "agent-1",
      subagent_id: "sub-1",
      title: "T",
      content: "C",
      tags: "a,b",
      pinned: true,
      session_id: "sess-x",
    });
    expect(row.kind).toBe("todo");
    expect(row.memory_type).toBe("procedural");
    expect(row.agent_id).toBe("agent-1");
    expect(row.subagent_id).toBe("sub-1");
    expect(row.title).toBe("T");
    expect(row.content).toBe("C");
    expect(row.tags).toBe("a,b");
    expect(row.pinned).toBe(true);
  });

  it("save con defaults cuando no se pasan campos", async () => {
    const row = await callAny("dark_memory_agent_memory_save", {});
    expect(row.kind).toBe("note");
    expect(row.operator).toBe("");
    expect(row.memory_type).toBeNull();
    expect(row.agent_id).toBeNull();
    expect(row.title).toBe("");
    expect(row.content).toBe("");
    expect(row.tags).toBe("");
    expect(row.pinned).toBe(false);
    expect(row.archived_at).toBeNull();
  });

  it("recall sin query devuelve vacío", async () => {
    await callAny("dark_memory_agent_memory_save", { content: "hola mundo" });
    expect(await callAny("dark_memory_agent_memory_recall", {})).toEqual([]);
  });

  it("recall con query y espacios filtra palabras vacías", async () => {
    await callAny("dark_memory_agent_memory_save", { content: "hola mundo" });
    const r = await callAny("dark_memory_agent_memory_recall", { query: "hola   mundo", limit: 1 });
    expect(r.length).toBe(1);
  });

  it("recall filtra por kind", async () => {
    await callAny("dark_memory_agent_memory_save", { kind: "decision", content: "opcion a" });
    await callAny("dark_memory_agent_memory_save", { kind: "finding", content: "opcion a" });
    const r = await callAny("dark_memory_agent_memory_recall", { query: "opcion", kind: "finding" });
    expect(r.length).toBe(1);
    expect(r[0].kind).toBe("finding");
  });

  it("list con include_archived true incluye todo", async () => {
    await callAny("dark_memory_agent_memory_save", { content: "x", kind: "note" });
    const all = await callAny("dark_memory_agent_memory_list", { include_archived: true, limit: 5 });
    expect(all.length).toBe(1);
  });

  it("list filtra por kind", async () => {
    await callAny("dark_memory_agent_memory_save", { kind: "note", content: "a" });
    await callAny("dark_memory_agent_memory_save", { kind: "context", content: "b" });
    const r = await callAny("dark_memory_agent_memory_list", { kind: "context" });
    expect(r.length).toBe(1);
  });

  it("get de fila inexistente → null", async () => {
    expect(await callAny("dark_memory_agent_memory_get", { id: 42 })).toBeNull();
  });

  it("entities de fila inexistente y existente → vacío", async () => {
    expect((await callAny("dark_memory_agent_memory_entities", { id: 999 })).entities).toEqual([]);
    const row = await callAny("dark_memory_agent_memory_save", { content: "x" });
    expect((await callAny("dark_memory_agent_memory_entities", { id: row.id })).entities).toEqual([]);
  });

  it("tool no soportada lanza", async () => {
    await expect(callAny("dark_memory_noop", {})).rejects.toThrow("tool no soportada");
  });

  it("health_ping vía call respeta project_id", async () => {
    const r = await callAny("dark_memory_health_ping", { project_id: "pr" });
    expect(r.server?.version).toBe("memory-fallback");
    expect(r.db?.active_project).toBe("pr");
  });

  it("ping reporta memory-fallback", async () => {
    const p = await mem.ping();
    expect(p.server?.version).toBe("memory-fallback");
  });

  it("close limpia las filas", async () => {
    await callAny("dark_memory_agent_memory_save", { content: "x" });
    await mem.close();
    expect(await callAny("dark_memory_agent_memory_list", {})).toEqual([]);
  });
});

describe("createTransport / isTauriAvailable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).__TAURI_INTERNALS__;
  });

  it("transport explícito tauri", () => {
    expect(createTransport({ transport: "tauri" }).kind).toBe("tauri");
  });

  it("transport explícito http con baseUrl", () => {
    expect(createTransport({ transport: "http", baseUrl: "http://x/mcp" }).kind).toBe("http");
  });

  it("transport explícito http sin baseUrl lanza", () => {
    expect(() => createTransport({ transport: "http" })).toThrow("baseUrl");
  });

  it("transport explícito memory", () => {
    expect(createTransport({ transport: "memory" }).kind).toBe("memory");
  });

  it("auto con tauri disponible → tauri", () => {
    (globalThis as any).__TAURI_INTERNALS__ = {};
    expect(createTransport({}).kind).toBe("tauri");
  });

  it("auto con baseUrl → http", () => {
    expect(createTransport({ baseUrl: "http://x/mcp" }).kind).toBe("http");
  });

  it("auto sin nada → memory", () => {
    expect(createTransport({}).kind).toBe("memory");
  });

  it("isTauriAvailable detecta el flag global", () => {
    expect(isTauriAvailable()).toBe(false);
    (globalThis as any).__TAURI_INTERNALS__ = {};
    expect(isTauriAvailable()).toBe(true);
  });
});
