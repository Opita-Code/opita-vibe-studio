/**
 * DarkMemoryBridge — unit tests.
 *
 * Usa MemoryTransport como driver (determinístico, sin procesos).
 * Cubre: save/recall BM25, list filters, session lifecycle,
 * health check, caché con TTL, y fallback offline.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DarkMemoryBridge } from "../src/client";

const OPERATOR = "aura-test";
const PROJECT = "proyecto-demo";

function makeBridge() {
  return new DarkMemoryBridge({
    operator: OPERATOR,
    projectId: PROJECT,
    transport: "memory",
  });
}

describe("DarkMemoryBridge", () => {
  let bridge: DarkMemoryBridge;

  beforeEach(() => {
    bridge = makeBridge();
  });

  afterEach(async () => {
    await bridge.close();
  });

  describe("health", () => {
    it("reporta available con transport memory", async () => {
      const health = await bridge.health();
      expect(health.available).toBe(true);
      expect(health.transport).toBe("memory");
      expect(health.serverVersion).toBe("memory-fallback");
    });
  });

  describe("session lifecycle", () => {
    it("sessionStart → sessionClose conserva el id", async () => {
      const start = await bridge.sessionStart();
      expect(start.session_id).toMatch(/^sess-mem-/);
      expect(start.project_id).toBe(PROJECT);
      expect(start.operator).toBe(OPERATOR);

      const ctx = await bridge.sessionContext();
      expect(ctx.status).toBe("active");

      const close = await bridge.sessionClose();
      expect(close.session_id).toBe(start.session_id);
    });
  });

  describe("save + recall (BM25)", () => {
    it("guarda y recupera por keyword", async () => {
      await bridge.save({
        kind: "decision",
        title: "Auth OCAIS",
        content: "Decidimos usar OCAIS como única fuente de verdad para auth.",
        tags: "auth,ocais,decision",
      });
      await bridge.save({
        kind: "finding",
        title: "MiniMax",
        content: "MiniMax-M3 funciona con providerId minimax y modelId MiniMax-M3.",
        tags: "provider,minimax",
      });

      const hits = await bridge.recall({ query: "OCAIS auth", operator: OPERATOR });
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].kind).toBe("decision");
      expect(hits[0].rank).toBeGreaterThan(0);
    });

    it("filtra por kind", async () => {
      await bridge.save({ kind: "decision", content: "Usar Vite." });
      await bridge.save({ kind: "finding", content: "DeepSeek responde." });

      const decisions = await bridge.recall({ query: "vite", operator: OPERATOR, kind: "decision" });
      expect(decisions.length).toBe(1);
      expect(decisions[0].kind).toBe("decision");
    });

    it("recall sin match devuelve vacío", async () => {
      const hits = await bridge.recall({ query: "zorkmid", operator: OPERATOR });
      expect(hits).toEqual([]);
    });
  });

  describe("list filters", () => {
    it("filtra por kind y tag", async () => {
      await bridge.save({ kind: "decision", content: "x", tags: "auth" });
      await bridge.save({ kind: "context", content: "y", tags: "skill,react" });

      const contexts = await bridge.list({ kind: "context", tag: "skill" });
      expect(contexts.length).toBe(1);
      expect(contexts[0].kind).toBe("context");

      const all = await bridge.list({ scope: "project" });
      expect(all.length).toBe(2);
    });
  });

  describe("get + entities", () => {
    it("get devuelve la fila o null", async () => {
      const saved = await bridge.save({ kind: "note", content: "hola" });
      const found = await bridge.get(saved.id);
      expect(found?.content).toBe("hola");

      const missing = await bridge.get(9999);
      expect(missing).toBeNull();
    });

    it("entities devuelve lista vacía en fallback", async () => {
      const saved = await bridge.save({ kind: "note", content: "hola" });
      const entities = await bridge.entities(saved.id);
      expect(Array.isArray(entities)).toBe(true);
    });
  });

  describe("cache", () => {
    it("cachea recall dentro del TTL", async () => {
      await bridge.save({ kind: "decision", content: "Cache me" });

      const first = await bridge.recall({ query: "cache", operator: OPERATOR });
      expect(first.length).toBe(1);

      const second = await bridge.recall({ query: "cache", operator: OPERATOR });
      expect(second.length).toBe(1);
      expect(second[0].content).toBe("Cache me");
    });

    it("save invalida cachés de list/recall", async () => {
      await bridge.save({ kind: "decision", content: "primera" });
      await bridge.recall({ query: "primera", operator: OPERATOR });

      await bridge.save({ kind: "decision", content: "segunda" });
      const hits = await bridge.recall({ query: "segunda", operator: OPERATOR });
      expect(hits.length).toBe(1);
    });
  });

  describe("offline fallback", () => {
    it("health devuelve available:false cuando el transporte falla", async () => {
      // Un transporte que siempre lanza.
      const broken = new DarkMemoryBridge({
        operator: OPERATOR,
        projectId: PROJECT,
        transport: "http",
        baseUrl: "http://127.0.0.1:1/mcp",
      });
      const health = await broken.health();
      expect(health.available).toBe(false);
      expect(health.error).toBeDefined();
      await broken.close();
    });
  });
});
