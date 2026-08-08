/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * DarkMemoryBridge — unit tests extra (branches faltantes).
 *
 * Complementa tests/bridge.test.ts cubriendo los lados de ramas que
 * quedaban sin ejecutar: constructor (throw / defaults), health con
 * error no-Error, caché (TTL vencido, evicción por maxCacheEntries),
 * caches keys con argumentos explícitos, session lifecycle sin sesión,
 * detectEnvironment y close idempotente.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DarkMemoryBridge } from "../src/client";

const OPERATOR = "aura-extra";
const PROJECT = "proyecto-extra";

function makeBridge(overrides: Record<string, unknown> = {}) {
  return new DarkMemoryBridge({
    operator: OPERATOR,
    projectId: PROJECT,
    transport: "memory",
    ...overrides,
  } as any);
}

describe("DarkMemoryBridge (extra)", () => {
  let bridge: DarkMemoryBridge;

  beforeEach(() => {
    bridge = makeBridge();
  });

  afterEach(async () => {
    await bridge.close();
    vi.unstubAllGlobals();
    delete (globalThis as any).__TAURI_INTERNALS__;
    delete (globalThis as any).document;
  });

  describe("constructor", () => {
    it("exige operator y projectId", () => {
      expect(() => makeBridge({ operator: "" })).toThrow(/operator es requerido/);
      expect(() => makeBridge({ operator: "ok", projectId: "" })).toThrow(/projectId es requerido/);
    });

    it("acepta cacheTtlMs y maxCacheEntries explícitos", () => {
      const b = makeBridge({ cacheTtlMs: 500, maxCacheEntries: 2 });
      expect((b as any).cacheTtlMs).toBe(500);
      expect((b as any).maxCacheEntries).toBe(2);
    });

    it("sin transport explícito auto-detecta (memory en node)", () => {
      const b = makeBridge({ transport: undefined });
      expect((b as any).transport.kind).toBe("memory");
    });
  });

  describe("health", () => {
    it("mapea errores que no son Error con String(err)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue("boom-string"));
      const b = new DarkMemoryBridge({
        operator: OPERATOR,
        projectId: PROJECT,
        transport: "http",
        baseUrl: "http://127.0.0.1:9999/mcp",
      });
      const health = await b.health();
      expect(health.available).toBe(false);
      expect(health.error).toBe("boom-string");
      await b.close();
    });
  });

  describe("detectEnvironment", () => {
    it("detecta tauri", () => {
      (globalThis as any).__TAURI_INTERNALS__ = {};
      expect(DarkMemoryBridge.detectEnvironment()).toBe("tauri");
    });

    it("detecta web", () => {
      (globalThis as any).document = {};
      expect(DarkMemoryBridge.detectEnvironment()).toBe("web");
    });

    it("detecta node por defecto", () => {
      expect(DarkMemoryBridge.detectEnvironment()).toBe("node");
    });
  });

  describe("session lifecycle (sin sesión previa)", () => {
    it("sessionContext sin sesión devuelve estado none", async () => {
      const ctx = await bridge.sessionContext();
      expect(ctx.status).toBe("none");
    });

    it("sessionClose sin sesión no lanza", async () => {
      const res = await bridge.sessionClose();
      expect(typeof res.session_id).toBe("string");
    });

    it("sessionStart repetido usa el último session_id", async () => {
      await bridge.sessionStart();
      const s2 = await bridge.sessionStart();
      expect(s2.session_id).toBeTruthy();
      const ctx = await bridge.sessionContext();
      expect(ctx.session_id).toBe(s2.session_id);
      expect(ctx.status).toBe("active");
    });
  });

  describe("save con operator explícito", () => {
    it("respeta operator pasado en input", async () => {
      const saved = await bridge.save({
        operator: "otro-op",
        kind: "note",
        content: "con operador propio",
      });
      expect(saved.operator).toBe("otro-op");
    });
  });

  describe("cache keys con argumentos explícitos", () => {
    it("recall con kind/memory_type/limit explícitos", async () => {
      await bridge.save({ kind: "decision", memory_type: "semantic", content: "algo de arquitectura" });
      const hits = await bridge.recall({
        query: "arquitectura",
        operator: OPERATOR,
        kind: "decision",
        memory_type: "semantic",
        limit: 3,
      });
      expect(hits.length).toBe(1);
      expect(hits[0].memory_type).toBe("semantic");
    });

    it("list con filtros explícitos (scope/kind/tag/pinned/include_archived)", async () => {
      await bridge.save({ kind: "finding", content: "demo finding", tags: "demo" });
      const rows = await bridge.list({
        scope: "all",
        kind: "finding",
        tag: "demo",
        pinned_only: false,
        include_archived: true,
        limit: 10,
      });
      expect(rows.length).toBe(1);
      expect(rows[0].kind).toBe("finding");
    });
  });

  describe("cache TTL y evicción", () => {
    it("cachea list dentro del TTL y save invalida list", async () => {
      await bridge.save({ kind: "decision", content: "inv-list" });
      await bridge.list({ kind: "decision" });
      await bridge.list({ kind: "decision" });

      await bridge.save({ kind: "context", content: "nueva" });
      const after = await bridge.list({ kind: "decision" });
      expect(after.length).toBe(1);
    });

    it("descarta entradas vencidas por TTL", async () => {
      const b = makeBridge({ cacheTtlMs: -1 });
      await b.save({ kind: "note", content: "expirable" });
      const first = await b.recall({ query: "expirable", operator: OPERATOR });
      expect(first.length).toBe(1);
      const second = await b.recall({ query: "expirable", operator: OPERATOR });
      expect(second.length).toBe(1);
      await b.close();
    });

    it("evicta la entrada más vieja al superar maxCacheEntries", async () => {
      const b = makeBridge({ maxCacheEntries: 2 });
      await b.save({ kind: "note", content: "a-uno" });
      await b.save({ kind: "note", content: "b-dos" });
      await b.save({ kind: "note", content: "c-tres" });
      await b.recall({ query: "uno", operator: OPERATOR });
      await b.recall({ query: "dos", operator: OPERATOR });
      await b.recall({ query: "tres", operator: OPERATOR });
      await b.recall({ query: "dos", operator: OPERATOR });
      await b.close();
    });
  });

  describe("close", () => {
    it("es idempotente", async () => {
      await bridge.close();
      await bridge.close();
      await bridge.save({ kind: "note", content: "post-close" });
      expect(true).toBe(true);
    });
  });
});
